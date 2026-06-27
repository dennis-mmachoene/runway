import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Commitment } from '@/lib/db/types';
import { buildEngineInput } from '@/lib/engine/snapshot';
import { computeSafeToSpend } from '@/lib/engine/safe-to-spend';
import { getOpenCycle, getSettings } from '@/lib/cycles';
import { closeSinkingFund, computeLeftover } from './transition';

const DAY = 86_400_000;
const YEAR = 365 * DAY;
const SINKING = new Set(['annual', 'custom']);

function monthlyApprox(dueDate: string | null, nowMs: number): number {
  if (!dueDate) return 1;
  return Math.max(1, Math.round((new Date(dueDate).getTime() - nowMs) / DAY / 30));
}

interface SinkingUpdate {
  id: string;
  reserved_balance: number;
  due_date: string | null;
}

/**
 * Close the open cycle and open the next, ATOMICALLY (one RPC / one tx). The
 * engine computes the leftover and each sinking fund's accrual/payout here; the
 * RPC only applies the writes — so the math stays single-sourced in TypeScript.
 */
export async function performTransition(
  supabase: SupabaseClient,
  income: { id: string; event_at: string },
): Promise<void> {
  const open = await getOpenCycle(supabase);
  const settings = await getSettings(supabase);

  let openingBuffer = 0;
  let emergencyAdd = 0;
  const sinkingUpdates: SinkingUpdate[] = [];

  if (open) {
    const input = await buildEngineInput(supabase);
    if (input) {
      const leftover = computeLeftover(computeSafeToSpend(input).spendablePool);
      if (settings.leftover_mode === 'roll_buffer') openingBuffer = leftover;
      else emergencyAdd = leftover; // sweep_emergency
    }

    const { data } = await supabase.from('commitments').select('*').eq('is_active', true);
    const commitments = (data as Commitment[]) ?? [];
    const eventMs = new Date(income.event_at).getTime();

    for (const c of commitments) {
      if (!SINKING.has(c.cadence)) continue;
      const isDue = !!c.due_date && new Date(c.due_date).getTime() <= eventMs;
      const outcome = closeSinkingFund({
        target: Number(c.amount),
        reservedBalance: Number(c.reserved_balance),
        cyclesUntilDue: isDue ? 0 : monthlyApprox(c.due_date, eventMs),
        isDue,
      });
      let dueDate = c.due_date;
      if (isDue && c.cadence === 'annual' && c.due_date) {
        dueDate = new Date(new Date(c.due_date).getTime() + YEAR).toISOString().slice(0, 10);
      }
      sinkingUpdates.push({ id: c.id, reserved_balance: outcome.reservedBalance, due_date: dueDate });
    }
  }

  const { error } = await supabase.rpc('transition_cycle', {
    p_income_id: income.id,
    p_event_at: income.event_at,
    p_floor: settings.floor_default ?? 0,
    p_opening_buffer: openingBuffer,
    p_emergency_add: emergencyAdd,
    p_sinking: sinkingUpdates,
  });
  if (error) throw new Error(error.message);
}
