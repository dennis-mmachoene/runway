'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getSettings, getOpenCycle } from '@/lib/cycles';
import { performTransition } from '@/lib/cycles/perform-transition';
import { isCategory, type Category } from '@/lib/categories';
import { formatZAR } from '@/lib/format';
import type { DocumentKind, ExtractionProposal, ProposalPayload } from '@/lib/db/types';
import type { FormState } from '@/lib/forms';
import type { ChatMessage } from '@/lib/analyst/chat-prompt';
import { extractDocument } from './extract';
import { extractStatementLines } from '@/lib/reconcile/extract';
import { detectSubscriptions, type SubscriptionInput } from '@/lib/subscriptions/detect';
import { decideAskRule, questionFor } from './ask-rule';
import { merchantsMatch } from './merchant';
import { classifyBill, type BillCommitment } from './settlement';
import { checkUpload } from './upload';
import { onboardingTurn } from './onboarding';
import type { OnboardingProposal, OnboardingTurn } from './onboarding-prompt';

const MONTHLY = new Set(['monthly', 'weekly']);

/** Active monthly/weekly commitments — the bills an uploaded doc could settle. */
async function loadMonthlyCommitments(supabase: SupabaseClient): Promise<BillCommitment[]> {
  const { data } = await supabase
    .from('commitments')
    .select('id, name, amount, variable_high, cadence')
    .eq('is_active', true);
  return ((data as (BillCommitment & { cadence: string })[]) ?? [])
    .filter((c) => MONTHLY.has(c.cadence))
    .map(({ id, name, amount, variable_high }) => ({ id, name, amount, variable_high }));
}

export type UploadResult =
  | { ok: true; action: 'auto_filed' | 'ask' | 'statement' }
  | { ok: false; error: string };

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

async function checkIrregular(
  supabase: SupabaseClient,
  merchant: string | null,
  amount: number,
  date: string | null,
): Promise<{ isDuplicate: boolean; unfamiliar: boolean; anomalous: boolean }> {
  if (!merchant) return { isDuplicate: false, unfamiliar: true, anomalous: false };

  // A3: match on a NORMALISED/fuzzy payee, not an exact string — so "Uber" and
  // "UBER *TRIP" are the same payee. We pull a recent window and filter in JS,
  // and also treat a remembered alias as "familiar".
  const [{ data: txData }, { data: aliasData }] = await Promise.all([
    supabase
      .from('transactions')
      .select('amount, merchant, logged_at')
      .not('merchant', 'is', null)
      .order('logged_at', { ascending: false })
      .limit(400),
    supabase.from('merchant_aliases').select('alias'),
  ]);
  const all = (txData as { amount: number; merchant: string | null; logged_at: string }[]) ?? [];
  const rows = all.filter((r) => merchantsMatch(merchant, r.merchant));
  const aliasFamiliar = ((aliasData as { alias: string }[]) ?? []).some((a) => merchantsMatch(merchant, a.alias));

  const isDuplicate =
    !!date && rows.some((r) => Math.abs(Number(r.amount) - amount) < 0.01 && r.logged_at.slice(0, 10) === date);
  let anomalous = false;
  if (rows.length >= 3) {
    const amts = rows.map((r) => Number(r.amount)).sort((a, b) => a - b);
    const med = amts[Math.floor(amts.length / 2)];
    anomalous = med > 0 && amount > med * 2.5;
  }
  return { isDuplicate, unfamiliar: rows.length === 0 && !aliasFamiliar, anomalous };
}

