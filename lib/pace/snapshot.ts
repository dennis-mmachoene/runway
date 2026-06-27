import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Cycle } from '@/lib/db/types';
import { getOpenCycle } from '@/lib/cycles';
import { computePace, type FlowEvent, type PaceResult, type PriorCycleFlow } from './pace';

const DAY = 86_400_000;
const MAX_PRIORS = 6;

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Assemble pace input from closed, untagged cycles and flow-only spend. */
export async function getPace(supabase: SupabaseClient): Promise<PaceResult | null> {
  const open = await getOpenCycle(supabase);
  if (!open || !open.start_at) return null;

  const { data: closedData } = await supabase
    .from('cycles')
    .select('*')
    .eq('status', 'closed')
    .is('tag', null) // exclude tagged ("family visiting") cycles from the baseline
    .order('start_at', { ascending: false })
    .limit(MAX_PRIORS);
  const closed = ((closedData as Cycle[]) ?? []).filter((c) => c.start_at && c.end_at);

  const earliest = closed.length ? closed[closed.length - 1].start_at! : open.start_at;
  const { data: txData } = await supabase
    .from('transactions')
    .select('amount, kind, logged_at')
    .eq('kind', 'flow')
    .gte('logged_at', earliest);

  const flows: FlowEvent[] = ((txData as { amount: number; logged_at: string }[]) ?? [])
    .filter((t) => Number(t.amount) > 0)
    .map((t) => ({ atMs: new Date(t.logged_at).getTime(), amount: Number(t.amount) }));

  const priorCycles: PriorCycleFlow[] = closed.map((c) => {
    const startMs = new Date(c.start_at!).getTime();
    const endMs = new Date(c.end_at!).getTime();
    return { startMs, endMs, flows: flows.filter((f) => f.atMs >= startMs && f.atMs < endMs) };
  });

  const currentStartMs = new Date(open.start_at).getTime();
  const currentFlows = flows.filter((f) => f.atMs >= currentStartMs);
  const priorLengths = priorCycles.map((c) => c.endMs - c.startMs).filter((l) => l > 0);
  const cycleLengthMs = priorLengths.length ? median(priorLengths) : 30 * DAY;

  return computePace({
    now: Date.now(),
    currentStartMs,
    cycleLengthMs,
    currentFlows,
    priorCycles,
  });
}
