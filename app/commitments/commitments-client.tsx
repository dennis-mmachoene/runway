'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { addCommitment, deactivateCommitment, payCommitment } from '@/lib/commitments/actions';
import type { FormState } from '@/lib/forms';
import type { Commitment } from '@/lib/db/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatZAR } from '@/lib/format';

type Action = (fd: FormData) => Promise<FormState>;
const SINKING = new Set(['annual', 'custom']);
const selectClass =
  'mt-1 flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]';

export function CommitmentsClient({
  commitments,
  paidIds,
}: {
  commitments: Commitment[];
  paidIds: string[];
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const paid = new Set(paidIds);

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
          <CardTitle>Add commitment</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              run(new FormData(form), addCommitment, () => form.reset());
            }}
            className="flex flex-col gap-3"
          >
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
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Add'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      <div className="flex flex-col gap-2">
        {commitments.length === 0 && <p className="text-sm text-muted-foreground">No commitments yet.</p>}
        {commitments.map((c) => {
          const isSinking = SINKING.has(c.cadence);
          const reserve = c.type === 'variable' && c.variable_high != null ? c.variable_high : c.amount;
          const isPaid = paid.has(c.id);
          return (
            <Card key={c.id}>
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {c.name}
                      <span className="text-muted-foreground"> · {formatZAR(reserve)}</span>
                      {isPaid && (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          paid this cycle
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.cadence} · {c.type}
                      {isSinking ? ` · sinking · reserved ${formatZAR(c.reserved_balance)}` : ''}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      const fd = new FormData();
                      fd.set('id', c.id);
                      run(fd, deactivateCommitment);
                    }}
                  >
                    Remove
                  </Button>
                </div>

                {!isSinking && !isPaid && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(new FormData(e.currentTarget), payCommitment);
                    }}
                    className="flex items-center gap-2"
                  >
                    <input type="hidden" name="id" value={c.id} />
                    <Input name="amount" type="number" step="0.01" min="0" defaultValue={reserve} className="h-8" />
                    <Button size="sm" type="submit" disabled={pending}>
                      Pay
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
