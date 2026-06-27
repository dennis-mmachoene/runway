import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { detectSubscriptions, monthlyTotal, type SubscriptionInput } from '@/lib/subscriptions/detect';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatZAR, formatDate } from '@/lib/format';

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/today">← Back</Link>
        </Button>
        <h1 className="text-sm font-medium text-muted-foreground">Subscriptions</h1>
      </header>

      {subs.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No recurring charges spotted yet</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            This finds same-merchant charges that repeat monthly. It needs a couple of cycles of
            logged or reconciled spend before it can name them.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                {subs.length} recurring {subs.length === 1 ? 'charge' : 'charges'} ·{' '}
                {formatZAR(total)}/month
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              That&apos;s {formatZAR(total * 12)} a year. Here they all are.
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
                    <p className="font-medium">{formatZAR(s.monthlyAmount)}/mo</p>
                    <p className="text-xs text-muted-foreground">{formatZAR(s.monthlyAmount * 12)}/yr</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
