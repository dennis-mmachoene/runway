import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSafeToSpend } from '@/lib/engine/snapshot';
import { getPace } from '@/lib/pace/snapshot';
import { getLastSeen } from '@/lib/diff/last-seen';
import { getDiffSummary } from '@/lib/diff/summary';
import { buildGreeting } from '@/lib/diff/greeting';
import { formatZAR, formatDate } from '@/lib/format';
import type { TransactionRow } from '@/lib/db/types';
import { AppShell } from '@/components/app-shell';
import { StatGrid } from '@/components/stat-grid';
import { EmptyState } from '@/components/empty-state';
import { RunwayGauge } from '@/components/runway-gauge';
import { Button } from '@/components/ui/button';
import { LogBox } from './log-box';
import { MarkSeen } from './mark-seen';
import { RecentList } from './recent-list';

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const result = await getSafeToSpend(supabase);
  const lastSeen = await getLastSeen();
  const greeting = buildGreeting(await getDiffSummary(supabase, lastSeen, result));
  const pace = await getPace(supabase);
  const { data: txData } = await supabase
    .from('transactions')
    .select('*')
    .order('logged_at', { ascending: false })
    .limit(8);
  const transactions = (txData as TransactionRow[]) ?? [];

  const learning = !result || result.status === 'learning_pace' || !result.runwayDate;

  return (
    <AppShell title="Today">
      {!result ? (
        <EmptyState
          title="Add your income to begin"
          action={
            <Button asChild>
              <Link href="/income">Add income</Link>
            </Button>
          }
        >
          A confirmed income event opens your first cycle — then Runway starts drawing the line down
          to your floor.
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="flex flex-col gap-3">
            <MarkSeen />
            <div className="flex flex-col gap-1 animate-rise" aria-live="polite">
              <p className="text-sm text-muted-foreground">{greeting.headline}</p>
              <p
                className="text-5xl font-semibold tracking-tight tabular-nums"
                aria-label={`Safe to spend ${formatZAR(result.spendablePool)}`}
              >
                {formatZAR(result.spendablePool)}
              </p>
              <p className="text-lg font-medium">
                {learning ? (
                  'Still learning your pace.'
                ) : (
                  <>
                    At this pace you hit your floor on{' '}
                    <span className="text-floor">{formatDate(result.runwayDate!)}</span>.
                  </>
                )}
              </p>
              {greeting.notable && <p className="text-sm text-muted-foreground">{greeting.notable}</p>}
              {pace?.message && (
                <p className={pace.speak ? 'text-sm' : 'text-sm text-muted-foreground'}>{pace.message}</p>
              )}
            </div>

            <div className="rounded-xl border p-3">
              <RunwayGauge
                pool={result.spendablePool}
                floor={result.floor}
                runwayDate={result.runwayDate ? result.runwayDate.toISOString() : null}
                learning={learning}
              />
            </div>

            <StatGrid
              items={[
                { label: 'Cash in hand', amount: result.cashInHand },
                { label: 'Commitments left', amount: result.remainingCommitments },
                { label: 'Set aside', amount: result.cycleReserve },
                { label: 'Floor', amount: result.floor },
              ]}
            />
          </section>

          <section className="flex flex-col gap-4">
            <LogBox />
            <RecentList transactions={transactions} />
          </section>
        </div>
      )}
    </AppShell>
  );
}
