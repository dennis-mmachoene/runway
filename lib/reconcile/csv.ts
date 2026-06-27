import type { StatementLine } from './types';

/** Split one CSV row, honouring double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Parse "R1,250.50", "(300.00)", "300-" into a signed number. */
export function parseAmount(raw: string): number {
  if (!raw) return NaN;
  let s = raw.trim().replace(/[r\s]/gi, '');
  let sign = 1;
  if (/^\(.*\)$/.test(s)) {
    sign = -1;
    s = s.slice(1, -1);
  }
  if (s.endsWith('-')) {
    sign = -1;
    s = s.slice(0, -1);
  }
  if (s.startsWith('-')) {
    sign = -1;
    s = s.slice(1);
  }
  s = s.replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? sign * n : NaN;
}

/** Normalize common date formats to ISO yyyy-mm-dd. */
export function normalizeDate(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s); // yyyy-mm-dd
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(s); // dd/mm/yyyy
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

/**
 * Parse a bank statement CSV (with a header row). Recognizes a single signed
 * `amount`/`value` column, or separate `debit`/`credit` columns.
 */
export function parseStatementCsv(text: string): StatementLine[] {
  const rows = text.split(/\r?\n/).filter((r) => r.trim().length);
  if (rows.length < 2) return [];

  const header = splitCsvLine(rows[0]).map((h) => h.toLowerCase());
  const dateIdx = header.findIndex((h) => /date/.test(h));
  const descIdx = header.findIndex((h) => /desc|narrativ|detail|reference|memo|payee/.test(h));
  const amtIdx = header.findIndex((h) => /amount|value/.test(h));
  const debitIdx = header.findIndex((h) => /debit/.test(h));
  const creditIdx = header.findIndex((h) => /credit/.test(h));
  if (dateIdx < 0) return [];

  const out: StatementLine[] = [];
  for (let i = 1; i < rows.length; i++) {
    const c = splitCsvLine(rows[i]);
    const date = normalizeDate(c[dateIdx] ?? '');
    const description = descIdx >= 0 ? (c[descIdx] ?? '').trim() : '';
    let amount: number;
    if (amtIdx >= 0) {
      amount = parseAmount(c[amtIdx] ?? '');
    } else {
      const debit = debitIdx >= 0 ? parseAmount(c[debitIdx] ?? '') : NaN;
      const credit = creditIdx >= 0 ? parseAmount(c[creditIdx] ?? '') : NaN;
      amount = (Number.isFinite(credit) ? credit : 0) - (Number.isFinite(debit) ? Math.abs(debit) : 0);
    }
    if (!date || !Number.isFinite(amount) || amount === 0) continue;
    out.push({ date, description, amount });
  }
  return out;
}
