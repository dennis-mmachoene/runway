import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Commitment, TransactionRow } from '@/lib/db/types';
import { getSafeToSpend } from '@/lib/engine/snapshot';
import { getPace } from '@/lib/pace/snapshot';
import { getOpenCycle, getSettings } from '@/lib/cycles';
import { detectSubscriptions, type SubscriptionInput } from '@/lib/subscriptions/detect';

const DAY = 86_400_000;

/** Compact, structured snapshot of everything Runway knows — the grounding data. */
export async function buildModelContext(supabase: SupabaseClient): Promise<Record<string, unknown>> {
  const [result, pace, settings, open] = await Promise.all([
    getSafeToSpend(supabase),
    getPace(supabase),
    getSettings(supabase),
    getOpenCycle(supabase),
  ]);

  const yearAgo = new Date(Date.now() - 365 * DAY).toISOString();
  const { data: txData } = await supabase
    .from('transactions')
    .select('amount, merchant, category, kind, logged_at')
    .gte('logged_at', yearAgo)
    .order('logged_at', { ascending: false })
    .limit(400);
  const txs = (txData as Pick<TransactionRow, 'amount' | 'merchant' | 'category' | 'kind' | 'logged_at'>[]) ?? [];

  const { data: commitData } = await supabase
    .from('commitments')
    .select('name, amount, cadence, type, variable_high')
    .eq('is_active', true);
  const commitments = (commitData as Pick<Commitment, 'name' | 'amount' | 'cadence' | 'type' | 'variable_high'>[]) ?? [];

  const subs = detectSubscriptions(
    txs.map<SubscriptionInput>((t) => ({
      merchant: t.merchant,
      amount: Number(t.amount),
      logged_at: t.logged_at,
      kind: t.kind,
    })),
  );

  // This-cycle spend by category.
  const cycleByCategory: Record<string, number> = {};
  if (open?.start_at) {
    for (const t of txs) {
      if (t.logged_at >= open.start_at && t.kind !== 'commitment' && Number(t.amount) > 0) {
        cycleByCategory[t.category] = (cycleByCategory[t.category] ?? 0) + Number(t.amount);
      }
    }
  }

  return {
    today: new Date().toISOString().slice(0, 10),
    currency: 'ZAR',
    cycle: open?.start_at
      ? { startedOn: open.start_at.slice(0, 10), floor: Number(open.floor_amount) }
      : null,
    safeToSpend: result
      ? {
          pool: result.spendablePool,
          runwayDate: result.runwayDate ? result.runwayDate.toISOString().slice(0, 10) : null,
          runwayDays: result.runwayDays,
          status: result.status,
          cashInHand: result.cashInHand,
          remainingCommitments: result.remainingCommitments,
          setAside: result.cycleReserve,
          floor: result.floor,
          dailyFlowRate: result.dailyFlowRate,
        }
      : null,
    pace: pace
      ? { status: pace.status, projectedFinal: pace.projectedFinal, normalFinal: pace.normalFinal }
      : null,
    settings: {
      floorDefault: settings.floor_default,
      lumpThreshold: settings.lump_threshold,
      savingsMode: settings.savings_mode,
      leftoverMode: settings.leftover_mode,
    },
    commitments: commitments.map((c) => ({
      name: c.name,
      amount: Number(c.amount),
      cadence: c.cadence,
      type: c.type,
      variableHigh: c.variable_high != null ? Number(c.variable_high) : null,
    })),
    subscriptions: subs.map((s) => ({ merchant: s.merchant, monthlyAmount: s.monthlyAmount })),
    thisCycleByCategory: cycleByCategory,
    recentTransactions: txs.map((t) => ({
      date: t.logged_at.slice(0, 10),
      merchant: t.merchant,
      amount: Number(t.amount),
      category: t.category,
      kind: t.kind,
    })),
  };
}
