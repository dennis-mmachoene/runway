import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { detectSubscriptions, monthlyTotal, type SubscriptionInput } from '@/lib/subscriptions/detect';
import { AppShell } from '@/components/app-shell';
import { EmptyState } from '@/components/empty-state';
import { Money } from '@/components/money';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/format';

export default async function SubscriptionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const since = new Date(Date.now() - 150 * 86_400_000).toISOString();
  const { data } = await supabase
    .from('transactions')
    .select('merchant, amount, logged_at, kind')
    .gte('logged_at', since);
  const subs = detectSubscriptions((data as SubscriptionInput[]) ?? []);
  const total = monthlyTotal(subs);

  return (
    <AppShell title="Subscriptions">
      {subs.length === 0 ? (
        <EmptyState title="No recurring charges spotted yet">
          This finds same-merchant charges that repeat monthly. It needs a couple of cycles of logged
          or reconciled spend before it can name them.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="tabular-nums">
                {subs.length} recurring {subs.length === 1 ? 'charge' : 'charges'} ·{' '}
                <Money amount={total} />/month
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              That&apos;s <Money amount={total * 12} /> a year. Here they all are.
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            {subs.map((s) => (
              <Card key={s.merchant}>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{s.merchant}</p>
                    <p className="text-xs text-muted-foreground">
                      seen {s.count}× · last {formatDate(s.lastChargedAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      <Money amount={s.monthlyAmount} />/mo
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <Money amount={s.monthlyAmount * 12} />/yr
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
