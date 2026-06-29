/**
 * The ask-rule — the agent's character. Confirm money & anything odd; auto-file
 * only the small, clearly-read, unremarkable stuff. The agent NEVER resolves an
 * ambiguity by assuming: when in doubt, it asks Dennis.
 */

export const HIGH_CONFIDENCE = 0.85;

export interface AskRuleInput {
  amount: number;
  amountConfidence: number; // 0..1, how clearly the amount was read
  dateConfidence: number; // 0..1
  lumpThreshold: number; // settings.lump_threshold — the "small" line
  categoryUncertain: boolean;
  isDuplicate: boolean; // likely duplicate of an existing record
  unfamiliarPayee: boolean; // merchant never seen before
  muchLargerThanUsual: boolean; // anomalous vs this merchant's history
  /** Amount coincides with a commitment but the payee isn't a strong match (B1). */
  ambiguousSettlement?: boolean;
}

export type AskReason =
  | 'large_amount'
  | 'low_confidence'
  | 'ambiguous_settlement'
  | 'possible_duplicate'
  | 'unfamiliar_payee'
  | 'anomalous_amount'
  | 'category_uncertain';

export type AskRuleResult = { action: 'auto_file' } | { action: 'ask'; reason: AskReason };

/**
 * Auto-file ONLY when ALL hold: amount ≤ lump_threshold, amount+date read with
 * high confidence, and nothing irregular. Otherwise stop and ask — money first.
 */
export function decideAskRule(input: AskRuleInput): AskRuleResult {
  // B1: a bill whose amount coincides with a commitment but whose payee isn't a
  // strong match must never be silently filed (it could wrongly settle the bill
  // and overstate). Surface it first, with the clearest possible question.
  if (input.ambiguousSettlement) return { action: 'ask', reason: 'ambiguous_settlement' };
  if (input.amount > input.lumpThreshold) return { action: 'ask', reason: 'large_amount' };
  if (input.amountConfidence < HIGH_CONFIDENCE || input.dateConfidence < HIGH_CONFIDENCE) {
    return { action: 'ask', reason: 'low_confidence' };
  }
  if (input.isDuplicate) return { action: 'ask', reason: 'possible_duplicate' };
  if (input.unfamiliarPayee) return { action: 'ask', reason: 'unfamiliar_payee' };
  if (input.muchLargerThanUsual) return { action: 'ask', reason: 'anomalous_amount' };
  if (input.categoryUncertain) return { action: 'ask', reason: 'category_uncertain' };
  return { action: 'auto_file' };
}

/** A specific, one-line question for Dennis — never vague, never alarmist. */
export function questionFor(
  reason: AskReason,
  ctx: { merchant?: string | null; amount: number; formatted: string; commitmentName?: string | null },
): string {
  const who = ctx.merchant?.trim() || 'this payee';
  switch (reason) {
    case 'ambiguous_settlement': {
      const bill = ctx.commitmentName?.trim() || 'one of your bills';
      return `This ${ctx.formatted} is close to your ${bill}. Is it that bill, or a separate purchase? I'll file it as a separate purchase unless you say it's the bill.`;
    }
    case 'large_amount':
      return `This ${who} charge is ${ctx.formatted} — real money. File it as is, or adjust?`;
    case 'low_confidence':
      return `I couldn't read this ${who} receipt cleanly. Is the amount ${ctx.formatted} and the date right?`;
    case 'possible_duplicate':
      return `This looks like a ${ctx.formatted} ${who} charge you may already have. File it anyway, or skip?`;
    case 'unfamiliar_payee':
      return `First time I've seen ${who} (${ctx.formatted}). Want me to file it, and how should I categorise it?`;
    case 'anomalous_amount':
      return `${ctx.formatted} is unusually high for ${who}. Keep it as one charge, or split it?`;
    case 'category_uncertain':
      return `I wasn't sure how to categorise ${who} (${ctx.formatted}). Which bucket should it go in?`;
  }
}
