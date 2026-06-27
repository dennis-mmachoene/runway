import type { EngineInput, EngineResult } from '@/lib/engine/types';
import { computeSafeToSpend } from '@/lib/engine/safe-to-spend';

/** Stackable shocks — pile them on and watch the future bend. */
export interface Shocks {
  /** A one-off purchase now (a lump: lowers the level, not the rate). */
  oneOffPurchase?: number;
  /** Change to confirmed income (negative = lose a client / a raise removed). */
  incomeDelta?: number;
  /** An added monthly commitment (e.g. rent rises). */
  extraMonthlyCommitment?: number;
  /** Multiply the daily flow rate (1.2 = spend 20% faster). */
  flowRateMultiplier?: number;
}

export interface ScenarioView {
  spendablePool: number;
  runwayDays: number | null;
  runwayDate: string | null;
  status: EngineResult['status'];
}

export interface SimResult {
  baseline: ScenarioView;
  scenario: ScenarioView;
  poolDelta: number;
  runwayDaysDelta: number | null;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function toView(r: EngineResult): ScenarioView {
  return {
    spendablePool: r.spendablePool,
    runwayDays: r.runwayDays,
    runwayDate: r.runwayDate ? r.runwayDate.toISOString() : null,
    status: r.status,
  };
}

/**
 * Apply shocks to an engine input. The flow-rate multiplier is applied to the
 * baseline's computed rate, so with no shocks the scenario reproduces the live
 * number exactly. If there's no rate yet (cold start), it stays null — the
 * scenario can't fabricate a runway either.
 */
export function applyShocks(
  input: EngineInput,
  shocks: Shocks,
  baselineRate: number | null,
): EngineInput {
  const transactions = [...input.transactions];
  if (shocks.oneOffPurchase && shocks.oneOffPurchase > 0) {
    transactions.push({ amount: shocks.oneOffPurchase, kind: 'lump', loggedAt: input.today });
  }

  const monthlyCommitments = [...input.monthlyCommitments];
  if (shocks.extraMonthlyCommitment && shocks.extraMonthlyCommitment > 0) {
    monthlyCommitments.push({ amount: shocks.extraMonthlyCommitment, type: 'fixed', paid: false });
  }

  const confirmedIncome = input.confirmedIncome + (shocks.incomeDelta ?? 0);

  let flowRate = baselineRate;
  if (shocks.flowRateMultiplier && baselineRate != null) {
    flowRate = round2(baselineRate * shocks.flowRateMultiplier);
  }

  return { ...input, transactions, monthlyCommitments, confirmedIncome, flowRate };
}

/** Two futures side by side: live baseline vs the shocked scenario. */
export function simulate(input: EngineInput, shocks: Shocks): SimResult {
  const baseline = computeSafeToSpend(input);
  const scenario = computeSafeToSpend(applyShocks(input, shocks, baseline.dailyFlowRate));

  const runwayDaysDelta =
    baseline.runwayDays != null && scenario.runwayDays != null
      ? round2(scenario.runwayDays - baseline.runwayDays)
      : null;

  return {
    baseline: toView(baseline),
    scenario: toView(scenario),
    poolDelta: round2(scenario.spendablePool - baseline.spendablePool),
    runwayDaysDelta,
  };
}
