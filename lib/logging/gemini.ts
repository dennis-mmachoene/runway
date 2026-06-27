import 'server-only';

import { GoogleGenAI } from '@google/genai';
import { GEMINI_API_KEY } from '@/lib/env.server';
import { CATEGORIES, isCategory, type Category } from '@/lib/categories';
import type { TxKind } from '@/lib/engine/types';

export interface GeminiParsed {
  amount: number | null;
  merchant: string | null;
  category: Category;
  kind: TxKind;
}

/**
 * Gemini fallback — called ONLY when the deterministic parse is ambiguous.
 * Returns strict JSON mapped into our fixed vocabulary, or null on any failure
 * (so the caller stays graceful and never hard-fails the log).
 */
export async function parseWithGemini(
  raw: string,
  aliasHints: string[],
): Promise<GeminiParsed | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const prompt = [
      'Extract ONE personal-finance transaction from the user text.',
      'Respond with JSON only, no prose, no code fences:',
      '{"amount": number|null, "merchant": string|null, "category": string, "kind": string}',
      `"category" must be exactly one of: ${CATEGORIES.join(', ')}.`,
      '"kind" must be one of: flow (everyday burn), lump (big one-off), commitment (a known bill).',
      aliasHints.length ? `Known merchant shorthands: ${aliasHints.join(', ')}.` : '',
      `Text: "${raw.replace(/"/g, "'")}"`,
    ]
      .filter(Boolean)
      .join('\n');

    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const text = res.text;
    if (!text) return null;

    const obj = JSON.parse(text) as Record<string, unknown>;
    const amountNum = obj.amount == null ? null : Number(obj.amount);
    const category: Category =
      typeof obj.category === 'string' && isCategory(obj.category) ? obj.category : 'other';
    const kind: TxKind = obj.kind === 'lump' || obj.kind === 'commitment' ? obj.kind : 'flow';

    return {
      amount: amountNum != null && Number.isFinite(amountNum) && amountNum > 0 ? amountNum : null,
      merchant: typeof obj.merchant === 'string' && obj.merchant.trim() ? obj.merchant.trim() : null,
      category,
      kind,
    };
  } catch {
    return null;
  }
}
