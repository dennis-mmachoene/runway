/**
 * Types for the safe-to-spend engine. The engine is a PURE function over a
 * snapshot of the open cycle — no DB, no clock, no I/O — so it is fully
 * unit-testable and its four invariants can be proven before any UI exists.
 *
 * All money is in rands (ZAR) as numbers; the engine rounds to cents.
 */

export type TxKind = 'flow' | 'lump' | 'commitment';

export interface EngineTransaction {
  amount: number;
  kind: TxKind;
  loggedAt: Date;
}

/** A monthly commitment due in the current cycle. */
export interface MonthlyCommitment {
  amount: number;
  type: 'fixed' | 'variable';
  /** Pessimistic reserve used while a VARIABLE bill is unpaid. */
  variableHigh?: number | null;
  /** Whether this commitment has been paid this cycle. */
  paid: boolean;
}

/** A non-monthly commitment funded gradually via a sinking pot. */
export interface SinkingFund {
  /** Total amount needed by the due date. */
  target: number;
  /** Already set aside. */
  reservedBalance: number;
  /** Cycles remaining until due (0 = due now). */
  cyclesUntilDue: number;
}

export interface EngineInput {
  today: Date;
  /** Sum of CONFIRMED income in the cycle (cash in hand). Never expected income. */
  confirmedIncome: number;
  /** All transactions in the cycle (flow + lump + commitment). */
  transactions: EngineTransaction[];
  /** Monthly commitments due this cycle. */
  monthlyCommitments: MonthlyCommitment[];
  /** Non-monthly sinking funds. */
  sinkingFunds: SinkingFund[];
  /** The floor — safe-to-spend is what's left above it. */
  floor: number;
  /**
   * Window (in days) over which the recent flow rate is averaged. Used only when
   * `flowRate` is not supplied. Must be > 0 to produce a rate.
   */
  flowRateWindowDays?: number;
  /**
   * Optional explicit daily flow rate (flow-only). If provided, it overrides the
   * computed one. `null` means "no rate yet" (cold start).
   */
  flowRate?: number | null;
}

export type EngineStatus = 'ok' | 'learning_pace';

export interface EngineResult {
  cashInHand: number;
  remainingCommitments: number;
  cycleReserve: number;
  floor: number;
  spendablePool: number;
  /** Flow-only daily burn. `null` at cold start. */
  dailyFlowRate: number | null;
  /** Days of runway left at the current flow rate. `null` at cold start. */
  runwayDays: number | null;
  /** The honest hero number: the date you hit your floor. `null` at cold start. */
  runwayDate: Date | null;
  status: EngineStatus;
}
