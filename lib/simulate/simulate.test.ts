import { describe, it, expect } from 'vitest';
import { simulate } from './simulate';
import type { EngineInput } from '@/lib/engine/types';

const TODAY = new Date('2026-06-27T00:00:00Z');

function base(): EngineInput {
  return {
    today: TODAY,
    confirmedIncome: 10_000,
    transactions: [],
    monthlyCommitments: [],
    sinkingFunds: [],
    floor: 0,
    flowRate: 200, // explicit so the baseline runway is deterministic (50 days)
  };
}

describe('simulate', () => {
  it('with no shocks, the scenario equals the live number', () => {
    const r = simulate(base(), {});
    expect(r.poolDelta).toBe(0);
    expect(r.scenario.spendablePool).toBe(r.baseline.spendablePool);
    expect(r.runwayDaysDelta).toBe(0);
  });

  it('a one-off purchase lowers the pool, not the rate', () => {
    const r = simulate(base(), { oneOffPurchase: 5_000 });
    expect(r.poolDelta).toBe(-5_000);
    expect(r.scenario.spendablePool).toBe(5_000);
    expect(r.scenario.runwayDays).toBe(25); // 5000 / 200, rate unchanged
  });

  it('losing income and a rent rise stack', () => {
    const r = simulate(base(), { incomeDelta: -2_000, extraMonthlyCommitment: 1_000 });
    expect(r.scenario.spendablePool).toBe(7_000); // 8000 cash - 1000 commitment
  });

  it('spending faster shortens the runway without changing the pool', () => {
    const r = simulate(base(), { flowRateMultiplier: 2 });
    expect(r.scenario.spendablePool).toBe(10_000);
    expect(r.scenario.runwayDays).toBe(25); // 10000 / 400
  });

  it('stacks pain: purchase + lost client + rent rise', () => {
    const r = simulate(base(), {
      oneOffPurchase: 5_000,
      incomeDelta: -2_000,
      extraMonthlyCommitment: 1_000,
    });
    // cash = 10000 - 2000 - 5000 = 3000; pool = 3000 - 1000 = 2000
    expect(r.scenario.spendablePool).toBe(2_000);
  });

  it('cold start can never fabricate a runway in either column', () => {
    const r = simulate({ ...base(), flowRate: null }, { oneOffPurchase: 1_000 });
    expect(r.baseline.runwayDays).toBeNull();
    expect(r.scenario.runwayDays).toBeNull();
    expect(r.runwayDaysDelta).toBeNull();
  });
});
