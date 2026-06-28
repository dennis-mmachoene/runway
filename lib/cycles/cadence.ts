/**
 * Estimate the user's pay cadence — the expected length of a cycle — purely from
 * the dates past cycles actually started. A cycle is income-to-income, so the
 * gaps between consecutive cycle starts ARE the cadence. No assumption is baked
 * in beyond a monthly fallback when there isn't enough history yet, and the
 * result is clamped to a sane weekly..quarterly band so one odd gap can't make
 * the gauge lie about how far away the next income is.
 */

const MS_PER_DAY = 86_400_000;
const DEFAULT_CYCLE_DAYS = 30; // monthly, the conventional fallback
const MIN_CYCLE_DAYS = 7;
const MAX_CYCLE_DAYS = 92;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * @param cycleStarts dates that opened a cycle (any order). Needs ≥2 to measure
 *   a gap; otherwise the monthly fallback is returned.
 */
export function estimateCycleDays(cycleStarts: Array<Date | string | number>): number {
  const ms = cycleStarts
    .map((d) => (d instanceof Date ? d.getTime() : new Date(d).getTime()))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  const gaps: number[] = [];
  for (let i = 1; i < ms.length; i++) {
    const days = (ms[i] - ms[i - 1]) / MS_PER_DAY;
    if (days > 0) gaps.push(days);
  }
  if (!gaps.length) return DEFAULT_CYCLE_DAYS;

  const est = Math.round(median(gaps));
  return Math.min(MAX_CYCLE_DAYS, Math.max(MIN_CYCLE_DAYS, est));
}
