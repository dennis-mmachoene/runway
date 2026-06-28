'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { correctTransaction, deleteTransaction } from '@/lib/logging/actions';
import { CATEGORIES } from '@/lib/categories';
import type { TransactionRow } from '@/lib/db/types';
import { Money } from '@/components/money';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate } from '@/lib/format';

const selectClass =
  'h-11 rounded-md border bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]';

function Row({ t }: { t: TransactionRow }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function run(fd: FormData, action: (f: FormData) => Promise<unknown>, after?: () => void) {
    startTransition(async () => {
      await action(fd);
      after?.();
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate font-medium">
            <Money amount={t.amount} />
            {t.merchant ? <span className="text-muted-foreground"> · {t.merchant}</span> : null}
          </span>
          <span className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t.category.replace('_', ' ')}</span>
            <Button variant="ghost" size="sm" className="min-h-9" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
              {open ? 'Close' : 'Fix'}
            </Button>
          </span>
        </div>

        {open && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(new FormData(e.currentTarget), correctTransaction, () => setOpen(false));
              }}
              className="flex flex-wrap items-center gap-2"
            >
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="merchant" value={t.merchant ?? ''} />
              <label className="sr-only" htmlFor={`cat-${t.id}`}>
                Category
              </label>
              <select id={`cat-${t.id}`} name="category" defaultValue={t.category} className={selectClass}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace('_', ' ')}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor={`kind-${t.id}`}>
                Kind
              </label>
              <select id={`kind-${t.id}`} name="kind" defaultValue={t.kind} className={selectClass}>
                <option value="flow">flow</option>
                <option value="lump">lump</option>
              </select>
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <input type="checkbox" name="remember" className="size-4" />
                remember
              </label>
              <Button size="sm" variant="outline" type="submit" className="min-h-11" disabled={pending}>
                Save
              </Button>
            </form>
            <Button
              size="sm"
              variant="ghost"
              className="min-h-11"
              disabled={pending}
              onClick={() => {
                const fd = new FormData();
                fd.set('id', t.id);
                run(fd, deleteTransaction);
              }}
            >
              Delete
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RecentList({ transactions }: { transactions: TransactionRow[] }) {
  if (transactions.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent</h2>
      {transactions.map((t) => (
        <Row key={t.id} t={t} />
      ))}
    </div>
  );
}