/** Commit a proposal into a real record — the ONLY path that writes money. */
async function commitFromProposal(
  supabase: SupabaseClient,
  proposal: Pick<ExtractionProposal, 'id' | 'doc_type' | 'document_id'>,
  fields: ProposalPayload,
  auto: boolean,
): Promise<void> {
  const amount = Number(fields.amount);
  const dateIso = fields.date ? new Date(fields.date).toISOString() : new Date().toISOString();
  let committedRef: string | null = null;

  const open = await getOpenCycle(supabase);

  if (proposal.doc_type === 'payslip') {
    const { data } = await supabase
      .from('income_events')
      .insert({ amount, event_at: dateIso, is_confirmed: true, source: fields.employer || fields.merchant || 'Payslip' })
      .select('id, event_at')
      .single();
    const row = data as { id: string; event_at: string } | null;
    if (row) {
      committedRef = row.id;
      // A2: only transition when this income is NEWER than the open cycle's
      // start. A historical / back-filled payslip is recorded as confirmed
      // income but must NOT close-and-open a cycle (that would corrupt the
      // cycle structure mid-month). With no open cycle yet, the first payslip
      // legitimately opens one.
      const isNewer = !open?.start_at || new Date(dateIso).getTime() > new Date(open.start_at).getTime();
      if (isNewer) await performTransition(supabase, row);
    }
  } else {
    const settings = await getSettings(supabase);

    // A1 + B1: settle a known monthly commitment ONLY on a STRONG payee match
    // (classifyBill). A mere amount-coincidence never settles here — that would
    // overstate safe-to-spend silently. Settlement is also idempotent per cycle
    // (reuse the v2 guard). Anything not a strong match is ordinary spend.
    const monthly = await loadMonthlyCommitments(supabase);
    const billMatch = classifyBill(fields.merchant, amount, monthly);
    const matched = billMatch.kind === 'settle' ? billMatch.commitment : null;

    let alreadySettled = false;
    if (matched && open?.start_at) {
      const { data: settledRows } = await supabase
        .from('transactions')
        .select('id')
        .eq('kind', 'commitment')
        .eq('commitment_id', matched.id)
        .gte('logged_at', open.start_at)
        .limit(1);
      alreadySettled = ((settledRows as { id: string }[]) ?? []).length > 0;
    }

    if (matched && !alreadySettled) {
      const { data } = await supabase
        .from('transactions')
        .insert({
          raw_text: `Filed ${fields.merchant ?? matched.name} (settles ${matched.name})`,
          amount,
          merchant: fields.merchant ?? matched.name,
          category: 'bills',
          kind: 'commitment',
          commitment_id: matched.id,
          source: 'import',
          logged_at: dateIso,
          is_reconciled: false,
        })
        .select('id')
        .single();
      committedRef = (data as { id: string } | null)?.id ?? null;
    } else {
      const kind =
        fields.kind === 'lump' || fields.kind === 'commitment'
          ? fields.kind
          : amount >= (settings.lump_threshold ?? 1000)
            ? 'lump'
            : 'flow';
      const { data } = await supabase
        .from('transactions')
        .insert({
          raw_text: `Filed ${fields.merchant ?? proposal.doc_type}`,
          amount,
          merchant: fields.merchant,
          category: isCategory(fields.category) ? fields.category : 'other',
          kind,
          source: 'import',
          logged_at: dateIso,
          is_reconciled: false,
        })
        .select('id')
        .single();
      committedRef = (data as { id: string } | null)?.id ?? null;
    }
  }

  await supabase
    .from('extraction_proposals')
    .update({ status: auto ? 'auto_filed' : 'confirmed', committed_ref: committedRef, payload: fields })
    .eq('id', proposal.id);
  if (proposal.document_id) {
    await supabase.from('documents').update({ status: 'filed' }).eq('id', proposal.document_id);
  }
}

