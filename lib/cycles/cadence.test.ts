import { describe, it, expect } from 'vitest';
import { estimateCycleDays } from './cadence';

const day = (iso: string) => new Date(iso);

describe('estimateCycleDays', () => {
  it('falls back to monthly with no history', () => {
    expect(estimateCycleDays([])).toBe(30);
    expect(estimateCycleDays([day('2026-06-01')])).toBe(30); // one start = no gap
  });

  it('measures a roughly-monthly cadence from real gaps', () => {
    // gaps: 30, 31, 30 → median 30
    const starts = [day('2026-03-01'), day('2026-03-31'), day('2026-05-01'), day('2026-05-31')];
    expect(estimateCycleDays(starts)).toBe(30);
  });

  it('detects a weekly cadence', () => {
    const starts = [day('2026-06-01'), day('2026-06-08'), day('2026-06-15')];
    expect(estimateCycleDays(starts)).toBe(7);
  });

  it('uses the median so one odd gap does not dominate', () => {
    // gaps: 30, 30, 90 → median 30, not the mean (50)
    const starts = [day('2026-01-01'), day('2026-01-31'), day('2026-03-02'), day('2026-05-31')];
    expect(estimateCycleDays(starts)).toBe(30);
  });

  it('clamps an absurd gap into the sane band', () => {
    const starts = [day('2025-01-01'), day('2026-01-01')]; // ~365d gap
    expect(estimateCycleDays(starts)).toBe(92);
  });

  it('is order-independent', () => {
    const a = estimateCycleDays([day('2026-06-15'), day('2026-06-01'), day('2026-06-08')]);
    const b = estimateCycleDays([day('2026-06-01'), day('2026-06-08'), day('2026-06-15')]);
    expect(a).toBe(b);
  });
});
