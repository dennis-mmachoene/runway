import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSafeToSpend } from '@/lib/engine/snapshot';
import { lock } from '@/lib/auth/actions';
import { correctTransaction, deleteTransaction } from '@/lib/logging/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatZAR, formatDate } from '@/lib/format';
import { CATEGORIES } from '@/lib/categories';
import type { TransactionRow } from '@/lib/db/types';
import { getLastSeen } from '@/lib/diff/last-seen';
import { getDiffSummary } from '@/lib/diff/summary';
import { buildGreeting } from '@/lib/diff/greeting';
import { LogBox } from './log-box';
import { MarkSeen } from './mark-seen';

const selectClass =
  'h-8 rounded-md border bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]';

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const result = await getSafeToSpend(supabase);
  const lastSeen = await getLastSeen();
  const greeting = buildGreeting(await getDiffSummary(supabase, lastSeen, result));
  const { data: txData } = await supabase
    .from('transactions')
    .select('*')
    .order('logged_at', { ascending: false })
    .limit(8);
  const transactions = (txData as TransactionRow[]) ?? [];

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-sm font-medium text-muted-foreground">Runway</h1>
        <form action={lock}>
          <Button variant="ghost" size="sm" type="submit">
            Lock
          </Button>
        </form>
      </header>

      <MarkSeen />

      {result && (
        <div className="flex flex-col gap-1">
          <p className="text-sm">{greeting.headline}</p>
          {greeting.notable && <p className="text-sm text-muted-foreground">{greeting.notable}</p>}
        </div>
      )}

      {!result ? (
        <Card>
          <CardHeader>
            <CardTitle>Add your income to begin</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
            <p>A confirmed income event opens your first cycle.</p>
            <Button asChild className="w-fit">
              <Link href="/income">Add income</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Safe to spend</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-4xl font-semibold tracking-tight">{formatZAR(result.spendablePool)}</p>
            <p className="text-sm text-muted-foreground">
              {result.status === 'learning_pace' || !result.runwayDate
                ? 'Still learning your pace.'
                : `At this pace you hit your floor on ${formatDate(result.runwayDate)}.`}
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Cash in hand</dt>
              <dd className="text-right">{formatZAR(result.cashInHand)}</dd>
              <dt className="text-muted-foreground">Commitments left</dt>
              <dd className="text-right">{formatZAR(result.remainingCommitments)}</dd>
              <dt className="text-muted-foreground">Set aside</dt>
              <dd className="text-right">{formatZAR(result.cycleReserve)}</dd>
              <dt className="text-muted-foreground">Floor</dt>
              <dd className="text-right">{formatZAR(result.floor)}</dd>
            </dl>
          </CardContent>
        </Card>
      )}

      <LogBox />

      {transactions.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-medium text-muted-foreground">Recent</h2>
          {transactions.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex flex-col gap-2 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {formatZAR(t.amount)}
                    {t.merchant ? <span className="text-muted-foreground"> · {t.merchant}</span> : null}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(t.logged_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <form action={correctTransaction} className="flex flex-1 items-center gap-2">
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="merchant" value={t.merchant ?? ''} />
                    <select name="category" defaultValue={t.category} className={selectClass}>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                    <select name="kind" defaultValue={t.kind} className={selectClass}>
                      <option value="flow">flow</option>
                      <option value="lump">lump</option>
                    </select>
                    <label className="flex items-center gap-1 text-xs text-muted-foreground">
                      <input type="checkbox" name="remember" className="size-3.5" />
                      remember
                    </label>
                    <Button size="sm" variant="outline" type="submit">
                      Save
                    </Button>
                  </form>
                  <form action={deleteTransaction}>
                    <input type="hidden" name="id" value={t.id} />
                    <Button size="sm" variant="ghost" type="submit" aria-label="Delete">
                      ×
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <nav className="flex gap-3">
        <Button asChild variant="outline" className="flex-1">
          <Link href="/income">Income</Link>
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <Link href="/commitments">Commitments</Link>
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <Link href="/reconcile">Reconcile</Link>
        </Button>
      </nav>
    </main>
  );
}
