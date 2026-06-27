import { formatZAR } from '@/lib/format';

/** A flow event: when it happened (ms) and how much. Flow only — no lumps/commitments. */
export interface FlowEvent {
  atMs: number;
  amount: number;
}

/** A completed, comparable (untagged) prior cycle and its flow events. */
export interface PriorCycleFlow {
  startMs: number;
  endMs: number;
  flows: FlowEvent[];
}

export interface PaceInput {
  now: number;
  currentStartMs: number;
  /** Expected length of the current cycle (median of prior lengths). */
  cycleLengthMs: number;
  currentFlows: FlowEvent[];
  /** Comparable prior cycles (tagged ones already excluded). */
  priorCycles: PriorCycleFlow[];
}

export type PaceStatus = 'learning' | 'too_early' | 'ok';

export interface PaceResult {
  status: PaceStatus;
  /** Whether to actually surface the pace line. Silence is a feature. */
  speak: boolean;
  progress: number; // 0..1 through the cycle
  spentSoFar: number;
  projectedFinal: number | null;
  normalFinal: number | null;
  pctOver: number | null;
  message: string | null;
}

const MIN_BASELINE_CYCLES = 3; // first 2–3 cycles: "still learning your normal"
const MIN_PROGRESS = 0.25; // shut up early
const MATERIAL = 0.15; // 15% off normal before it's worth a word
const MAX_ACTIONABLE_PROGRESS = 0.9; // too late to change course near the end

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Cumulative flow spent by progress fraction `p` within a cycle. */
export function cumulativeAtProgress(cycle: PriorCycleFlow, p: number): number {
  const len = cycle.endMs - cycle.startMs;
  if (len <= 0) return 0;
  return cycle.flows
    .filter((f) => (f.atMs - cycle.startMs) / len <= p)
    .reduce((sum, f) => sum + f.amount, 0);
}

/**
 * "Spending faster than normal?" — compared to where you NORMALLY are at this
 * point in the cycle (a curve, not a flat line), built from the median of
 * comparable cycles. Speaks only when confident + material + actionable.
 */
export function computePace(input: PaceInput): PaceResult {
  const { now, currentStartMs, cycleLengthMs, currentFlows, priorCycles } = input;
  const progress = clamp((now - currentStartMs) / cycleLengthMs, 0, 1);
  const spentSoFar = round2(
    currentFlows.filter((f) => f.atMs <= now).reduce((sum, f) => sum + f.amount, 0),
  );

  const silent = (status: PaceStatus, message: string | null = null): PaceResult => ({
    status,
    speak: false,
    progress,
    spentSoFar,
    projectedFinal: null,
    normalFinal: null,
    pctOver: null,
    message,
  });

  if (priorCycles.length < MIN_BASELINE_CYCLES) return silent('learning', 'Still learning your normal.');
  if (progress < MIN_PROGRESS) return silent('too_early');

  const normalAtP = median(priorCycles.map((c) => cumulativeAtProgress(c, progress)));
  const normalFinal = median(priorCycles.map((c) => c.flows.reduce((s, f) => s + f.amount, 0)));
  if (normalAtP <= 0 || normalFinal <= 0) return silent('too_early');

  const projectedFinal = round2((spentSoFar * normalFinal) / normalAtP);
  const pctOver = (projectedFinal - normalFinal) / normalFinal;

  const material = Math.abs(pctOver) >= MATERIAL;
  const actionable = progress <= MAX_ACTIONABLE_PROGRESS;
  const ahead = pctOver > 0;

  if (ahead && material && actionable) {
    return {
      status: 'ok',
      speak: true,
      progress,
      spentSoFar,
      projectedFinal,
      normalFinal,
      pctOver,
      message: `You're ${Math.round(progress * 100)}% through the cycle with ${formatZAR(spentSoFar)} of flow spent — on pace to finish around ${formatZAR(projectedFinal)} vs your usual ${formatZAR(normalFinal)}.`,
    };
  }

  return {
    status: 'ok',
    speak: false,
    progress,
    spentSoFar,
    projectedFinal,
    normalFinal,
    pctOver,
    message: null,
  };
}
