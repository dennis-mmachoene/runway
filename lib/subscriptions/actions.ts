'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { merchantsMatch } from '@/lib/agent/merchant';

/**
 * Subscriptions have ONE home: commitments — the spoken-for monthly outflows the
 * engine actually reserves against (A4). The /subscriptions view only *detects*
 * undeclared recurring charges; this promotes one into that home as a monthly
 * fixed commitment. Once tracked, its future charges settle the commitment
 * (A1) and the detector stops flagging it.
 */
export async function trackSubscriptionAsCommitment(formData: FormData): Promise<void> {
  const merchant = String(formData.get('merchant') || '').trim();
  const amount = Number(formData.get('amount'));
  if (!merchant || !Number.isFinite(amount) || amount <= 0) return;

  const supabase = await createClient();
  const { data } = await supabase.from('commitments').select('name').eq('is_active', true);
  const already = ((data as { name: string }[]) ?? []).some((c) => merchantsMatch(merchant, c.name));
  if (!already) {
    await supabase
      .from('commitments')
      .insert({ name: merchant, amount, cadence: 'monthly', type: 'fixed' });
  }

  revalidatePath('/subscriptions');
  revalidatePath('/commitments');
  revalidatePath('/today');
}
