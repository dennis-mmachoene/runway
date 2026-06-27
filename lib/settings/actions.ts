'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { FormState } from '@/lib/forms';

const SAVINGS = new Set(['automatic', 'best_effort']);
const LEFTOVER = new Set(['sweep_emergency', 'roll_buffer']);

export async function updateSettings(formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const floorDefault = Number(formData.get('floor_default'));
  const lumpThreshold = Number(formData.get('lump_threshold'));
  const savingsMode = String(formData.get('savings_mode') || 'automatic');
  const leftoverMode = String(formData.get('leftover_mode') || 'sweep_emergency');

  const patch = {
    floor_default: Number.isFinite(floorDefault) && floorDefault >= 0 ? floorDefault : 0,
    lump_threshold: Number.isFinite(lumpThreshold) && lumpThreshold > 0 ? lumpThreshold : 1000,
    savings_mode: SAVINGS.has(savingsMode) ? savingsMode : 'automatic',
    leftover_mode: LEFTOVER.has(leftoverMode) ? leftoverMode : 'sweep_emergency',
  };

  const { data: existing } = await supabase
    .from('settings')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  const write = existing
    ? await supabase.from('settings').update(patch).eq('user_id', user.id)
    : await supabase.from('settings').insert({ user_id: user.id, ...patch });
  if (write.error) return { ok: false, error: write.error.message };

  // Keep the open cycle's floor in step with the new default, so the gauge
  // reflects the change immediately during the soak.
  await supabase.from('cycles').update({ floor_amount: patch.floor_default }).eq('status', 'open');

  revalidatePath('/settings');
  revalidatePath('/today');
  return { ok: true };
}
