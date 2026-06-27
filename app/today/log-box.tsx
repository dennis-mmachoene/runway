'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { logTransaction, logWithAmount } from '@/lib/logging/actions';

export function LogBox() {
  const router = useRouter();
  const [raw, setRaw] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [need, setNeed] = React.useState<{ category: string; merchant: string | null } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function reset() {
    setRaw('');
    setAmount('');
    setNeed(null);
  }

  function submitRaw(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await logTransaction(raw);
      if (res.ok) {
        reset();
        router.refresh();
      } else if ('needAmount' in res) {
        setNeed({ category: res.category, merchant: res.merchant });
      } else {
        setError(res.error);
      }
    });
  }

  function submitAmount(e: React.FormEvent) {
    e.preventDefault();
    if (!need) return;
    setError(null);
    startTransition(async () => {
      const res = await logWithAmount(raw, Number(amount), need.category, need.merchant);
      if (res.ok) {
        reset();
        router.refresh();
      } else if (!('needAmount' in res)) {
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {!need ? (
        <form onSubmit={submitRaw} className="flex gap-2">
          <Input
            autoFocus
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Log spend… e.g. Coffee R38"
          />
          <Button type="submit" disabled={pending || !raw.trim()}>
            {pending ? '…' : 'Log'}
          </Button>
        </form>
      ) : (
        <form onSubmit={submitAmount} className="flex gap-2">
          <Input
            autoFocus
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`Amount for ${need.merchant ?? 'this'}`}
          />
          <Button type="submit" disabled={pending || !amount}>
            {pending ? '…' : 'Save'}
          </Button>
          <Button type="button" variant="ghost" onClick={reset}>
            Cancel
          </Button>
        </form>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
