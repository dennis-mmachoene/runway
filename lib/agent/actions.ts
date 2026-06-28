'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/cycles';
import { performTransition } from '@/lib/cycles/perform-transition';
import { isCategory, type Category } from '@/lib/categories';
import { formatZAR } from '@/lib/format';
import type { DocumentKind, ExtractionProposal, ProposalPayload } from '@/lib/db/types';
import type { FormState } from '@/lib/forms';
import type { ChatMessage } from '@/lib/analyst/chat-prompt';
import { extractDocument } from './extract';
import { decideAskRule, questionFor } from './ask-rule';
import { onboardingTurn } from './onboarding';
import type { OnboardingProposal, OnboardingTurn } from './onboarding-prompt';

export type UploadResult =
  | { ok: true; action: 'auto_filed' | 'ask' }
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
  const { data } = await supabase
    .from('transactions')
    .select('amount, logged_at')
    .eq('merchant', merchant)
    .limit(50);
  const rows = (data as { amount: number; logged_at: string }[]) ?? [];
  const isDuplicate = !!date && rows.some((r) => Math.abs(Number(r.amount) - amount) < 0.01 && r.logged_at.slice(0, 10) === date);
  let anomalous = false;
  if (rows.length >= 3) {
    const amts = rows.map((r) => Number(r.amount)).sort((a, b) => a - b);
    const med = amts[Math.floor(amts.length / 2)];
    anomalous = med > 0 && amount > med * 2.5;
  }
  return { isDuplicate, unfamiliar: rows.length === 0, anomalous };
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

  if (proposal.doc_type === 'payslip') {
    const { data } = await supabase
      .from('income_events')
      .insert({ amount, event_at: dateIso, is_confirmed: true, source: fields.employer || fields.merchant || 'Payslip' })
      .select('id, event_at')
      .single();
    const row = data as { id: string; event_at: string } | null;
    if (row) {
      committedRef = row.id;
      await performTransition(supabase, row);
    }
  } else {
    const settings = await getSettings(supabase);
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
  const decision = decideAskRule({
    amount: extraction.payload.amount,
    amountConfidence: extraction.confidence.amount,
    dateConfidence: extraction.confidence.date,
    lumpThreshold: settings.lump_threshold ?? 1000,
    categoryUncertain: docType !== 'payslip' && extraction.payload.category === 'other',
    isDuplicate: checks.isDuplicate,
    unfamiliarPayee: checks.unfamiliar,
    muchLargerThanUsual: checks.anomalous,
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

  const question = questionFor(decision.reason, {
    merchant: extraction.payload.merchant,
    amount: extraction.payload.amount,
    formatted: formatZAR(extraction.payload.amount),
  });
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
  if (!c.length) return { reply: 'Tell me about your income to start.', done: false, proposal: null };
  return onboardingTurn(c, settings.display_name || 'Dennis');
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

  const patch = {
    floor_default: proposal.floor,
    savings_mode: proposal.savingsMode,
    display_name: proposal.displayName || 'Dennis',
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
    // subscriptions → monthly commitments (recurring, known)
    ...proposal.subscriptions.map((s) => ({
      name: s.merchant,
      amount: s.amount,
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
