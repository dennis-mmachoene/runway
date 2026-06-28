import { describe, it, expect } from 'vitest';
import { sanitizeStatementLines } from './sanitize';

describe('sanitizeStatementLines', () => {
  it('returns [] for non-arrays', () => {
    expect(sanitizeStatementLines(null)).toEqual([]);
    expect(sanitizeStatementLines({})).toEqual([]);
    expect(sanitizeStatementLines('nope')).toEqual([]);
  });

  it('keeps valid rows and preserves sign', () => {
    const out = sanitizeStatementLines([
      { date: '2026-06-01', description: 'Woolworths', amount: -250.5 },
      { date: '2026-06-02', description: 'Salary', amount: 18000 },
    ]);
    expect(out).toEqual([
      { date: '2026-06-01', description: 'Woolworths', amount: -250.5 },
      { date: '2026-06-02', description: 'Salary', amount: 18000 },
    ]);
  });

  it('drops rows with no usable amount', () => {
    const out = sanitizeStatementLines([
      { date: '2026-06-01', description: 'Balance b/f', amount: 0 },
      { date: '2026-06-01', description: 'junk', amount: 'NaN' },
      { date: '2026-06-01', description: 'ok', amount: -10 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].description).toBe('ok');
  });

  it('drops rows with an invalid or missing date', () => {
    const out = sanitizeStatementLines([
      { date: '01/06/2026', description: 'bad date format', amount: -5 },
      { description: 'no date', amount: -5 },
      { date: '2026-06-03', description: 'good', amount: -5 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe('2026-06-03');
  });

  it('rounds to cents, trims description, and truncates datetime to date', () => {
    const out = sanitizeStatementLines([
      { date: '2026-06-01T10:30:00Z', description: '  Cafe  ', amount: -12.346 },
    ]);
    expect(out[0]).toEqual({ date: '2026-06-01', description: 'Cafe', amount: -12.35 });
  });

  it('tolerates a missing description', () => {
    const out = sanitizeStatementLines([{ date: '2026-06-01', amount: -9 }]);
    expect(out[0].description).toBe('');
  });
});
