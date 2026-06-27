import { describe, it, expect } from 'vitest';
import { buildReplay, type ReplayInput } from './replay';

function base(o: Partial<ReplayInput> = {}): ReplayInput {
  return {
    totalFlow: 10000,
    baselineTotalFlow: 10000,
    categories: [],
    daysInCycle: 30,
    daysSpentOn: 23,
    priorCycleCount: 3,
    tag: null,
    ...o,
  };
}

describe('buildReplay', () => {
  it('admits when there is nothing to compare against', () => {
    const r = buildReplay(base({ priorCycleCount: 0, baselineTotalFlow: null, categories: [{ category: 'groceries', amount: 2000, baseline: 0 }] }));
    expect(r.enoughData).toBe(false);
    expect(r.verdict).toBeNull();
    expect(r.headline).toContain('first month');
  });

  it('ranks beats by surprise, not size, and attaches tag context', () => {
    const r = buildReplay(
      base({
        tag: 'family visit',
        categories: [
          { category: 'bills', amount: 8000, baseline: 8000 }, // big but no surprise → not a beat
          { category: 'eating_out', amount: 1600, baseline: 1000 }, // +60% surprise
          { category: 'transport', amount: 400, baseline: 900 }, // down
        ],
      }),
    );
    expect(r.beats[0].text).toContain('Eating out');
    expect(r.beats[0].text).toContain('above your usual');
    expect(r.beats[0].text).toContain('family visit');
    expect(r.beats.some((b) => b.text.includes('bills') || b.text.includes('Bills'))).toBe(false);
  });

  it('commits to a verdict and always ends forward', () => {
    const lean = buildReplay(base({ totalFlow: 8000 }));
    expect(lean.headline).toContain('Solid month');
    expect(lean.verdict).toBe('One of your leaner months.');
    expect(lean.forward.length).toBeGreaterThan(0);
  });

  it('names a trend when a streak is supplied', () => {
    const r = buildReplay(base({ trendStreak: { category: 'groceries', cycles: 4 } }));
    expect(r.trend).toBe('Groceries up 4 cycles straight.');
  });

  it('always surfaces one uncanny, specific fact', () => {
    expect(buildReplay(base({ daysSpentOn: 23, daysInCycle: 30 })).uncanny).toBe('You spent on 23 of 30 days.');
  });
});
