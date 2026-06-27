import type { Category } from '@/lib/categories';
import type { LineType, StatementLine } from './types';

const TRANSFER = /\b(transfer|xfer|tfr|to savings|from savings|inter[- ]?account|own account)\b/i;
const CASH = /\b(atm|cash withdrawal|cash wdl|geldoutomaat|withdrawal)\b/i;
const REFUND = /\b(refund|reversal|return|chargeback|credit reversal)\b/i;
const INCOME = /\b(salary|wage|payroll|income|disbursement)\b/i;

export interface Classification {
  type: LineType;
  category: Category;
}

/**
 * Propose a type for a statement line. The owner can override in the UI, but the
 * defaults must never lie in the income direction: clearly-labelled transfers
 * and refunds are kept OUT of income; ambiguous credits default to `refund`
 * (which nets against spend) rather than inflating income.
 */
export function classifyLine(line: StatementLine): Classification {
  const desc = line.description.toLowerCase();
  const inflow = line.amount > 0;

  if (TRANSFER.test(desc)) return { type: 'transfer', category: 'other' };
  if (inflow && REFUND.test(desc)) return { type: 'refund', category: 'other' };
  if (inflow && INCOME.test(desc)) return { type: 'income', category: 'other' };
  if (!inflow && CASH.test(desc)) return { type: 'cash_withdrawal', category: 'cash' };

  if (inflow) return { type: 'refund', category: 'other' }; // ambiguous credit → not income
  return { type: 'spend', category: 'other' };
}
