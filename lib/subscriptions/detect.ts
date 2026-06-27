const MS_PER_DAY = 86_400_000;

export interface SubscriptionInput {
  merchant: string | null;
  amount: number;
  logged_at: string;
  kind: string;
}

export interface Subscription {
  merchant: string;
  monthlyAmount: number;
  count: number;
  lastChargedAt: string;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Find recurring charges that look like subscriptions: the same merchant, a
 * consistent amount, repeating on a roughly-monthly cadence. Conservative on
 * purpose — better to miss a borderline one than to invent a subscription.
 *
 * Ignores `commitment`-kind spend (those are already named bills) and credits.
 */
export function detectSubscriptions(transactions: SubscriptionInput[]): Subscription[] {
  const groups = new Map<string, SubscriptionInput[]>();
  for (const t of transactions) {
    if (t.kind === 'commitment') continue;
    if (!t.merchant || Number(t.amount) <= 0) continue;
    const key = t.merchant.trim().toLowerCase();
    if (!key) continue;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(t);
  }

  const out: Subscription[] = [];
  for (const items of groups.values()) {
    if (items.length < 2) continue;
    const sorted = [...items].sort(
      (a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime(),
    );

    const amounts = sorted.map((t) => Number(t.amount));
    const medAmount = median(amounts);
    const spread = Math.max(...amounts) - Math.min(...amounts);
    const amountConsistent = spread <= Math.max(5, medAmount * 0.2);

    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(
        (new Date(sorted[i].logged_at).getTime() - new Date(sorted[i - 1].logged_at).getTime()) /
          MS_PER_DAY,
      );
    }
    const medGap = median(gaps);
    const isMonthly = medGap >= 20 && medGap <= 45;

    if (amountConsistent && isMonthly) {
      out.push({
        merchant: sorted[0].merchant!.trim(),
        monthlyAmount: round2(medAmount),
        count: sorted.length,
        lastChargedAt: sorted[sorted.length - 1].logged_at,
      });
    }
  }

  return out.sort((a, b) => b.monthlyAmount - a.monthlyAmount);
}

export function monthlyTotal(subs: Subscription[]): number {
  return round2(subs.reduce((sum, s) => sum + s.monthlyAmount, 0));
}
