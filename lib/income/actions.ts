'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { openCycleForIncome } from '@/lib/cycles';

type IncomeRef = { id: string; event_at: string };

export async function addIncome(formData: FormData): Promise<void> {
  const amount = Number(formData.get('amount'));
  const eventAtRaw = String(formData.get('event_at') || '');
  const source = String(formData.get('source') || '').trim() || null;
  const isConfirmed = formData.get('is_confirmed') === 'on';
  if (!Number.isFinite(amount) || amount <= 0 || !eventAtRaw) return;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('income_events')
    .insert({ amount, event_at: new Date(eventAtRaw).toISOString(), is_confirmed: isConfirmed, source })
    .select('id, event_at')
    .single();
  if (error || !data) return;

  if (isConfirmed) await openCycleForIncome(supabase, data as IncomeRef);
  revalidatePath('/income');
  revalidatePath('/today');
}

export async function confirmIncome(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '');
  if (!id) return;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('income_events')
    .update({ is_confirmed: true })
    .eq('id', id)
    .select('id, event_at')
    .single();
  if (error || !data) return;

  await openCycleForIncome(supabase, data as IncomeRef);
  revalidatePath('/income');
  revalidatePath('/today');
}

export async function deleteIncome(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '');
  if (!id) return;
  const supabase = await createClient();
  await supabase.from('income_events').delete().eq('id', id);
  revalidatePath('/income');
  revalidatePath('/today');
}
