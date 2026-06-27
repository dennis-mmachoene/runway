'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function addCommitment(formData: FormData): Promise<void> {
  const name = String(formData.get('name') || '').trim();
  const amount = Number(formData.get('amount'));
  const cadence = String(formData.get('cadence') || 'monthly');
  const type = String(formData.get('type') || 'fixed');
  const variableHighRaw = formData.get('variable_high');
  const variable_high =
    type === 'variable' && variableHighRaw ? Number(variableHighRaw) : null;
  const dueDayRaw = formData.get('due_day');
  const due_day = dueDayRaw ? Number(dueDayRaw) : null;
  const due_date = String(formData.get('due_date') || '') || null;

  if (!name || !Number.isFinite(amount) || amount <= 0) return;

  const supabase = await createClient();
  await supabase
    .from('commitments')
    .insert({ name, amount, cadence, type, variable_high, due_day, due_date });
  revalidatePath('/commitments');
  revalidatePath('/today');
}

export async function deactivateCommitment(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '');
  if (!id) return;
  const supabase = await createClient();
  await supabase.from('commitments').update({ is_active: false }).eq('id', id);
  revalidatePath('/commitments');
  revalidatePath('/today');
}
