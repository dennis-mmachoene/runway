import { describe, it, expect } from 'vitest';
import { parseLog, extractAmounts, type AliasEntry } from './parser';

const THRESHOLD = 1000;

describe('extractAmounts', () => {
  it('handles R prefix, spaces, and commas', () => {
    expect(extractAmounts('R900')).toEqual([900]);
    expect(extractAmounts('R1 250')).toEqual([1250]);
    expect(extractAmounts('1,250.50')).toEqual([1250.5]);
    expect(extractAmounts('nothing here')).toEqual([]);
  });
});

describe('parseLog — deterministic first', () => {
  it('parses "Fuel R900" with no aliases (category other)', () => {
    const r = parseLog('Fuel R900', [], THRESHOLD);
    expect(r).toMatchObject({ status: 'ok', amount: 900, merchant: 'Fuel', category: 'other', kind: 'flow', needsLumpPrompt: false });
  });

  it('applies a learned alias default ("the usual")', () => {
    const aliases: AliasEntry[] = [{ alias: 'the usual', category: 'eating_out', default_amount: 38 }];
    const r = parseLog('the usual', aliases, THRESHOLD);
    expect(r).toMatchObject({ status: 'ok', amount: 38, category: 'eating_out', appliedAlias: 'the usual' });
  });

  it('auto-fills category for a known alias with no amount, NO network (need_amount)', () => {
    const aliases: AliasEntry[] = [{ alias: 'engen', category: 'transport', default_amount: null }];
    const r = parseLog('Engen', aliases, THRESHOLD);
    expect(r).toMatchObject({ status: 'need_amount', category: 'transport', appliedAlias: 'engen' });
  });

  it('flags a lump above the threshold', () => {
    const r = parseLog('Bought a keyboard R1,250', [], THRESHOLD);
    expect(r).toMatchObject({ status: 'ok', amount: 1250, needsLumpPrompt: true });
  });

  it('sends messy multi-item text to Gemini (ambiguous)', () => {
    expect(parseLog('coffee and cake R60', [], THRESHOLD).status).toBe('ambiguous');
    expect(parseLog('Woolworths R350 Engen R900', [], THRESHOLD).status).toBe('ambiguous');
    expect(parseLog('', [], THRESHOLD).status).toBe('ambiguous');
  });
});
