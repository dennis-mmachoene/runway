/** Row shapes for the Runway tables (mirrors supabase/migrations/0001_init.sql). */
import type { Category } from '@/lib/categories';

export type CommitmentCadence = 'monthly' | 'weekly' | 'annual' | 'custom';
export type CommitmentType = 'fixed' | 'variable';
export type TransactionKind = 'flow' | 'lump' | 'commitment';
export type TransactionSource = 'manual' | 'import';
export type CycleStatus = 'open' | 'closed';
export type SavingsMode = 'automatic' | 'best_effort';
export type LeftoverMode = 'sweep_emergency' | 'roll_buffer';

export interface IncomeEvent {
  id: string;
  user_id: string;
  amount: number;
  event_at: string;
  is_confirmed: boolean;
  source: string | null;
  created_at: string;
}

export interface Commitment {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  cadence: CommitmentCadence;
  due_day: number | null;
  due_date: string | null;
  type: CommitmentType;
  variable_high: number | null;
  reserved_balance: number;
  is_active: boolean;
  created_at: string;
}

export interface TransactionRow {
  id: string;
  user_id: string;
  raw_text: string | null;
  amount: number;
  merchant: string | null;
  category: Category;
  kind: TransactionKind;
  commitment_id: string | null;
  logged_at: string;
  is_reconciled: boolean;
  source: TransactionSource;
  created_at: string;
}

export interface Cycle {
  id: string;
  user_id: string;
  start_event_id: string | null;
  end_event_id: string | null;
  start_at: string | null;
  end_at: string | null;
  status: CycleStatus;
  floor_amount: number;
  tag: string | null;
  created_at: string;
}

export interface Settings {
  user_id: string;
  floor_default: number;
  lump_threshold: number;
  savings_mode: SavingsMode;
  leftover_mode: LeftoverMode;
}
