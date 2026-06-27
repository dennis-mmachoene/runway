'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/cycles';
import { parseLog, type AliasEntry } from './parser';
import { parseWithGemini } from './gemini';
import { isCategory, type Category } from '@/lib/categories';
import type { TxKind } from '@/lib/engine/types';

export type LogResult =
  | { ok: true }
  | { ok: false; needAmount: true; category: Category; merchant: string | null }
  | { ok: false; error: string };

async function loadAliases(supabase: SupabaseClient): Promise<AliasEntry[]> {
  const { data } = await supabase.from('merchant_aliases').select('alias, category, default_amount');
  return (data as AliasEntry[]) ?? [];
}

async function insertTx(
  supabase: SupabaseClient,
  t: { amount: number; merchant: string | null; category: Category; kind: TxKind; raw: string },
): Promise<void> {
  await supabase.from('transactions').insert({
    raw_text: t.raw,
    amount: t.amount,
    merchant: t.merchant,
    category: t.category,
    kind: t.kind,
    source: 'manual',
  });
}

/** Deterministic-first; Gemini only when ambiguous; never hard-fails. */
export async function logTransaction(raw: string): Promise<LogResult> {
  const text = raw.trim();
  if (!text) return { ok: false, error: 'Type something to log.' };

  const supabase = await createClient();
  const [aliases, settings] = await Promise.all([loadAliases(supabase), getSettings(supabase)]);
  const parsed = parseLog(text, aliases, settings.lump_threshold ?? 1000);

  if (parsed.status === 'ok') {
    await insertTx(supabase, {
      amount: parsed.amount,
      merchant: parsed.merchant,
      category: parsed.category,
      kind: parsed.kind,
      raw: text,
    });
    revalidatePath('/today');
    return { ok: true };
  }

  if (parsed.status === 'need_amount') {
    return { ok: false, needAmount: true, category: parsed.category, merchant: parsed.merchant };
  }

  // Ambiguous → Gemini. If it's down or can't find an amount, fall back to asking.
  const g = await parseWithGemini(text, aliases.map((a) => a.alias));
  if (g && g.amount != null) {
    await insertTx(supabase, {
      amount: g.amount,
      merchant: g.merchant,
      category: g.category,
      kind: g.kind,
      raw: text,
    });
    revalidatePath('/today');
    return { ok: true };
  }
  return { ok: false, needAmount: true, category: g?.category ?? 'other', merchant: g?.merchant ?? null };
}

/** Second step when the amount couldn't be parsed — the deterministic amount path. */
export async function logWithAmount(
  raw: string,
  amount: number,
  category: string,
  merchant: string | null,
): Promise<LogResult> {
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Enter a valid amount.' };
  const supabase = await createClient();
  const settings = await getSettings(supabase);
  const kind: TxKind = amount >= (settings.lump_threshold ?? 1000) ? 'lump' : 'flow';
  await insertTx(supabase, {
    amount,
    merchant: merchant?.trim() || null,
    category: isCategory(category) ? category : 'other',
    kind,
    raw: raw.trim(),
  });
  revalidatePath('/today');
  return { ok: true };
}

/** One-tap fix; optionally remember the merchant→category as an alias. */
export async function correctTransaction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '');
  if (!id) return;
  const category = String(formData.get('category') || 'other');
  const kindRaw = String(formData.get('kind') || '');
  const remember = formData.get('remember') === 'on';
  const merchant = String(formData.get('merchant') || '').trim();

  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (isCategory(category)) patch.category = category;
  if (kindRaw === 'flow' || kindRaw === 'lump' || kindRaw === 'commitment') patch.kind = kindRaw;
  if (Object.keys(patch).length) await supabase.from('transactions').update(patch).eq('id', id);

  if (remember && merchant && isCategory(category)) {
    const aliasKey = merchant.toLowerCase();
    const { data: existing } = await supabase
      .from('merchant_aliases')
      .select('id')
      .eq('alias', aliasKey)
      .maybeSingle();
    if (existing) {
      await supabase.from('merchant_aliases').update({ category }).eq('id', (existing as { id: string }).id);
    } else {
      await supabase.from('merchant_aliases').insert({ alias: aliasKey, category });
    }
  }
  revalidatePath('/today');
}

export async function deleteTransaction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '');
  if (!id) return;
  const supabase = await createClient();
  await supabase.from('transactions').delete().eq('id', id);
  revalidatePath('/today');
}
