'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getSettings, getOpenCycle } from '@/lib/cycles';
import { parseStatementCsv } from './csv';
import { classifyLine } from './classify';
import { matchAll } from './match';
import { extractStatementLines } from './extract';
import { checkUpload } from '@/lib/agent/upload';
import type { AnalyzedLine, MatchableLog, StatementLine } from './types';

async function loadUnreconciledLogs(supabase: SupabaseClient): Promise<MatchableLog[]> {
  const { data } = await supabase
    .from('transactions')
    .select('id, amount, merchant, logged_at')
    .eq('is_reconciled', false)
    .order('logged_at', { ascending: false })
    .limit(300);
  return (data as MatchableLog[]) ?? [];
}

interface KnownCommitment {
  id: string;
  name: string;
  amount: number;
  variable_high: number | null;
  cadence: string;
}

const SINKING = new Set(['annual', 'custom']);

/** Match a debit line to a known commitment by amount (±10%) or a name hint. */
function matchCommitment(line: StatementLine, commitments: KnownCommitment[]): KnownCommitment | null {
  const target = Math.abs(line.amount);
  const desc = line.description.toLowerCase();
  let amountMatch: KnownCommitment | null = null;
  for (const c of commitments) {
    if (c.name.length > 2 && desc.includes(c.name.toLowerCase())) return c; // strongest signal
    const expected = c.variable_high != null ? Number(c.variable_high) : Number(c.amount);
    if (!amountMatch && Math.abs(expected - target) <= Math.max(5, expected * 0.1)) amountMatch = c;
  }
  return amountMatch;
}

/** Classify + match already-parsed statement lines for owner review. Shared by
 *  the CSV-paste path and the document-upload path so both behave identically. */
async function analyzeLines(
  supabase: SupabaseClient,
  lines: StatementLine[],
): Promise<AnalyzedLine[]> {
  if (!lines.length) return [];

  const [logs, commitData] = await Promise.all([
    loadUnreconciledLogs(supabase),
    supabase.from('commitments').select('id, name, amount, variable_high, cadence').eq('is_active', true),
  ]);
  const commitments = (commitData.data as KnownCommitment[]) ?? [];

  const spend = lines.filter((l) => l.amount < 0);
  const spendMatches = matchAll(spend, logs);
  const matchBySpendIndex = new Map(spend.map((l, i) => [l, spendMatches[i]] as const));

  return lines.map((line, i) => {
    const { type, category } = classifyLine(line);

    // A debit that matches a known commitment is a bill payment, not generic
    // spend — write commitment_id so the engine nets it to zero. Sinking bills
    // are covered by their pot, so exclude them (treated as a transfer).
    if (type === 'spend') {
      const c = matchCommitment(line, commitments);
      if (c && SINKING.has(c.cadence)) {
        return { id: String(i), ...line, type: 'transfer', category, matchedTxId: null };
      }
      if (c) {
        return { id: String(i), ...line, type: 'commitment', category: 'bills', matchedTxId: null, commitmentId: c.id };
      }
      return { id: String(i), ...line, type, category, matchedTxId: matchBySpendIndex.get(line) ?? null };
    }

    return { id: String(i), ...line, type, category, matchedTxId: null };
  });
}

/** Parse + classify + match a pasted statement CSV for owner review. */
export async function analyzeReconcile(csv: string): Promise<AnalyzedLine[]> {
  const lines = parseStatementCsv(csv);
  if (!lines.length) return [];
  const supabase = await createClient();
  return analyzeLines(supabase, lines);
}

/**
 * Read an uploaded statement (image/PDF) with vision, then classify + match the
 * lines for owner review — the upload route to the same reconcile table. Returns
 * [] when nothing could be read, so the owner can fall back to pasting a CSV.
 */
export async function analyzeReconcileDocument(formData: FormData): Promise<AnalyzedLine[]> {
  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) return [];
  if (!checkUpload(file.size, file.type).ok) return []; // A5: bound the upload
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = file.type || 'application/octet-stream';
  const base64 = Buffer.from(bytes).toString('base64');
  const lines = await extractStatementLines(base64, mime);
  if (!lines || !lines.length) return [];
  const supabase = await createClient();
  return analyzeLines(supabase, lines);
}

