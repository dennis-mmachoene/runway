import type { Category } from '@/lib/categories';
import { formatZAR } from '@/lib/format';

export interface CategorySpend {
  category: Category;
  amount: number;
  /** Median for this category across comparable prior cycles. */
  baseline: number;
}

export interface ReplayInput {
  totalFlow: number;
  /** Median total flow across comparable prior cycles, or null if none. */
  baselineTotalFlow: number | null;
  categories: CategorySpend[];
  daysInCycle: number;
  daysSpentOn: number;
  priorCycleCount: number;
  tag: string | null;
  /** A category trending up for N consecutive cycles (>= 3 to be worth naming). */
  trendStreak?: { category: Category; cycles: number } | null;
}

export interface Beat {
  text: string;
  deltaPct: number;
  direction: 'up' | 'down';
}

export interface ReplayStory {
  enoughData: boolean;
  headline: string;
  beats: Beat[];
  verdict: string | null;
  trend: string | null;
  forward: string;
  uncanny: string;
}

const MATERIAL_RAND = 100;
const MATERIAL_PCT = 0.2;

function label(c: Category): string {
  const s = c.replace('_', ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * The month's story — ranked by SURPRISE (deviation from your normal), not size.
 * Three layers: a one-line headline, 3–4 beats, then a committed verdict, a
 * trend, a forward look, and one true uncanny fact. Admits when data is thin.
 */
export function buildReplay(input: ReplayInput): ReplayStory {
  const enoughData = input.priorCycleCount >= 1 && input.baselineTotalFlow != null;
  const uncanny = `You spent on ${input.daysSpentOn} of ${input.daysInCycle} days.`;

  if (!enoughData) {
    const top = [...input.categories]
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4)
      .map<Beat>((c) => ({
        text: `${label(c.category)}: ${formatZAR(c.amount)}.`,
        deltaPct: 0,
        direction: 'up',
      }));
    return {
      enoughData: false,
      headline: "Your first month — here's what happened. Nothing to compare against yet.",
      beats: top,
      verdict: null,
      trend: null,
      forward: 'Log another cycle and Runway can start telling the real story.',
      uncanny,
    };
  }

  const base = input.baselineTotalFlow as number;

  const beats: Beat[] = input.categories
    .map((c) => {
      const delta = c.amount - c.baseline;
      const pct = c.baseline > 0 ? delta / c.baseline : c.amount > 0 ? 1 : 0;
      return { c, delta, pct };
    })
    .filter((x) => Math.abs(x.delta) >= MATERIAL_RAND && Math.abs(x.pct) >= MATERIAL_PCT)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 4)
    .map((x) => {
      const up = x.delta > 0;
      const ctx = up && input.tag ? ` (lines up with the ${input.tag})` : '';
      return {
        text: `${label(x.c.category)} ran ${up ? 'high' : 'low'} — ${Math.abs(Math.round(x.pct * 100))}% ${up ? 'above' : 'below'} your usual${ctx}.`,
        deltaPct: Math.round(x.pct * 100) / 100,
        direction: up ? ('up' as const) : ('down' as const),
      };
    });

  let headline: string;
  if (input.totalFlow <= base * 0.95) {
    headline = `Solid month — flow came in under your usual${input.tag ? `, even with the ${input.tag}` : ''}.`;
  } else if (input.totalFlow >= base * 1.1) {
    headline = 'A heavier month — flow ran above your usual.';
  } else {
    headline = 'A steady month — flow landed about where it usually does.';
  }

  let verdict: string;
  if (input.totalFlow <= base * 0.9) verdict = 'One of your leaner months.';
  else if (input.totalFlow >= base * 1.15) verdict = 'One of your heavier months.';
  else verdict = 'A typical month, all told.';

  const trend =
    input.trendStreak && input.trendStreak.cycles >= 3
      ? `${label(input.trendStreak.category)} up ${input.trendStreak.cycles} cycles straight.`
      : null;

  const topUp = beats.find((b) => b.direction === 'up');
  let forward: string;
  if (input.totalFlow <= base * 0.95) forward = 'Keep this up and your buffer keeps growing.';
  else if (topUp) {
    const cat = topUp.text.split(' ')[0];
    forward = `Ease off ${cat.toLowerCase()} next cycle and you're back to normal.`;
  } else forward = 'Hold this line and next month looks much the same.';

  return { enoughData: true, headline, beats, verdict, trend, forward, uncanny };
}
