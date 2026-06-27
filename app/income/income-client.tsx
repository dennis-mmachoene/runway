'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { addIncome, confirmIncome, deleteIncome } from '@/lib/income/actions';
import type { FormState } from '@/lib/forms';
import type { IncomeEvent } from '@/lib/db/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatZAR, formatDate } from '@/lib/format';

type Action = (fd: FormData) => Promise<FormState>;

export function IncomeClient({ income, today }: { income: IncomeEvent[]; today: string }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function run(fd: FormData, action: Action, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await action(fd);
      if (!res.ok) setError(res.error);
      else {
        onOk?.();
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Add income</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              run(new FormData(form), addIncome, () => form.reset());
            }}
            className="flex flex-col gap-3"
          >
            <Input name="amount" type="number" step="0.01" min="0" required placeholder="Amount (R)" />
            <Input name="event_at" type="date" required defaultValue={today} />
            <Input name="source" type="text" placeholder="Source (e.g. Salary)" />
            <label className="flex items-center gap-2 text-sm">
              <input name="is_confirmed" type="checkbox" defaultChecked className="size-4" />
              Confirmed (landed — opens a cycle)
            </label>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Add'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

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
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      const fd = new FormData();
                      fd.set('id', i.id);
                      run(fd, confirmIncome);
                    }}
                  >
                    Confirm
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    const fd = new FormData();
                    fd.set('id', i.id);
                    run(fd, deleteIncome);
                  }}
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
