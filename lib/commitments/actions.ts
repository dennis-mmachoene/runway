'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getOpenCycle } from '@/lib/cycles';
import type { FormState } from '@/lib/forms';

export async function addCommitment(formData: FormData): Promise<FormState> {
  const name = String(formData.get('name') || '').trim();
  const amount = Number(formData.get('amount'));
  const cadence = String(formData.get('cadence') || 'monthly');
  const type = String(formData.get('type') || 'fixed');
  const variableHighRaw = formData.get('variable_high');
  const variable_high = type === 'variable' && variableHighRaw ? Number(variableHighRaw) : null;
  const dueDayRaw = formData.get('due_day');
  const due_day = dueDayRaw ? Number(dueDayRaw) : null;
  const due_date = String(formData.get('due_date') || '') || null;

  if (!name) return { ok: false, error: 'Give it a name.' };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Enter a valid amount.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('commitments')
    .insert({ name, amount, cadence, type, variable_high, due_day, due_date });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/commitments');
  revalidatePath('/today');
  return { ok: true };
}

/**
 * Pay a monthly commitment (Finding 1, critical): records a `commitment`-kind
 * transaction carrying `commitment_id`. The engine then derives it as paid, so
 * cash_in_hand −X and remaining_commitments −X cancel → net-zero. Sinking funds
 * settle automatically from their pot at cycle close, so paying them here is
 * blocked to avoid double-counting.
 */
export async function payCommitment(formData: FormData): Promise<FormState> {
  const id = String(formData.get('id') || '');
  const amount = Number(formData.get('amount'));
  if (!id) return { ok: false, error: 'Missing id.' };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Enter a valid amount.' };

  const supabase = await createClient();
  const { data: c } = await supabase
    .from('commitments')
    .select('name, cadence')
    .eq('id', id)
    .maybeSingle();
  if (!c) return { ok: false, error: 'Commitment not found.' };
  const cadence = (c as { cadence: string }).cadence;
  if (cadence === 'annual' || cadence === 'custom') {
    return { ok: false, error: 'Sinking funds settle automatically at cycle close.' };
  }

  // Idempotency (N1): a commitment is settled at most once per open cycle, so a
  // double-tap (or settling after reconcile already did) can't hit cash twice.
  const open = await getOpenCycle(supabase);
  if (open?.start_at) {
    const { data: already } = await supabase
      .from('transactions')
      .select('id')
      .eq('kind', 'commitment')
      .eq('commitment_id', id)
      .gte('logged_at', open.start_at)
      .limit(1)
      .maybeSingle();
    if (already) return { ok: false, error: 'Already settled this cycle.' };
  }

  const { error } = await supabase.from('transactions').insert({
    amount,
    merchant: (c as { name: string }).name,
    category: 'bills',
    kind: 'commitment',
    commitment_id: id,
    source: 'manual',
    raw_text: `Paid ${(c as { name: string }).name}`,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/commitments');
  revalidatePath('/today');
  return { ok: true };
}

export async function deactivateCommitment(formData: FormData): Promise<FormState> {
  const id = String(formData.get('id') || '');
  if (!id) return { ok: false, error: 'Missing id.' };
  const supabase = await createClient();
  const { error } = await supabase.from('commitments').update({ is_active: false }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/commitments');
  revalidatePath('/today');
  return { ok: true };
}
