import { perCycleReserve, round2 } from '@/lib/engine/safe-to-spend';

/** A sinking fund as it stands when its cycle closes. */
export interface ClosingSinkingFund {
  target: number;
  reservedBalance: number;
  cyclesUntilDue: number;
  isDue: boolean;
}

export interface SinkingOutcome {
  /** New reserved_balance after this cycle's accrual (and payout if due). */
  reservedBalance: number;
  /** Amount drawn from the pot to settle the bill (0 if not due). */
  payout: number;
}

/**
 * Close a sinking fund for the cycle: first accrue this cycle's reserve into the
 * pot (the fill side that was previously only computed, never persisted), then —
 * if the bill is due — pay it FROM the pot and reset for the next period.
 */
export function closeSinkingFund(fund: ClosingSinkingFund): SinkingOutcome {
  const accrual = perCycleReserve({
    target: fund.target,
    reservedBalance: fund.reservedBalance,
    cyclesUntilDue: fund.cyclesUntilDue,
  });
  let reservedBalance = round2(fund.reservedBalance + accrual);
  let payout = 0;
  if (fund.isDue) {
    payout = round2(Math.min(reservedBalance, fund.target));
    reservedBalance = round2(reservedBalance - payout);
  }
  return { reservedBalance, payout };
}

/**
 * Leftover at cycle close = unspent money above the floor. Never negative: an
 * overspent cycle carries nothing forward (the shortfall is its own story).
 */
export function computeLeftover(spendablePool: number): number {
  return round2(Math.max(0, spendablePool));
}
