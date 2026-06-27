import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Commitment, IncomeEvent, TransactionRow } from '@/lib/db/types';
import type { EngineResult } from '@/lib/engine/types';
import { formatZAR } from '@/lib/format';
import type { DiffSummary } from './greeting';

const ON_TRACK_DAYS = 7;

function isOnTrack(result: EngineResult | null): boolean {
  if (!result || result.status !== 'ok') return false;
  if (result.spendablePool < 0) return false;
  return result.runwayDays == null || result.runwayDays > ON_TRACK_DAYS;
}

/** Build the "since you last looked" summary from changes after `lastSeen`. */
export async function getDiffSummary(
  supabase: SupabaseClient,
  lastSeen: Date | null,
  result: EngineResult | null,
): Promise<DiffSummary> {
  const learning = result?.status === 'learning_pace';
  const onTrack = isOnTrack(result);

  if (!lastSeen) {
    return {
      firstLook: true,
      incomeConfirmedCount: 0,
      commitmentsPaidCount: 0,
      flowSpent: 0,
      notable: [],
      onTrack,
      learning,
    };
  }

  const iso = lastSeen.toISOString();
  const [incRes, txRes] = await Promise.all([
    supabase.from('income_events').select('*').gt('created_at', iso).eq('is_confirmed', true),
    supabase.from('transactions').select('*').gt('created_at', iso),
  ]);
  const income = (incRes.data as IncomeEvent[]) ?? [];
  const txs = (txRes.data as TransactionRow[]) ?? [];

  const flowSpent = txs
    .filter((t) => t.kind === 'flow')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const commitmentTxs = txs.filter((t) => t.kind === 'commitment' && t.commitment_id);

  const notable: string[] = [];
  if (commitmentTxs.length) {
    const ids = Array.from(new Set(commitmentTxs.map((t) => t.commitment_id as string)));
    const { data: cData } = await supabase.from('commitments').select('*').in('id', ids);
    const byId = new Map(((cData as Commitment[]) ?? []).map((c) => [c.id, c]));
    for (const t of commitmentTxs) {
      const c = byId.get(t.commitment_id as string);
      if (c && c.type === 'variable' && c.variable_high != null) {
        const under = Number(c.variable_high) - Number(t.amount);
        if (under > 0) notable.push(`${c.name} came in ${formatZAR(under)} under — back in your pocket.`);
      }
    }
  }

  return {
    firstLook: false,
    incomeConfirmedCount: income.length,
    commitmentsPaidCount: commitmentTxs.length,
    flowSpent: Math.round(flowSpent * 100) / 100,
    notable,
    onTrack,
    learning,
  };
}
