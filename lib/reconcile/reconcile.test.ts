import { describe, it, expect } from 'vitest';
import { parseStatementCsv, parseAmount, normalizeDate } from './csv';
import { classifyLine } from './classify';
import { findMatch, matchAll } from './match';
import type { MatchableLog } from './types';

describe('csv parsing', () => {
  it('parses signed amount column', () => {
    const csv = 'Date,Description,Amount\n2026-06-01,Woolworths,-350.00\n2026-06-02,Salary,20000\n';
    expect(parseStatementCsv(csv)).toEqual([
      { date: '2026-06-01', description: 'Woolworths', amount: -350 },
      { date: '2026-06-02', description: 'Salary', amount: 20000 },
    ]);
  });

  it('parses debit/credit columns and dd/mm/yyyy dates', () => {
    const csv = 'Date,Narrative,Debit,Credit\n01/06/2026,Engen,900.00,\n03/06/2026,Refund,,200.00\n';
    expect(parseStatementCsv(csv)).toEqual([
      { date: '2026-06-01', description: 'Engen', amount: -900 },
      { date: '2026-06-03', description: 'Refund', amount: 200 },
    ]);
  });

  it('parses messy amounts', () => {
    expect(parseAmount('R1,250.50')).toBe(1250.5);
    expect(parseAmount('(300.00)')).toBe(-300);
    expect(parseAmount('300-')).toBe(-300);
    expect(normalizeDate('2026/6/7')).toBe('2026-06-07');
  });
});

describe('classification — the three breakers never become income', () => {
  it('classifies a refund credit as refund, not income', () => {
    expect(classifyLine({ date: '2026-06-03', description: 'Refund Takealot', amount: 200 }).type).toBe('refund');
  });
  it('classifies an internal transfer as transfer (neither income nor spend)', () => {
    expect(classifyLine({ date: '2026-06-04', description: 'Transfer to Savings', amount: -1000 }).type).toBe('transfer');
    expect(classifyLine({ date: '2026-06-04', description: 'IB Transfer from Savings', amount: 1000 }).type).toBe('transfer');
  });
  it('classifies an ATM line as cash withdrawal (category cash)', () => {
    const c = classifyLine({ date: '2026-06-05', description: 'ATM Withdrawal', amount: -500 });
    expect(c.type).toBe('cash_withdrawal');
    expect(c.category).toBe('cash');
  });
  it('treats a labelled salary as income but an ambiguous credit as refund (not income)', () => {
    expect(classifyLine({ date: '2026-06-01', description: 'ACB Salary', amount: 20000 }).type).toBe('income');
    expect(classifyLine({ date: '2026-06-09', description: 'EFT Credit', amount: 500 }).type).toBe('refund');
  });
  it('defaults an unlabelled outflow to spend', () => {
    expect(classifyLine({ date: '2026-06-06', description: 'Woolworths', amount: -350 }).type).toBe('spend');
  });
});

describe('matching logs to statement lines', () => {
  const logs: MatchableLog[] = [
    { id: 'a', amount: 350, merchant: 'Woolworths', logged_at: '2026-06-01T10:00:00Z' },
    { id: 'b', amount: 350, merchant: 'Checkers', logged_at: '2026-06-02T10:00:00Z' },
  ];

  it('matches by amount + date proximity, preferring the merchant hint', () => {
    const id = findMatch({ date: '2026-06-01', description: 'Woolworths Sandton', amount: -350 }, logs);
    expect(id).toBe('a');
  });

  it('uses each log at most once', () => {
    const spend = [
      { date: '2026-06-01', description: 'Woolworths', amount: -350 },
      { date: '2026-06-01', description: 'Something', amount: -350 },
    ];
    const result = matchAll(spend, logs);
    expect(result[0]).toBe('a');
    expect(result[1]).toBe('b'); // first claimed 'a', second falls to 'b'
  });

  it('returns null when nothing is close enough', () => {
    expect(findMatch({ date: '2026-07-01', description: 'Nowhere', amount: -999 }, logs)).toBeNull();
  });
});
