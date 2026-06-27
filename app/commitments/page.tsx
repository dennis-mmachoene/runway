import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { addCommitment, deactivateCommitment } from '@/lib/commitments/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatZAR } from '@/lib/format';
import type { Commitment } from '@/lib/db/types';

const selectClass =
  'mt-1 flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]';

const SINKING = new Set(['annual', 'custom']);

export default async function CommitmentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const { data } = await supabase
    .from('commitments')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  const commitments = (data as Commitment[]) ?? [];

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/today">← Back</Link>
        </Button>
        <h1 className="text-sm font-medium text-muted-foreground">Commitments</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Add commitment</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={addCommitment} className="flex flex-col gap-3">
            <Input name="name" required placeholder="Name (e.g. Rent)" />
            <Input name="amount" type="number" step="0.01" min="0" required placeholder="Amount (R)" />
            <label className="text-xs text-muted-foreground">
              Cadence
              <select name="cadence" defaultValue="monthly" className={selectClass}>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="annual">Annual (sinking fund)</option>
                <option value="custom">Custom (sinking fund)</option>
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Type
              <select name="type" defaultValue="fixed" className={selectClass}>
                <option value="fixed">Fixed</option>
                <option value="variable">Variable</option>
              </select>
            </label>
            <Input name="variable_high" type="number" step="0.01" min="0" placeholder="Variable high reserve (if variable)" />
            <Input name="due_day" type="number" min="1" max="31" placeholder="Due day 1–31 (monthly, optional)" />
            <Input name="due_date" type="date" placeholder="Due date (sinking, optional)" />
            <Button type="submit">Add</Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        {commitments.length === 0 && <p className="text-sm text-muted-foreground">No commitments yet.</p>}
        {commitments.map((c) => (
          <Card key={c.id}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">
                  {c.name}
                  <span className="text-muted-foreground">
                    {' · '}
                    {formatZAR(c.type === 'variable' && c.variable_high != null ? c.variable_high : c.amount)}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {c.cadence}
                  {' · '}
                  {c.type}
                  {SINKING.has(c.cadence) ? ' · sinking fund' : ''}
                </p>
              </div>
              <form action={deactivateCommitment}>
                <input type="hidden" name="id" value={c.id} />
                <Button size="sm" variant="ghost" type="submit">Remove</Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
