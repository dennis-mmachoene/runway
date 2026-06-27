import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Cycle } from '@/lib/db/types';
import { CATEGORIES, type Category } from '@/lib/categories';
import { buildReplay, type CategorySpend, type ReplayStory } from './replay';

const DAY = 86_400_000;
const MAX_PRIORS = 6;

interface FlowRow {
  amount: number;
  category: Category;
  logged_at: string;
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function sumByCategory(rows: FlowRow[]): Map<Category, number> {
  const m = new Map<Category, number>();
  for (const r of rows) m.set(r.category, (m.get(r.category) ?? 0) + Number(r.amount));
  return m;
}

/** Longest run of consecutive strictly-increasing cycle totals ending at the target. */
function trendStreak(seriesByCat: Map<Category, number[]>): { category: Category; cycles: number } | null {
  let best: { category: Category; cycles: number } | null = null;
  for (const [category, series] of seriesByCat) {
    let steps = 0;
    for (let i = series.length - 1; i > 0; i--) {
      if (series[i] > series[i - 1]) steps++;
      else break;
    }
    if (!best || steps > best.cycles) best = { category, cycles: steps };
  }
  return best && best.cycles >= 3 ? best : null;
}

export interface ReplayResult {
  story: ReplayStory;
  cycleStart: string;
  cycleEnd: string;
}

/** Build the replay for the most recently closed cycle. */
export async function getReplay(supabase: SupabaseClient): Promise<ReplayResult | null> {
  const { data: latestData } = await supabase
    .from('cycles')
    .select('*')
    .eq('status', 'closed')
    .order('start_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const target = latestData as Cycle | null;
  if (!target || !target.start_at || !target.end_at) return null;

  const { data: priorData } = await supabase
    .from('cycles')
    .select('*')
    .eq('status', 'closed')
    .is('tag', null)
    .lt('start_at', target.start_at)
    .order('start_at', { ascending: false })
    .limit(MAX_PRIORS);
  const priors = ((priorData as Cycle[]) ?? []).filter((c) => c.start_at && c.end_at);

  const earliest = priors.length ? priors[priors.length - 1].start_at! : target.start_at;
  const { data: txData } = await supabase
    .from('transactions')
    .select('amount, category, logged_at')
    .eq('kind', 'flow')
    .gte('logged_at', earliest)
    .lte('logged_at', target.end_at);
  const flows = ((txData as FlowRow[]) ?? []).filter((t) => Number(t.amount) > 0);

  const inRange = (c: Cycle) =>
    flows.filter((f) => f.logged_at >= c.start_at! && f.logged_at < c.end_at!);

  const targetFlows = inRange(target);
  const targetByCat = sumByCategory(targetFlows);
  const priorByCat = priors.map((c) => sumByCategory(inRange(c)));

  const categories: CategorySpend[] = CATEGORIES.map((category) => {
    const amount = Math.round((targetByCat.get(category) ?? 0) * 100) / 100;
    const baseValues = priorByCat.map((m) => m.get(category) ?? 0);
    const baseline = priors.length ? Math.round(median(baseValues) * 100) / 100 : 0;
    return { category, amount, baseline };
  }).filter((c) => c.amount > 0 || c.baseline > 0);

  const totalFlow = Math.round(targetFlows.reduce((s, f) => s + Number(f.amount), 0) * 100) / 100;
  const baselineTotalFlow = priors.length
    ? Math.round(median(priors.map((c) => inRange(c).reduce((s, f) => s + Number(f.amount), 0))) * 100) / 100
    : null;

  const daysInCycle = Math.max(
    1,
    Math.round((new Date(target.end_at).getTime() - new Date(target.start_at).getTime()) / DAY),
  );
  const daysSpentOn = new Set(targetFlows.map((f) => f.logged_at.slice(0, 10))).size;

  // Build per-category series across ordered cycles (oldest prior → target) for trend.
  const ordered = [...priors].reverse();
  const seriesByCat = new Map<Category, number[]>();
  for (const category of CATEGORIES) {
    const series = [
      ...ordered.map((c) => sumByCategory(inRange(c)).get(category) ?? 0),
      targetByCat.get(category) ?? 0,
    ];
    if (series.some((v) => v > 0)) seriesByCat.set(category, series);
  }

  const story = buildReplay({
    totalFlow,
    baselineTotalFlow,
    categories,
    daysInCycle,
    daysSpentOn,
    priorCycleCount: priors.length,
    tag: target.tag,
    trendStreak: trendStreak(seriesByCat),
  });

  return { story, cycleStart: target.start_at, cycleEnd: target.end_at };
}
