'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { analyzeReconcile, applyReconcile, type ApplyResult } from '@/lib/reconcile/actions';
import type { AnalyzedLine, LineType } from '@/lib/reconcile/types';
import { CATEGORIES } from '@/lib/categories';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatZAR, formatDate } from '@/lib/format';

const TYPES: LineType[] = ['spend', 'commitment', 'income', 'refund', 'transfer', 'cash_withdrawal'];
const WITH_CATEGORY = new Set<LineType>(['spend', 'refund', 'cash_withdrawal']);
const selectClass =
  'h-8 rounded-md border bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]';

export function ReconcileClient() {
  const router = useRouter();
  const [csv, setCsv] = React.useState('');
  const [lines, setLines] = React.useState<AnalyzedLine[] | null>(null);
  const [result, setResult] = React.useState<ApplyResult | null>(null);
  const [pending, startTransition] = React.useTransition();

  function analyze() {
    setResult(null);
    startTransition(async () => {
      setLines(await analyzeReconcile(csv));
    });
  }
  function apply() {
    if (!lines) return;
    startTransition(async () => {
      const r = await applyReconcile(lines);
      setResult(r);
      setLines(null);
      setCsv('');
      router.refresh();
    });
  }
  function update(id: string, patch: Partial<AnalyzedLine>) {
    setLines((prev) => (prev ? prev.map((l) => (l.id === id ? { ...l, ...patch } : l)) : prev));
  }

  return (
    <div className="flex flex-col gap-4">
      {!lines && (
        <>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder="Paste your bank statement CSV (with a header row: Date, Description, Amount — or Debit/Credit)…"
            className="min-h-40 w-full rounded-md border bg-transparent p-3 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          />
          <Button onClick={analyze} disabled={pending || !csv.trim()} className="w-fit">
            {pending ? 'Analyzing…' : 'Analyze'}
          </Button>
        </>
      )}

      {result && (
        <Card>
          <CardContent className="p-4 text-sm">
            Reconciled: {result.matched} matched, {result.inserted} added, {result.commitments} bills,{' '}
            {result.refunds} refunds, {result.income} income, {result.transfersSkipped} transfers excluded.
          </CardContent>
        </Card>
      )}

      {lines && lines.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No rows found. Make sure the CSV has a header row with Date, Description and Amount (or
          Debit/Credit).
        </p>
      )}

      {lines && lines.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Statement is the source of truth. Review the type and category, then apply.
          </p>
          {lines.map((l) => (
            <Card key={l.id}>
              <CardContent className="flex flex-wrap items-center gap-2 p-3 text-sm">
                <span className="w-20 shrink-0 text-xs text-muted-foreground">{formatDate(l.date)}</span>
                <span className="min-w-0 flex-1 truncate">{l.description || '—'}</span>
                <span className={l.amount < 0 ? '' : 'text-emerald-600'}>{formatZAR(l.amount, true)}</span>
                {l.matchedTxId && l.type === 'spend' && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">matched</span>
                )}
                <select
                  value={l.type}
                  onChange={(e) => update(l.id, { type: e.target.value as LineType })}
                  className={selectClass}
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace('_', ' ')}
                    </option>
                  ))}
                </select>
                {WITH_CATEGORY.has(l.type) && (
                  <select
                    value={l.category}
                    onChange={(e) => update(l.id, { category: e.target.value as AnalyzedLine['category'] })}
                    className={selectClass}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                )}
              </CardContent>
            </Card>
          ))}
          <div className="flex gap-2">
            <Button onClick={apply} disabled={pending}>
              {pending ? 'Applying…' : 'Apply reconcile'}
            </Button>
            <Button variant="ghost" onClick={() => setLines(null)} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
