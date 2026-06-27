'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { performTransition } from '@/lib/cycles/perform-transition';
import type { FormState } from '@/lib/forms';

type IncomeRef = { id: string; event_at: string };

export async function addIncome(formData: FormData): Promise<FormState> {
  const amount = Number(formData.get('amount'));
  const eventAtRaw = String(formData.get('event_at') || '');
  const source = String(formData.get('source') || '').trim() || null;
  const isConfirmed = formData.get('is_confirmed') === 'on';
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Enter a valid amount.' };
  if (!eventAtRaw) return { ok: false, error: 'Pick a date.' };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('income_events')
      .insert({ amount, event_at: new Date(eventAtRaw).toISOString(), is_confirmed: isConfirmed, source })
      .select('id, event_at')
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? 'Could not save income.' };
    if (isConfirmed) await performTransition(supabase, data as IncomeRef);
    revalidatePath('/income');
    revalidatePath('/today');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Something went wrong.' };
  }
}

export async function confirmIncome(formData: FormData): Promise<FormState> {
  const id = String(formData.get('id') || '');
  if (!id) return { ok: false, error: 'Missing id.' };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('income_events')
      .update({ is_confirmed: true })
      .eq('id', id)
      .select('id, event_at')
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? 'Could not confirm.' };
    await performTransition(supabase, data as IncomeRef);
    revalidatePath('/income');
    revalidatePath('/today');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Something went wrong.' };
  }
}

export async function deleteIncome(formData: FormData): Promise<FormState> {
  const id = String(formData.get('id') || '');
  if (!id) return { ok: false, error: 'Missing id.' };
  const supabase = await createClient();
  const { error } = await supabase.from('income_events').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/income');
  revalidatePath('/today');
  return { ok: true };
}
