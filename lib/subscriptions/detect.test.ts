import { describe, it, expect } from 'vitest';
import { detectSubscriptions, monthlyTotal, type SubscriptionInput } from './detect';

function tx(merchant: string | null, amount: number, logged_at: string, kind = 'flow'): SubscriptionInput {
  return { merchant, amount, logged_at, kind };
}

describe('detectSubscriptions', () => {
  it('detects a monthly, consistent-amount recurring charge', () => {
    const subs = detectSubscriptions([
      tx('Netflix', 199, '2026-04-02'),
      tx('Netflix', 199, '2026-05-02'),
      tx('Netflix', 199, '2026-06-02'),
    ]);
    expect(subs).toHaveLength(1);
    expect(subs[0]).toMatchObject({ merchant: 'Netflix', monthlyAmount: 199, count: 3 });
  });

  it('ignores one-off purchases', () => {
    expect(detectSubscriptions([tx('Takealot', 1200, '2026-06-01')])).toEqual([]);
  });

  it('ignores frequent non-monthly spend (e.g. daily coffee)', () => {
    const subs = detectSubscriptions([
      tx('Coffee', 38, '2026-06-01'),
      tx('Coffee', 38, '2026-06-02'),
      tx('Coffee', 38, '2026-06-03'),
    ]);
    expect(subs).toEqual([]);
  });

  it('ignores wildly varying amounts at the same merchant', () => {
    const subs = detectSubscriptions([
      tx('Woolworths', 350, '2026-04-05'),
      tx('Woolworths', 1200, '2026-05-05'),
      tx('Woolworths', 80, '2026-06-05'),
    ]);
    expect(subs).toEqual([]);
  });

  it('excludes commitment-kind spend and credits', () => {
    const subs = detectSubscriptions([
      tx('Rent', 8000, '2026-04-01', 'commitment'),
      tx('Rent', 8000, '2026-05-01', 'commitment'),
      tx('Refund', -50, '2026-05-10'),
    ]);
    expect(subs).toEqual([]);
  });

  it('sums the monthly total', () => {
    const subs = detectSubscriptions([
      tx('Netflix', 199, '2026-05-02'),
      tx('Netflix', 199, '2026-06-02'),
      tx('Spotify', 60, '2026-05-15'),
      tx('Spotify', 60, '2026-06-15'),
    ]);
    expect(monthlyTotal(subs)).toBe(259);
  });
});
