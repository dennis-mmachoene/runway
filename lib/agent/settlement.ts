import { payeeMatchesStrict } from './merchant';

/**
 * Decides whether an uploaded bill should SETTLE a known commitment (B1).
 *
 * Settling is a strong claim — "this IS your rent" — and getting it wrong
 * overstates safe-to-spend silently. So:
 *  - settle ONLY on a strict payee match;
 *  - if the amount merely coincides with a commitment (±10%) but the payee
 *    isn't a strong match, ASK — never assume;
 *  - otherwise it's ordinary spend.
 */

export interface BillCommitment {
  id: string;
  name: string;
  amount: number;
  variable_high: number | null;
}

export type BillMatch =
  | { kind: 'settle'; commitment: BillCommitment }
  | { kind: 'ask'; commitment: BillCommitment }
  | { kind: 'none' };

function expectedAmount(c: BillCommitment): number {
  return c.variable_high != null ? Number(c.variable_high) : Number(c.amount);
}

export function classifyBill(
  merchant: string | null,
  amount: number,
  commitments: BillCommitment[],
): BillMatch {
  // Strong payee match → settle (the only path that makes the strong claim).
  for (const c of commitments) {
    if (merchant && payeeMatchesStrict(merchant, c.name)) return { kind: 'settle', commitment: c };
  }
  // Amount coincidence without a strong payee → surface it, don't assume.
  for (const c of commitments) {
    const expected = expectedAmount(c);
    if (Math.abs(expected - amount) <= Math.max(5, expected * 0.1)) return { kind: 'ask', commitment: c };
  }
  return { kind: 'none' };
}
