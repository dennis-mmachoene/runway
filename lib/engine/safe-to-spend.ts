import type {
  EngineInput,
  EngineResult,
  EngineTransaction,
  MonthlyCommitment,
  SinkingFund,
} from './types';

const MS_PER_DAY = 86_400_000;

/** Round to cents, avoiding binary-float drift (e.g. 0.1 + 0.2). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * What a monthly commitment still claims from the pool. Paid → 0. A VARIABLE
 * bill reserves pessimistically at `variableHigh` until paid; a FIXED bill
 * reserves its exact amount.
 */
export function remainingCommitmentAmount(c: MonthlyCommitment): number {
  if (c.paid) return 0;
  if (c.type === 'variable') return c.variableHigh ?? c.amount;
  return c.amount;
}

/**
 * This cycle's contribution to a sinking fund:
 *   (target − reservedBalance) / cyclesUntilDue
 * Recomputed each cycle so it self-corrects if you start late or miss one.
 * `cyclesUntilDue <= 0` (due now) → fund whatever shortfall remains this cycle.
 * Never negative (an over-funded pot doesn't hand money back here).
 */
export function perCycleReserve(sf: SinkingFund): number {
  const shortfall = sf.target - sf.reservedBalance;
  if (shortfall <= 0) return 0;
  if (sf.cyclesUntilDue <= 0) return round2(shortfall);
  return round2(shortfall / sf.cyclesUntilDue);
}

/**
 * Recent daily burn from FLOW only — lumps and commitments are excluded, so a
 * one-off purchase or paying a bill never bends the rate. Returns `null` when
 * there isn't enough flow history yet (cold start) so the caller never fakes a
 * runway date or divides by zero.
 */
export function computeDailyFlowRate(
  transactions: EngineTransaction[],
  windowDays: number | undefined,
): number | null {
  if (!windowDays || windowDays <= 0) return null;
  const flowTotal = transactions
    .filter((t) => t.kind === 'flow')
    .reduce((sum, t) => sum + t.amount, 0);
  if (flowTotal <= 0) return null;
  return round2(flowTotal / windowDays);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/**
 * The heart of Runway. Pure: same input → same output, no I/O.
 *
 *   cash_in_hand   = confirmed_income − actual_spend            (all kinds)
 *   remaining      = Σ unpaid MONTHLY commitments               (variable → high)
 *   cycle_reserve  = Σ per-cycle reserve for sinking funds
 *   spendable_pool = cash_in_hand − remaining − cycle_reserve − floor
 *   runway_date    = today + spendable_pool / flow_rate         (flow-only)
 */
export function computeSafeToSpend(input: EngineInput): EngineResult {
  const actualSpend = input.transactions.reduce((sum, t) => sum + t.amount, 0);
  const cashInHand = round2(input.confirmedIncome - actualSpend);

  const remainingCommitments = round2(
    input.monthlyCommitments.reduce((sum, c) => sum + remainingCommitmentAmount(c), 0),
  );

  const cycleReserve = round2(
    input.sinkingFunds.reduce((sum, sf) => sum + perCycleReserve(sf), 0),
  );

  const openingBuffer = input.openingBuffer ?? 0;
  const spendablePool = round2(
    cashInHand + openingBuffer - remainingCommitments - cycleReserve - input.floor,
  );

  const dailyFlowRate =
    input.flowRate !== undefined
      ? input.flowRate
      : computeDailyFlowRate(input.transactions, input.flowRateWindowDays);

  let runwayDays: number | null = null;
  let runwayDate: Date | null = null;
  let status: EngineResult['status'] = 'ok';

  if (dailyFlowRate === null || dailyFlowRate <= 0) {
    // No reliable burn rate yet — show the pool, not a fabricated date.
    status = 'learning_pace';
  } else {
    runwayDays = round2(spendablePool / dailyFlowRate);
    runwayDate = addDays(input.today, runwayDays);
  }

  return {
    cashInHand,
    remainingCommitments,
    cycleReserve,
    floor: round2(input.floor),
    spendablePool,
    dailyFlowRate,
    runwayDays,
    runwayDate,
    status,
  };
}
