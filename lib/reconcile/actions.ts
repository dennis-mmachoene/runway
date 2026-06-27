'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/cycles';
import { parseStatementCsv } from './csv';
import { classifyLine } from './classify';
import { matchAll } from './match';
import type { AnalyzedLine, MatchableLog } from './types';

async function loadUnreconciledLogs(supabase: SupabaseClient): Promise<MatchableLog[]> {
  const { data } = await supabase
    .from('transactions')
    .select('id, amount, merchant, logged_at')
    .eq('is_reconciled', false)
    .order('logged_at', { ascending: false })
    .limit(300);
  return (data as MatchableLog[]) ?? [];
}

/** Parse + classify + match a pasted statement CSV for owner review. */
export async function analyzeReconcile(csv: string): Promise<AnalyzedLine[]> {
  const lines = parseStatementCsv(csv);
  if (!lines.length) return [];

  const supabase = await createClient();
  const logs = await loadUnreconciledLogs(supabase);

  const spend = lines.filter((l) => l.amount < 0);
  const spendMatches = matchAll(spend, logs);
  const matchBySpendIndex = new Map(spend.map((l, i) => [l, spendMatches[i]] as const));

  return lines.map((line, i) => {
    const { type, category } = classifyLine(line);
    const matchedTxId = type === 'spend' ? (matchBySpendIndex.get(line) ?? null) : null;
    return { id: String(i), ...line, type, category, matchedTxId };
  });
}

export interface ApplyResult {
  ok: boolean;
  matched: number;
  inserted: number;
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

  const result: ApplyResult = {
    ok: true,
    matched: 0,
    inserted: 0,
    refunds: 0,
    transfersSkipped: 0,
    income: 0,
  };

  for (const line of lines) {
    const magnitude = Math.abs(line.amount);

    if (line.type === 'transfer') {
      // Neither income nor spend — exclude entirely.
      result.transfersSkipped++;
      continue;
    }

    if (line.type === 'income') {
      await supabase.from('income_events').insert({
        amount: magnitude,
        event_at: line.date,
        is_confirmed: true,
        source: line.description || 'Statement',
      });
      result.income++;
      continue;
    }

    if (line.type === 'refund') {
      // A credit that is NOT income: a negative spend that nets against its
      // category. Logged "now" so a cross-cycle refund credits the CURRENT cycle.
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
