import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Commitment, IncomeEvent, TransactionRow } from '@/lib/db/types';
import type {
  EngineInput,
  EngineResult,
  MonthlyCommitment,
  SinkingFund,
} from '@/lib/engine/types';
import { computeSafeToSpend } from '@/lib/engine/safe-to-spend';
import { getOpenCycle } from '@/lib/cycles';

const MS_PER_DAY = 86_400_000;

/** Commitments that recur within (or each) cycle live in remaining_commitments. */
const MONTHLY_CADENCES = new Set(['monthly', 'weekly']);

function cyclesUntilDue(dueDate: string | null): number {
  if (!dueDate) return 1;
  const days = (new Date(dueDate).getTime() - Date.now()) / MS_PER_DAY;
  return Math.max(1, Math.round(days / 30)); // approx: ~monthly cycles
}

/**
 * Assemble the engine input from the open cycle. Returns null if there is no
 * open cycle yet. Exported so simulation can reuse the EXACT same input the live
 * gauge runs on — a scenario can never contradict the live number.
 */
export async function buildEngineInput(supabase: SupabaseClient): Promise<EngineInput | null> {
  const cycle = await getOpenCycle(supabase);
  if (!cycle || !cycle.start_at) return null;

  const startAt = cycle.start_at;

  const [incomeRes, txRes, commitRes] = await Promise.all([
    supabase.from('income_events').select('*').gte('event_at', startAt),
    supabase.from('transactions').select('*').gte('logged_at', startAt),
    supabase.from('commitments').select('*').eq('is_active', true),
  ]);

  const income = (incomeRes.data as IncomeEvent[]) ?? [];
  const transactions = (txRes.data as TransactionRow[]) ?? [];
  const commitments = (commitRes.data as Commitment[]) ?? [];

  const confirmedIncome = income
    .filter((i) => i.is_confirmed)
    .reduce((sum, i) => sum + Number(i.amount), 0);

  const paidCommitmentIds = new Set(
    transactions
      .filter((t) => t.kind === 'commitment' && t.commitment_id)
      .map((t) => t.commitment_id as string),
  );

  const monthlyCommitments: MonthlyCommitment[] = commitments
    .filter((c) => MONTHLY_CADENCES.has(c.cadence))
    .map((c) => ({
      amount: Number(c.amount),
      type: c.type,
      variableHigh: c.variable_high != null ? Number(c.variable_high) : null,
      paid: paidCommitmentIds.has(c.id),
    }));

  const sinkingFunds: SinkingFund[] = commitments
    .filter((c) => !MONTHLY_CADENCES.has(c.cadence))
    .map((c) => ({
      target: Number(c.amount),
      reservedBalance: Number(c.reserved_balance),
      cyclesUntilDue: cyclesUntilDue(c.due_date),
    }));

  const today = new Date();
  const daysElapsed = Math.max(1, Math.round((today.getTime() - new Date(startAt).getTime()) / MS_PER_DAY));
  const engineTx = transactions.map((t) => ({
    amount: Number(t.amount),
    kind: t.kind,
    loggedAt: new Date(t.logged_at),
  }));

  // Recent (trailing-window) flow rate, not a whole-cycle average — so an early,
  // front-loaded cycle doesn't read pessimistically.
  const WINDOW = 10;
  const coveredDays = Math.min(WINDOW, daysElapsed);
  const cutoffMs = today.getTime() - WINDOW * MS_PER_DAY;
  const recentFlow = engineTx
    .filter((t) => t.kind === 'flow' && t.loggedAt.getTime() >= cutoffMs)
    .reduce((sum, t) => sum + t.amount, 0);
  const flowRate = recentFlow > 0 ? Math.round((recentFlow / coveredDays) * 100) / 100 : null;

  const input: EngineInput = {
    today,
    confirmedIncome,
    transactions: engineTx,
    monthlyCommitments,
    sinkingFunds,
    floor: Number(cycle.floor_amount),
    openingBuffer: Number(cycle.opening_buffer ?? 0),
    flowRate,
  };

  return input;
}

/** The live safe-to-spend result, or null when there's no open cycle. */
export async function getSafeToSpend(supabase: SupabaseClient): Promise<EngineResult | null> {
  const input = await buildEngineInput(supabase);
  return input ? computeSafeToSpend(input) : null;
}
