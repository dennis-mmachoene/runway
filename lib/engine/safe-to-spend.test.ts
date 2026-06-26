import { describe, it, expect } from 'vitest';
import {
  computeSafeToSpend,
  computeDailyFlowRate,
  perCycleReserve,
} from './safe-to-spend';
import type { EngineInput, EngineTransaction } from './types';

const TODAY = new Date('2026-06-27T00:00:00Z');

function base(overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    today: TODAY,
    confirmedIncome: 10_000,
    transactions: [],
    monthlyCommitments: [],
    sinkingFunds: [],
    floor: 0,
    flowRateWindowDays: 7,
    ...overrides,
  };
}

describe('Invariant 1 — paying a FIXED commitment is net-zero', () => {
  it('leaves spendable_pool AND runway unchanged', () => {
    const flow: EngineTransaction = { amount: 1_400, kind: 'flow', loggedAt: TODAY };

    const before = computeSafeToSpend(
      base({
        confirmedIncome: 20_000,
        floor: 2_000,
        transactions: [flow],
        monthlyCommitments: [{ amount: 8_000, type: 'fixed', paid: false }],
      }),
    );

    // Paying records a commitment-kind spend AND marks the commitment paid.
    const after = computeSafeToSpend(
      base({
        confirmedIncome: 20_000,
        floor: 2_000,
        transactions: [flow, { amount: 8_000, kind: 'commitment', loggedAt: TODAY }],
        monthlyCommitments: [{ amount: 8_000, type: 'fixed', paid: true }],
      }),
    );

    expect(after.spendablePool).toBe(before.spendablePool);
    expect(after.runwayDays).toBe(before.runwayDays);
    expect(after.runwayDate?.getTime()).toBe(before.runwayDate?.getTime());
    // and the flow rate itself never moved (commitment excluded)
    expect(after.dailyFlowRate).toBe(before.dailyFlowRate);
  });
});

describe('Invariant 2 — a sinking fund is steady (no March cliff)', () => {
  it('drops the pool by the same reserve every cycle, including the due cycle', () => {
    // R6,000 due in 3 cycles, on-track.
    const c1 = computeSafeToSpend(
      base({ sinkingFunds: [{ target: 6_000, reservedBalance: 0, cyclesUntilDue: 3 }] }),
    );
    const c2 = computeSafeToSpend(
      base({ sinkingFunds: [{ target: 6_000, reservedBalance: 2_000, cyclesUntilDue: 2 }] }),
    );
    const cDue = computeSafeToSpend(
      base({ sinkingFunds: [{ target: 6_000, reservedBalance: 4_000, cyclesUntilDue: 1 }] }),
    );

    expect(c1.cycleReserve).toBe(2_000);
    expect(c2.cycleReserve).toBe(2_000);
    expect(cDue.cycleReserve).toBe(2_000); // the lump never lands as a single hit
    expect(c1.spendablePool).toBe(c2.spendablePool);
    expect(c2.spendablePool).toBe(cDue.spendablePool);
  });
});

describe('Invariant 3 — a variable bill under its reserve returns the difference', () => {
  it('raises the pool by the over-reserve when actual < variable_high', () => {
    const before = computeSafeToSpend(
      base({
        monthlyCommitments: [{ amount: 900, type: 'variable', variableHigh: 1_400, paid: false }],
      }),
    );

    // Actual came in at R900 against the R1,400 reserve.
    const after = computeSafeToSpend(
      base({
        transactions: [{ amount: 900, kind: 'commitment', loggedAt: TODAY }],
        monthlyCommitments: [{ amount: 900, type: 'variable', variableHigh: 1_400, paid: true }],
      }),
    );

    expect(after.spendablePool - before.spendablePool).toBe(500);
  });
});

describe('Invariant 4 — a lump lowers the level but not the rate', () => {
  it('drops the pool by the lump while the flow rate is unchanged', () => {
    const flow: EngineTransaction = { amount: 700, kind: 'flow', loggedAt: TODAY };

    const before = computeSafeToSpend(base({ transactions: [flow] }));
    const after = computeSafeToSpend(
      base({ transactions: [flow, { amount: 5_000, kind: 'lump', loggedAt: TODAY }] }),
    );

    expect(after.spendablePool).toBe(before.spendablePool - 5_000);
    expect(after.dailyFlowRate).toBe(before.dailyFlowRate);
    expect(computeDailyFlowRate([flow], 7)).toBe(
      computeDailyFlowRate([flow, { amount: 5_000, kind: 'lump', loggedAt: TODAY }], 7),
    );
  });
});

describe('Cold start — no flow history', () => {
  it('shows the pool with learning_pace and never a fabricated/NaN runway', () => {
    const r = computeSafeToSpend(base({ transactions: [], flowRateWindowDays: 7 }));
    expect(r.dailyFlowRate).toBeNull();
    expect(r.runwayDate).toBeNull();
    expect(r.runwayDays).toBeNull();
    expect(r.status).toBe('learning_pace');
    expect(r.spendablePool).toBe(10_000);
  });
});

describe('Sinking fund helpers', () => {
  it('self-corrects a late start and never funds an over-reserved pot', () => {
    expect(perCycleReserve({ target: 6_000, reservedBalance: 0, cyclesUntilDue: 3 })).toBe(2_000);
    expect(perCycleReserve({ target: 6_000, reservedBalance: 5_000, cyclesUntilDue: 0 })).toBe(1_000);
    expect(perCycleReserve({ target: 6_000, reservedBalance: 7_000, cyclesUntilDue: 2 })).toBe(0);
  });
});
