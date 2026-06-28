import { describe, it, expect } from 'vitest';
import { decideAskRule, type AskRuleInput } from './ask-rule';

function base(o: Partial<AskRuleInput> = {}): AskRuleInput {
  return {
    amount: 86,
    amountConfidence: 0.95,
    dateConfidence: 0.95,
    lumpThreshold: 1000,
    categoryUncertain: false,
    isDuplicate: false,
    unfamiliarPayee: false,
    muchLargerThanUsual: false,
    ...o,
  };
}

describe('decideAskRule', () => {
  it('auto-files the small, clear, unremarkable receipt', () => {
    expect(decideAskRule(base())).toEqual({ action: 'auto_file' });
  });

  it('asks when the amount is real money (> lump threshold)', () => {
    expect(decideAskRule(base({ amount: 2400 }))).toEqual({ action: 'ask', reason: 'large_amount' });
  });

  it('asks when the amount or date was read with low confidence', () => {
    expect(decideAskRule(base({ amountConfidence: 0.5 })).action).toBe('ask');
    expect(decideAskRule(base({ dateConfidence: 0.6 })).action).toBe('ask');
  });

  it('asks on a likely duplicate, an unfamiliar payee, or an anomalous amount', () => {
    expect(decideAskRule(base({ isDuplicate: true })).reason).toBe('possible_duplicate');
    expect(decideAskRule(base({ unfamiliarPayee: true })).reason).toBe('unfamiliar_payee');
    expect(decideAskRule(base({ muchLargerThanUsual: true })).reason).toBe('anomalous_amount');
  });

  it('asks when the category is genuinely uncertain', () => {
    expect(decideAskRule(base({ categoryUncertain: true }))).toEqual({
      action: 'ask',
      reason: 'category_uncertain',
    });
  });

  it('money always wins: a large amount asks even if everything else is clean', () => {
    expect(decideAskRule(base({ amount: 5000, amountConfidence: 1, dateConfidence: 1 })).action).toBe('ask');
  });
});
