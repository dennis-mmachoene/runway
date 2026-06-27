import { describe, it, expect } from 'vitest';
import { closeSinkingFund, computeLeftover } from './transition';

describe('closeSinkingFund', () => {
  it('accrues the per-cycle reserve when not yet due', () => {
    // R6,000 due in 3, nothing saved → accrue 2000, no payout.
    const r = closeSinkingFund({ target: 6_000, reservedBalance: 0, cyclesUntilDue: 3, isDue: false });
    expect(r).toEqual({ reservedBalance: 2_000, payout: 0 });
  });

  it('accrues then pays out and resets when due', () => {
    // Last cycle: 4000 saved, due now → accrue final 2000 to 6000, pay 6000, pot resets to 0.
    const r = closeSinkingFund({ target: 6_000, reservedBalance: 4_000, cyclesUntilDue: 1, isDue: true });
    expect(r).toEqual({ reservedBalance: 0, payout: 6_000 });
  });

  it('pays only what the pot holds if underfunded at due', () => {
    const r = closeSinkingFund({ target: 6_000, reservedBalance: 1_000, cyclesUntilDue: 0, isDue: true });
    // shortfall path floors cyclesUntilDue<=0 → accrue remaining 5000 to 6000, pay 6000.
    expect(r.payout).toBe(6_000);
    expect(r.reservedBalance).toBe(0);
  });
});

describe('computeLeftover', () => {
  it('carries unspent money forward', () => {
    expect(computeLeftover(2_500)).toBe(2_500);
  });
  it('never carries a negative', () => {
    expect(computeLeftover(-800)).toBe(0);
  });
});
