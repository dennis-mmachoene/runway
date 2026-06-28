'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { uploadDocument, commitProposal, rejectProposal } from '@/lib/agent/actions';
import type { DocPreview } from '@/lib/agent/previews';
import type { ExtractionProposal } from '@/lib/db/types';
import { CATEGORIES } from '@/lib/categories';
import { Money } from '@/components/money';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/format';

const selectClass =
  'mt-1 flex h-11 w-full rounded-md border bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]';

const DOC_TYPES: [string, string][] = [
  ['payslip', 'Payslip'],
  ['receipt', 'Receipt'],
  ['invoice', 'Invoice'],
  ['statement', 'Bank statement'],
  ['other', 'Other'],
];

function lowConf(c: number | undefined): boolean {
  return typeof c === 'number' && c < 0.85;
}

function DocThumb({ preview }: { preview: DocPreview | undefined }) {
  if (!preview) return null;
  if (preview.isImage) {
    return (
      <a href={preview.url} target="_blank" rel="noreferrer" className="shrink-0">
        {/* signed, short-lived URL to a private document */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview.url}
          alt={preview.name ?? 'Uploaded document'}
          className="h-16 w-16 rounded-md border object-cover"
        />
      </a>
    );
  }
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noreferrer"
      className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-md border text-[10px] text-muted-foreground"
    >
      <span className="text-base">📄</span>
      PDF
    </a>
  );
}

export function InboxClient({
  proposals,
  previews = {},
}: {
  proposals: ExtractionProposal[];
  previews?: Record<string, DocPreview>;
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const [docType, setDocType] = React.useState('receipt');
  const [pending, startTransition] = React.useTransition();
  const isStatement = docType === 'statement';

  const waiting = proposals.filter((p) => p.status === 'pending');
  const done = proposals.filter((p) => p.status !== 'pending');

  function upload(form: HTMLFormElement) {
    setError(null);
    setNote(null);
    startTransition(async () => {
      const res = await uploadDocument(new FormData(form));
      if (!res.ok) setError(res.error);
      else if (res.action === 'statement') {
        setNote('Bank statements are reviewed on Reconcile — head there to upload it.');
      } else {
        setNote(res.action === 'auto_filed' ? 'Filed it — done.' : 'Read it. One quick question below.');
        form.reset();
        router.refresh();
      }
    });
  }

  function run(fd: FormData, action: (f: FormData) => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action(fd);
      if (!res.ok && res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Hand me a document</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              upload(e.currentTarget);
            }}
            className="flex flex-col gap-3"
          >
            <input
              type="file"
              name="file"
              accept="image/*,application/pdf"
              required={!isStatement}
              disabled={isStatement}
              className="text-sm disabled:opacity-50"
            />
            <label className="text-xs text-muted-foreground">
              What is it?
              <select
                name="doc_type"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className={selectClass}
              >
                {DOC_TYPES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            {isStatement ? (
              <div className="flex flex-col gap-2 rounded-md border border-dashed p-3 text-sm">
                <p>A bank statement is many transactions — I review those line by line on Reconcile.</p>
                <Button asChild variant="outline" className="w-fit">
                  <Link href="/reconcile">Open Reconcile</Link>
                </Button>
              </div>
            ) : (
              <Button type="submit" disabled={pending}>
                {pending ? 'Reading…' : 'Upload'}
              </Button>
            )}
          </form>
          {note && <p className="mt-2 text-sm text-muted-foreground">{note}</p>}
          {error && <p className="mt-2 text-sm text-destructive" role="alert">{error}</p>}
        </CardContent>
      </Card>

      {waiting.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Needs a quick answer</h2>
          {waiting.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex gap-3 p-4">
                <DocThumb preview={previews[p.id]} />
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                {p.question && <p className="text-sm">{p.question}</p>}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(new FormData(e.currentTarget), commitProposal);
                  }}
                  className="flex flex-col gap-2"
                >
                  <input type="hidden" name="id" value={p.id} />
                  <div className="flex flex-wrap gap-2">
                    <label className="text-xs text-muted-foreground">
                      Amount {lowConf(p.confidence?.amount) && <span className="text-caution">· check</span>}
                      <Input name="amount" type="number" step="0.01" min="0" defaultValue={p.payload.amount || ''} className="h-11" />
                    </label>
                    <label className="text-xs text-muted-foreground">
                      Date {lowConf(p.confidence?.date) && <span className="text-caution">· check</span>}
                      <Input name="date" type="date" defaultValue={p.payload.date ?? ''} className="h-11" />
                    </label>
                  </div>
                  <label className="text-xs text-muted-foreground">
                    Payee
                    <Input name="merchant" defaultValue={p.payload.merchant ?? ''} className="h-11" />
                  </label>
                  {p.doc_type !== 'payslip' && (
                    <label className="text-xs text-muted-foreground">
                      Category
                      <select name="category" defaultValue={p.payload.category} className={selectClass}>
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div className="flex gap-2">
                    <Button type="submit" disabled={pending} className="min-h-11">
                      Confirm &amp; file
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-11"
                      disabled={pending}
                      onClick={() => {
                        const fd = new FormData();
                        fd.set('id', p.id);
                        run(fd, rejectProposal);
                      }}
                    >
                      Discard
                    </Button>
                  </div>
                </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div className="flex flex-col gap-1">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Activity</h2>
          {done.slice(0, 20).map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b py-2 text-sm">
              <span className="truncate">
                {p.status === 'rejected' ? 'Discarded' : 'Filed'} {p.payload.merchant ?? p.doc_type}
                {p.status === 'auto_filed' && <span className="text-muted-foreground"> · auto</span>}
              </span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {p.payload.amount ? <Money amount={p.payload.amount} /> : null}
                {p.payload.date ? ` · ${formatDate(p.payload.date)}` : ''}
                {previews[p.id] && (
                  <a
                    href={previews[p.id].url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    view
                  </a>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {proposals.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nothing yet, Dennis. Upload a payslip or a receipt and I&apos;ll file it.
        </p>
      )}
    </div>
  );
}
