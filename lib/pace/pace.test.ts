import { describe, it, expect } from 'vitest';
import { computePace, type PriorCycleFlow, type FlowEvent } from './pace';

const DAY = 86_400_000;
const BASE = new Date('2026-01-01T00:00:00Z').getTime();

// A front-loaded 30-day cycle: 4000 on day 0, 3000 on day 15, 3000 on day 29 → 10000.
function frontLoaded(startMs: number): PriorCycleFlow {
  return {
    startMs,
    endMs: startMs + 30 * DAY,
    flows: [
      { atMs: startMs, amount: 4000 },
      { atMs: startMs + 15 * DAY, amount: 3000 },
      { atMs: startMs + 29 * DAY, amount: 3000 },
    ],
  };
}

const priors: PriorCycleFlow[] = [frontLoaded(BASE), frontLoaded(BASE + 40 * DAY), frontLoaded(BASE + 80 * DAY)];
const currentStartMs = BASE + 120 * DAY;
const halfway = currentStartMs + 15 * DAY; // progress 0.5
// normal cumulative at p=0.5 = 4000+3000 = 7000; normalFinal = 10000.

function current(amounts: FlowEvent[]) {
  return { now: halfway, currentStartMs, cycleLengthMs: 30 * DAY, currentFlows: amounts, priorCycles: priors };
}

describe('computePace', () => {
  it('stays in "learning" until there are enough comparable cycles', () => {
    const r = computePace({ ...current([{ atMs: currentStartMs, amount: 9000 }]), priorCycles: priors.slice(0, 2) });
    expect(r.status).toBe('learning');
    expect(r.speak).toBe(false);
  });

  it('is silent too early in the cycle', () => {
    const r = computePace({
      now: currentStartMs + 2 * DAY,
      currentStartMs,
      cycleLengthMs: 30 * DAY,
      currentFlows: [{ atMs: currentStartMs, amount: 5000 }],
      priorCycles: priors,
    });
    expect(r.status).toBe('too_early');
    expect(r.speak).toBe(false);
  });

  it('speaks when materially ahead of the normal curve', () => {
    const r = computePace(current([{ atMs: currentStartMs, amount: 9000 }]));
    // projected = 9000 * 10000/7000 ≈ 12857 → ~28% over → speak
    expect(r.speak).toBe(true);
    expect(r.projectedFinal).toBeGreaterThan(12000);
    expect(r.normalFinal).toBe(10000);
  });

  it('stays silent when on track to a normal finish', () => {
    const r = computePace(current([{ atMs: currentStartMs, amount: 7000 }]));
    expect(r.speak).toBe(false);
    expect(r.projectedFinal).toBe(10000);
  });

  it('does not cry wolf for spending a little under normal', () => {
    const r = computePace(current([{ atMs: currentStartMs, amount: 6800 }]));
    expect(r.speak).toBe(false);
  });
});
