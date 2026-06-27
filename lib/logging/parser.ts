import type { Category } from '@/lib/categories';
import type { TxKind } from '@/lib/engine/types';

export interface AliasEntry {
  alias: string;
  category: Category;
  default_amount: number | null;
}

export type ParseResult =
  | {
      status: 'ok';
      amount: number;
      merchant: string | null;
      category: Category;
      kind: TxKind;
      appliedAlias?: string;
      needsLumpPrompt: boolean;
    }
  | { status: 'need_amount'; merchant: string | null; category: Category; appliedAlias?: string }
  | { status: 'ambiguous'; raw: string };

// Money: optional R, then digits with , or space thousands and optional cents.
const AMOUNT_RE = /(?:r\s*)?(\d{1,3}(?:[ ,]\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/gi;
const CONJUNCTIONS = /\b(?:and|plus)\b|&|,|;|\+/i;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function capitalize(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** All money-looking amounts in the text (thousands separators stripped). */
export function extractAmounts(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(AMOUNT_RE)) {
    const n = Number(m[1].replace(/[ ,]/g, ''));
    if (Number.isFinite(n) && n > 0) out.push(round2(n));
  }
  return out;
}

function stripAmounts(text: string): string {
  return text
    .replace(AMOUNT_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[-–·:]+|[-–·:]+$/g, '')
    .trim();
}

/**
 * Deterministic-first parse: regex + the alias table. Instant, free, offline.
 *  - `ok`          → enough to record (one amount, or an alias default).
 *  - `need_amount` → we know the category (or it's a simple token) but no amount;
 *                    ask inline, NO network call.
 *  - `ambiguous`   → messy (multiple amounts, conjunctions) → hand to Gemini.
 */
export function parseLog(raw: string, aliases: AliasEntry[], lumpThreshold: number): ParseResult {
  const text = raw.trim();
  if (!text) return { status: 'ambiguous', raw };
  const lower = text.toLowerCase();

  const alias = aliases
    .filter((a) => a.alias && lower.includes(a.alias.toLowerCase()))
    .sort((a, b) => b.alias.length - a.alias.length)[0];

  const amounts = Array.from(new Set(extractAmounts(text)));
  if (amounts.length > 1) return { status: 'ambiguous', raw };

  // Conjunction/word-count checks run on the amount-stripped text so a
  // thousands separator (e.g. "R1,250") never looks like a conjunction.
  const rest = stripAmounts(text);
  const category: Category = alias?.category ?? 'other';
  const merchant = alias ? capitalize(alias.alias) : rest || null;
  const amount = amounts.length === 1 ? amounts[0] : (alias?.default_amount ?? null);

  if (amount != null) {
    // One clear amount, but messy phrasing with no learned alias → let Gemini
    // get a cleaner merchant/category.
    if (CONJUNCTIONS.test(rest) && !alias) return { status: 'ambiguous', raw };
    return {
      status: 'ok',
      amount,
      merchant,
      category,
      kind: 'flow',
      appliedAlias: alias?.alias,
      needsLumpPrompt: amount >= lumpThreshold,
    };
  }

  // No amount: simple single-ish token → ask for amount (deterministic, no network).
  const messy = CONJUNCTIONS.test(rest) || rest.split(/\s+/).filter(Boolean).length > 3;
  if (messy) return { status: 'ambiguous', raw };
  return { status: 'need_amount', merchant, category, appliedAlias: alias?.alias };
}
