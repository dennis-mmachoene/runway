import type { Category } from '@/lib/categories';

/**
 * How a bank statement line is treated. The three "breakers" the build doc
 * calls out have first-class types so they can never be mis-counted:
 *  - refund          → a credit that is NOT income; nets against a spend category
 *  - transfer        → savings ↔ current; NEITHER income NOR spend (excluded)
 *  - cash_withdrawal → one outflow, attributed to category `cash`
 */
export type LineType = 'spend' | 'income' | 'refund' | 'transfer' | 'cash_withdrawal';

/** A parsed statement row. `amount` is signed: negative = outflow, positive = inflow. */
export interface StatementLine {
  date: string; // ISO yyyy-mm-dd
  description: string;
  amount: number;
}

/** A statement line after classification + matching, ready for owner review. */
export interface AnalyzedLine extends StatementLine {
  id: string; // stable client key
  type: LineType;
  category: Category;
  matchedTxId: string | null;
}

/** Minimal log shape the matcher needs. */
export interface MatchableLog {
  id: string;
  amount: number;
  merchant: string | null;
  logged_at: string;
}
