import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { addIncome, confirmIncome, deleteIncome } from '@/lib/income/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatZAR, formatDate } from '@/lib/format';
import type { IncomeEvent } from '@/lib/db/types';

export default async function IncomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const { data } = await supabase
    .from('income_events')
    .select('*')
    .order('event_at', { ascending: false });
  const income = (data as IncomeEvent[]) ?? [];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/today">← Back</Link>
        </Button>
        <h1 className="text-sm font-medium text-muted-foreground">Income</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Add income</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={addIncome} className="flex flex-col gap-3">
            <Input name="amount" type="number" step="0.01" min="0" required placeholder="Amount (R)" />
            <Input name="event_at" type="date" required defaultValue={today} />
            <Input name="source" type="text" placeholder="Source (e.g. Salary)" />
            <label className="flex items-center gap-2 text-sm">
              <input name="is_confirmed" type="checkbox" defaultChecked className="size-4" />
              Confirmed (landed — opens a cycle)
            </label>
            <Button type="submit">Add</Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        {income.length === 0 && <p className="text-sm text-muted-foreground">No income yet.</p>}
        {income.map((i) => (
          <Card key={i.id}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">
                  {formatZAR(i.amount)}
                  {i.source ? <span className="text-muted-foreground"> · {i.source}</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(i.event_at)} · {i.is_confirmed ? 'Confirmed' : 'Expected'}
                </p>
              </div>
              <div className="flex gap-2">
                {!i.is_confirmed && (
                  <form action={confirmIncome}>
                    <input type="hidden" name="id" value={i.id} />
                    <Button size="sm" type="submit">Confirm</Button>
                  </form>
                )}
                <form action={deleteIncome}>
                  <input type="hidden" name="id" value={i.id} />
                  <Button size="sm" variant="ghost" type="submit">Delete</Button>
                </form>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
