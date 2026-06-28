/**
 * Merchant-name normalisation + fuzzy matching.
 *
 * Gemini and bank statements render the same payee many ways — "Uber",
 * "UBER *TRIP", "uber trip help.uber.com", "WOOLWORTHS #123". Exact-string
 * matching therefore both over-asks ("unfamiliar payee" on every variant) and
 * under-dedups (a receipt won't match its statement line). These helpers are
 * pure so the behaviour is testable and identical everywhere it's used.
 */

// Whole-token corporate noise that carries no identifying signal.
const NOISE = /\b(pty|ltd|inc|llc|cc|co|za|com|www|pos|card)\b/g;

export function normalizeMerchant(raw: string | null | undefined): string {
  if (!raw) return '';
  let s = raw.toLowerCase();
  s = s.replace(/[*#].*$/, ' '); // drop processor suffixes after * or # ("uber *trip" → "uber")
  s = s.replace(/https?:\/\/\S+/g, ' '); // urls
  s = s.replace(/[^a-z0-9\s]/g, ' '); // punctuation → space
  s = s.replace(/\b\d{3,}\b/g, ' '); // long numbers (store / txn ids)
  s = s.replace(NOISE, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/** Meaningful tokens (≥3 chars) of a normalized merchant name. */
export function merchantTokens(raw: string | null | undefined): Set<string> {
  return new Set(normalizeMerchant(raw).split(' ').filter((t) => t.length >= 3));
}

/**
 * Whether two names refer to the same payee: equal normalized forms, one a
 * substring of the other, or a shared meaningful token. Deliberately lenient on
 * the matching side (catching variants) but it only ever runs against the
 * owner's own records, so a false match is low-stakes and surfaced for review.
 */
export function merchantsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeMerchant(a);
  const nb = normalizeMerchant(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = merchantTokens(a);
  const tb = merchantTokens(b);
  for (const t of ta) if (tb.has(t)) return true;
  return false;
}
