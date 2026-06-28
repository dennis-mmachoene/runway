import type { StatementLine } from './types';

/**
 * Coerce the model's raw statement array into clean, signed StatementLines.
 * Pure and defensive: anything without a real amount and a valid ISO date is
 * dropped, so a misread row never becomes a fabricated transaction. Sign is
 * preserved (negative = money out, positive = money in).
 */
export function sanitizeStatementLines(raw: unknown): StatementLine[] {
  if (!Array.isArray(raw)) return [];
  const out: StatementLine[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const amount = Number(o.amount);
    if (!Number.isFinite(amount) || amount === 0) continue;
    const rawDate = typeof o.date === 'string' ? o.date.trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}/.test(rawDate)) continue;
    const description = typeof o.description === 'string' ? o.description.trim() : '';
    out.push({ date: rawDate.slice(0, 10), description, amount: Math.round(amount * 100) / 100 });
  }
  return out;
}
