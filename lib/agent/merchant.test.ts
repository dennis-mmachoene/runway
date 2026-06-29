import { describe, it, expect } from 'vitest';
import { normalizeMerchant, merchantsMatch, payeeMatchesStrict } from './merchant';

describe('normalizeMerchant', () => {
  it('strips processor suffixes after * or #', () => {
    expect(normalizeMerchant('UBER *TRIP')).toBe('uber');
    expect(normalizeMerchant('WOOLWORTHS #123')).toBe('woolworths');
  });

  it('drops urls, punctuation, long ids and corporate noise', () => {
    expect(normalizeMerchant('Netflix.com')).toBe('netflix');
    expect(normalizeMerchant('Acme (Pty) Ltd 0099123')).toBe('acme');
  });

  it('is empty for blank input', () => {
    expect(normalizeMerchant(null)).toBe('');
    expect(normalizeMerchant('   ')).toBe('');
  });
});

describe('merchantsMatch', () => {
  it('matches obvious variants of the same payee', () => {
    expect(merchantsMatch('Uber', 'UBER *TRIP')).toBe(true);
    expect(merchantsMatch('Woolworths', 'WOOLWORTHS #4471')).toBe(true);
    expect(merchantsMatch('Netflix', 'NETFLIX.COM')).toBe(true);
  });

  it('matches on a shared meaningful token', () => {
    expect(merchantsMatch('Vodacom Prepaid', 'VODACOM TOPUP')).toBe(true);
  });

  it('does not match unrelated payees', () => {
    expect(merchantsMatch('Uber', 'Woolworths')).toBe(false);
    expect(merchantsMatch('Netflix', 'Spotify')).toBe(false);
  });

  it('never matches when either side is blank', () => {
    expect(merchantsMatch('', 'Uber')).toBe(false);
    expect(merchantsMatch('Uber', null)).toBe(false);
  });
});

describe('payeeMatchesStrict', () => {
  it('matches equal or contiguous-phrase names', () => {
    expect(payeeMatchesStrict('Netflix', 'NETFLIX.COM')).toBe(true);
    expect(payeeMatchesStrict('Woolworths', 'WOOLWORTHS #4471')).toBe(true);
    expect(payeeMatchesStrict('Old Mutual', 'Old Mutual Life Assurance')).toBe(true);
  });

  it('does NOT match on a single shared common word', () => {
    expect(payeeMatchesStrict('City Lodge', 'City Power')).toBe(false);
    expect(payeeMatchesStrict('Vodacom Prepaid', 'Vodacom Contract')).toBe(false);
  });

  it('is stricter than the lenient matcher', () => {
    // lenient matches on the shared token; strict refuses
    expect(merchantsMatch('City Lodge', 'City Power')).toBe(true);
    expect(payeeMatchesStrict('City Lodge', 'City Power')).toBe(false);
  });

  it('never matches when either side is blank', () => {
    expect(payeeMatchesStrict('', 'Rent')).toBe(false);
    expect(payeeMatchesStrict('Rent', null)).toBe(false);
  });
});