export interface ApplyResult {
  ok: boolean;
  matched: number;
  inserted: number;
  commitments: number;
  refunds: number;
  transfersSkipped: number;
  income: number;
}

/** Apply the owner-reviewed lines. Statement = truth. */
export async function applyReconcile(lines: AnalyzedLine[]): Promise<ApplyResult> {
  const supabase = await createClient();
  const settings = await getSettings(supabase);
  const lumpThreshold = settings.lump_threshold ?? 1000;
  const nowIso = new Date().toISOString();

  // Idempotency guards (N1, N3): a commitment is settled once per open cycle,
  // and an imported income line that duplicates an existing one (amount + date)
  // is skipped — so re-importing a statement never double-counts.
  const open = await getOpenCycle(supabase);
  const cycleStart = open?.start_at ?? null;
  const settled = new Set<string>();
  const incomeKeys = new Set<string>();
  if (cycleStart) {
    const { data } = await supabase
      .from('transactions')
      .select('commitment_id')
      .eq('kind', 'commitment')
      .gte('logged_at', cycleStart);
    for (const r of (data as { commitment_id: string | null }[]) ?? []) {
      if (r.commitment_id) settled.add(r.commitment_id);
    }
  }
  {
    const since = cycleStart ?? new Date(Date.now() - 120 * 86_400_000).toISOString();
    const { data } = await supabase.from('income_events').select('amount, event_at').gte('event_at', since);
    for (const r of (data as { amount: number; event_at: string }[]) ?? []) {
      incomeKeys.add(`${Number(r.amount)}|${r.event_at.slice(0, 10)}`);
    }
  }

  const result: ApplyResult = {
    ok: true,
    matched: 0,
    inserted: 0,
    commitments: 0,
    refunds: 0,
    transfersSkipped: 0,
    income: 0,
  };

  for (const line of lines) {
    const magnitude = Math.abs(line.amount);

    if (line.type === 'transfer') {
      result.transfersSkipped++;
      continue;
    }

    if (line.type === 'income') {
      const key = `${magnitude}|${line.date}`;
      if (incomeKeys.has(key)) continue; // N3 — already recorded
      await supabase.from('income_events').insert({
        amount: magnitude,
        event_at: line.date,
        is_confirmed: true,
        source: line.description || 'Statement',
      });
      incomeKeys.add(key);
      result.income++;
      continue;
    }

    if (line.type === 'commitment' && line.commitmentId) {
      if (settled.has(line.commitmentId)) continue; // N1 — already settled this cycle
      await supabase.from('transactions').insert({
        raw_text: line.description,
        amount: magnitude,
        merchant: line.description || null,
        category: 'bills',
        kind: 'commitment',
        commitment_id: line.commitmentId,
        source: 'import',
        is_reconciled: true,
        logged_at: line.date,
      });
      settled.add(line.commitmentId);
      result.commitments++;
      continue;
    }

    if (line.type === 'refund') {
      await supabase.from('transactions').insert({
        raw_text: line.description,
        amount: -magnitude,
        merchant: line.description || null,
        category: line.category,
        kind: 'flow',
        source: 'import',
        is_reconciled: true,
        logged_at: nowIso,
      });
      result.refunds++;
      continue;
    }

    if (line.type === 'cash_withdrawal') {
      await supabase.from('transactions').insert({
        raw_text: line.description,
        amount: magnitude,
        merchant: 'Cash',
        category: 'cash',
        kind: 'flow',
        source: 'import',
        is_reconciled: true,
        logged_at: line.date,
      });
      result.inserted++;
      continue;
    }

    // spend
    if (line.matchedTxId) {
      await supabase
        .from('transactions')
        .update({ amount: magnitude, category: line.category, is_reconciled: true })
        .eq('id', line.matchedTxId);
      result.matched++;
    } else {
      await supabase.from('transactions').insert({
        raw_text: line.description,
        amount: magnitude,
        merchant: line.description || null,
        category: line.category,
        kind: magnitude >= lumpThreshold ? 'lump' : 'flow',
        source: 'import',
        is_reconciled: true,
        logged_at: line.date,
      });
      result.inserted++;
    }
  }

  revalidatePath('/today');
  revalidatePath('/reconcile');
  return result;
}