/** Dennis uploads a document. Extract → store → ask-rule → (auto-file | ask). */
export async function uploadDocument(formData: FormData): Promise<UploadResult> {
  const file = formData.get('file') as File | null;
  const docType = (String(formData.get('doc_type') || 'other') as DocumentKind) || 'other';
  if (!file || file.size === 0) return { ok: false, error: 'Choose a file to upload.' };

  // A statement is many transactions, not one record — it belongs in Reconcile,
  // where the owner reviews every line against the statement as the source of
  // truth. Never file it as a single guessed transaction here.
  if (docType === 'statement') return { ok: true, action: 'statement' };

  // A5: bound the upload before we buffer + base64 + ship it to Gemini.
  const check = checkUpload(file.size, file.type);
  if (!check.ok) return { ok: false, error: check.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = file.type || 'application/octet-stream';
  const base64 = Buffer.from(bytes).toString('base64');

  const extraction = await extractDocument(base64, mime, docType);

  const dateStr = extraction?.payload.date ?? new Date().toISOString().slice(0, 10);
  const ext = mime.includes('pdf') ? 'pdf' : file.name.split('.').pop()?.slice(0, 5) || 'bin';
  const slug = slugify(extraction?.payload.merchant || docType) || docType;
  const amt = extraction ? Math.round(extraction.payload.amount) : 0;
  const cleanName = `${dateStr}_${slug}${amt ? `_R${amt}` : ''}.${ext}`;
  const path = `${user.id}/${Date.now()}_${cleanName}`;

  const up = await supabase.storage.from('documents').upload(path, bytes, { contentType: mime, upsert: false });
  const { data: doc } = await supabase
    .from('documents')
    .insert({ kind: docType, storage_path: up.error ? null : path, mime, original_name: file.name, status: extraction ? 'extracted' : 'received' })
    .select('id')
    .single();
  const documentId = (doc as { id: string } | null)?.id ?? null;

  if (!extraction) {
    await supabase.from('extraction_proposals').insert({
      document_id: documentId,
      doc_type: docType,
      payload: { amount: 0, date: dateStr, merchant: null, category: 'other', kind: 'flow' },
      confidence: { amount: 0, date: 0 },
      status: 'pending',
      question: `I couldn't read this ${docType} cleanly, Dennis. Want to enter the amount and date yourself?`,
    });
    revalidatePath('/inbox');
    return { ok: true, action: 'ask' };
  }

  const settings = await getSettings(supabase);
  const checks = await checkIrregular(supabase, extraction.payload.merchant, extraction.payload.amount, extraction.payload.date);

  // B1: classify against commitments. A strong payee match will settle on
  // commit; an amount-coincidence with a weak payee must ASK, never assume.
  const bill =
    docType === 'payslip'
      ? { kind: 'none' as const }
      : classifyBill(
          extraction.payload.merchant,
          extraction.payload.amount,
          await loadMonthlyCommitments(supabase),
        );
  const commitmentName = bill.kind === 'none' ? null : bill.commitment.name;

  const decision = decideAskRule({
    amount: extraction.payload.amount,
    amountConfidence: extraction.confidence.amount,
    dateConfidence: extraction.confidence.date,
    lumpThreshold: settings.lump_threshold ?? 1000,
    categoryUncertain: docType !== 'payslip' && extraction.payload.category === 'other',
    isDuplicate: checks.isDuplicate,
    unfamiliarPayee: checks.unfamiliar,
    muchLargerThanUsual: checks.anomalous,
    ambiguousSettlement: bill.kind === 'ask',
  });

  const { data: prop } = await supabase
    .from('extraction_proposals')
    .insert({ document_id: documentId, doc_type: docType, payload: extraction.payload, confidence: extraction.confidence, status: 'pending' })
    .select('id')
    .single();
  const proposalId = (prop as { id: string }).id;

  if (decision.action === 'auto_file') {
    await commitFromProposal(supabase, { id: proposalId, doc_type: docType, document_id: documentId }, extraction.payload, true);
    revalidatePath('/inbox');
    revalidatePath('/today');
    return { ok: true, action: 'auto_filed' };
  }

  let question = questionFor(decision.reason, {
    merchant: extraction.payload.merchant,
    amount: extraction.payload.amount,
    formatted: formatZAR(extraction.payload.amount),
    commitmentName,
  });
  // Transparency: if this WILL settle a bill (strong match), say so on the card.
  if (bill.kind === 'settle' && decision.reason !== 'ambiguous_settlement') {
    question += ` I'll log this against your ${bill.commitment.name}.`;
  }
  await supabase.from('extraction_proposals').update({ question }).eq('id', proposalId);
  revalidatePath('/inbox');
  return { ok: true, action: 'ask' };
}

/** Dennis confirms (possibly edited) a pending proposal → real record. */
export async function commitProposal(formData: FormData): Promise<FormState> {
  const id = String(formData.get('id') || '');
  if (!id) return { ok: false, error: 'Missing id.' };
  const supabase = await createClient();
  const { data } = await supabase.from('extraction_proposals').select('*').eq('id', id).maybeSingle();
  const prop = data as ExtractionProposal | null;
  if (!prop) return { ok: false, error: 'Proposal not found.' };

  const fields: ProposalPayload = {
    amount: Number(formData.get('amount') ?? prop.payload.amount),
    date: String(formData.get('date') || prop.payload.date || '') || null,
    merchant: String(formData.get('merchant') || prop.payload.merchant || '') || null,
    category: String(formData.get('category') || prop.payload.category) as Category,
    kind: prop.payload.kind,
    employer: prop.payload.employer,
  };
  if (!Number.isFinite(fields.amount) || fields.amount <= 0) return { ok: false, error: 'Enter a valid amount.' };

  await commitFromProposal(supabase, prop, fields, false);
  revalidatePath('/inbox');
  revalidatePath('/today');
  return { ok: true };
}

export async function rejectProposal(formData: FormData): Promise<FormState> {
  const id = String(formData.get('id') || '');
  if (!id) return { ok: false, error: 'Missing id.' };
  const supabase = await createClient();
  const { data } = await supabase
    .from('extraction_proposals')
    .update({ status: 'rejected' })
    .eq('id', id)
    .select('document_id')
    .single();
  const docId = (data as { document_id: string | null } | null)?.document_id;
  if (docId) await supabase.from('documents').update({ status: 'discarded' }).eq('id', docId);
  revalidatePath('/inbox');
  return { ok: true };
}

/** One conversational onboarding turn — the agent interviews, then proposes. */
export async function onboardingConverse(messages: ChatMessage[]): Promise<OnboardingTurn> {
  const supabase = await createClient();
  const settings = await getSettings(supabase);
  const convo = messages.filter((m) => m.text.trim());
  const firstUser = convo.findIndex((m) => m.role === 'user');
  const c = firstUser >= 0 ? convo.slice(firstUser) : [];
  if (!c.length) return { reply: 'Tell me about your income to start.', done: false, requestDocs: null, proposal: null };
  return onboardingTurn(c, settings.display_name || 'Dennis');
}

/**
 * Document verification DURING onboarding — the "truth track". Reads uploaded
 * payslips or statements and returns a plain-language fact summary to drop back
 * into the conversation, so the agent reconciles it against what was said. Never
 * writes anything; onboarding still only persists at confirm.
 */
export async function onboardingIngest(formData: FormData): Promise<{ summary: string }> {
  const which = String(formData.get('which') || '');
  const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { summary: '' };

  const readable = files.filter((f) => checkUpload(f.size, f.type).ok).slice(0, 6); // A5 bound
  if (!readable.length) return { summary: '[I could not read those files — wrong type or too large.]' };

  const toB64 = async (f: File) => Buffer.from(new Uint8Array(await f.arrayBuffer())).toString('base64');

  if (which === 'payslips') {
    const reads = await Promise.all(
      readable.map(async (f) => extractDocument(await toB64(f), f.type || 'application/pdf', 'payslip')),
    );
    const ok = reads.filter((r): r is NonNullable<typeof r> => !!r);
    if (!ok.length) return { summary: '[I could not read those payslips clearly — could you tell me your net pay and pay date?]' };
    const lines = ok.map(
      (r) => `net ${formatZAR(r.payload.amount)}${r.payload.date ? ` (paid ${r.payload.date})` : ''}`,
    );
    const amounts = ok.map((r) => r.payload.amount);
    const steady = Math.max(...amounts) - Math.min(...amounts) <= Math.max(50, Math.min(...amounts) * 0.05);
    return {
      summary: `[Payslips read — ${ok.length}: ${lines.join('; ')}. Pay looks ${steady ? 'steady' : 'variable'}. Reconcile against what I said and confirm the reliable take-home.]`,
    };
  }

  if (which === 'statements') {
    const debits: SubscriptionInput[] = [];
    let count = 0;
    for (const f of readable) {
      const lines = await extractStatementLines(await toB64(f), f.type || 'application/pdf');
      if (!lines) continue;
      count += lines.length;
      for (const l of lines) {
        if (l.amount < 0) {
          debits.push({ merchant: l.description, amount: Math.abs(l.amount), logged_at: l.date, kind: 'flow' });
        }
      }
    }
    if (!count) return { summary: '[I could not read those statements — could you list your main debit orders?]' };
    const subs = detectSubscriptions(debits);
    const recur = subs.length
      ? ` Recurring charges spotted: ${subs.map((s) => `${s.merchant} ${formatZAR(s.monthlyAmount)}/mo`).join(', ')}.`
      : '';
    const debitTotal = debits.reduce((s, l) => s + l.amount, 0);
    return {
      summary: `[Statements read — ${count} transactions, ${formatZAR(debitTotal)} out in total.${recur} Reconcile these against the commitments I mentioned: flag anything I forgot (gap) and anything that differs (conflict).]`,
    };
  }

  return { summary: '' };
}

/**
 * Writes the agreed model — only after Dennis confirms. Subscriptions are
 * recorded as monthly commitments (recurring spoken-for outflows); the income
 * opens the first cycle via the same atomic transition.
 */
export async function confirmOnboarding(proposal: OnboardingProposal): Promise<FormState> {
  if (!proposal?.income || !(proposal.income.amount > 0)) {
    return { ok: false, error: 'Income amount is required.' };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  // O1: idempotency guard — never run onboarding twice. If a cycle is already
  // open, the profile exists; appending again would double-count and re-open.
  const alreadyOpen = await getOpenCycle(supabase);
  if (alreadyOpen) return { ok: false, error: "You're already set up — nothing to redo." };

  const patch = {
    floor_default: proposal.floor,
    savings_mode: proposal.savingsMode,
    display_name: proposal.displayName || 'Dennis',
    emergency_fund: proposal.emergencyFund ?? 0,
  };
  const { data: existing } = await supabase.from('settings').select('user_id').eq('user_id', user.id).maybeSingle();
  const wrote = existing
    ? await supabase.from('settings').update(patch).eq('user_id', user.id)
    : await supabase.from('settings').insert({ user_id: user.id, ...patch });
  if (wrote.error) return { ok: false, error: wrote.error.message };

  const commitmentRows = [
    ...proposal.commitments.map((c) => ({
      name: c.name,
      amount: c.amount,
      cadence: c.cadence,
      due_day: c.dueDay,
      type: c.type,
    })),
    // subscriptions → monthly commitments (recurring, known) — A4's single home
    ...proposal.subscriptions.map((s) => ({
      name: s.merchant,
      amount: s.amount,
      cadence: 'monthly' as const,
      due_day: null,
      type: 'fixed' as const,
    })),
    // ongoing family support is a spoken-for monthly outflow → a commitment too
    ...proposal.dependents
      .filter((d) => d.ongoing)
      .map((d) => ({
        name: `Support: ${d.description}`,
        amount: d.amount,
        cadence: 'monthly' as const,
        due_day: null,
        type: 'fixed' as const,
      })),
  ];
  if (commitmentRows.length) {
    const { error } = await supabase.from('commitments').insert(commitmentRows);
    if (error) return { ok: false, error: error.message };
  }

  // Open the first cycle with a confirmed income event.
  const eventAt = new Date().toISOString();
  const { data: inc, error: incErr } = await supabase
    .from('income_events')
    .insert({ amount: proposal.income.amount, event_at: eventAt, is_confirmed: true, source: 'Salary' })
    .select('id, event_at')
    .single();
  if (incErr || !inc) return { ok: false, error: incErr?.message ?? 'Could not record income.' };
  await performTransition(supabase, inc as { id: string; event_at: string });

  revalidatePath('/today');
  revalidatePath('/commitments');
  revalidatePath('/settings');
  return { ok: true };
}
