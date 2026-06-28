'use client';

import * as React from 'react';
import { chat } from '@/lib/analyst/actions';
import { logWithAmount } from '@/lib/logging/actions';
import { runSimulation } from '@/lib/simulate/actions';
import type { ChatAction, ChatMessage } from '@/lib/analyst/chat-prompt';
import type { SimResult } from '@/lib/simulate/simulate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatZAR } from '@/lib/format';
import { cn } from '@/lib/utils';

const GREETING =
  "Hi — I'm your Runway analyst. Ask about your money, or let's talk something through.";

const SUGGESTIONS = [
  'How am I doing this cycle?',
  'Where is most of my money going?',
  'Give me one sharp observation.',
  'Can I afford a R8 000 phone?',
];

type LogState = 'proposed' | 'filed' | 'dismissed' | 'error';

interface Item {
  role: ChatMessage['role'];
  text: string;
  action?: ChatAction | null;
  logState?: LogState;
  sim?: SimResult | null;
  simPending?: boolean;
}

export function AskClient() {
  const [items, setItems] = React.useState<Item[]>([{ role: 'assistant', text: GREETING }]);
  const [input, setInput] = React.useState('');
  const [pending, startTransition] = React.useTransition();
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items, pending]);

  function send(text: string) {
    const t = text.trim();
    if (!t || pending) return;
    const next: Item[] = [...items, { role: 'user', text: t }];
    setItems(next);
    setInput('');
    startTransition(async () => {
      const history: ChatMessage[] = next
        .filter((m) => m.text.trim())
        .map((m) => ({ role: m.role, text: m.text }));
      const { reply, action } = await chat(history);
      const idx = next.length; // position of the assistant message we're about to add
      setItems((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: reply,
          action,
          logState: action?.type === 'log' ? 'proposed' : undefined,
          simPending: action?.type === 'whatif',
        },
      ]);
      // A what-if is read-only — run it immediately and show both futures.
      if (action?.type === 'whatif') {
        const mult =
          typeof action.fasterPct === 'number' && Number.isFinite(action.fasterPct)
            ? 1 + action.fasterPct / 100
            : undefined;
        const sim = await runSimulation({
          oneOffPurchase: action.oneOffPurchase,
          incomeDelta: action.incomeDelta,
          extraMonthlyCommitment: action.extraMonthlyCommitment,
          flowRateMultiplier: mult,
        });
        setItems((prev) =>
          prev.map((it, i) => (i === idx ? { ...it, sim, simPending: false } : it)),
        );
      }
    });
  }

  function fileLog(idx: number, action: Extract<ChatAction, { type: 'log' }>) {
    if (pending) return;
    startTransition(async () => {
      const raw = `${action.merchant ?? action.category} ${action.amount}`;
      const res = await logWithAmount(raw, action.amount, action.category, action.merchant);
      setItems((prev) =>
        prev.map((it, i) => (i === idx ? { ...it, logState: res.ok ? 'filed' : 'error' } : it)),
      );
    });
  }

  function dismissLog(idx: number) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, logState: 'dismissed' } : it)));
  }

  return (
    <div className="flex min-h-[70vh] flex-col gap-4">
      <div className="flex flex-1 flex-col gap-3">
        {items.map((m, i) => (
          <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'flex max-w-[85%] flex-col gap-2',
                m.role === 'user' ? 'items-end' : 'items-start',
              )}
            >
              <div
                className={cn(
                  'whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm',
                  m.role === 'user'
                    ? 'rounded-br-sm bg-primary text-primary-foreground'
                    : 'rounded-bl-sm bg-secondary text-secondary-foreground',
                )}
              >
                {m.text}
              </div>

              {m.action?.type === 'log' && (
                <LogChip
                  action={m.action}
                  state={m.logState ?? 'proposed'}
                  busy={pending}
                  onFile={() => fileLog(i, m.action as Extract<ChatAction, { type: 'log' }>)}
                  onDismiss={() => dismissLog(i)}
                />
              )}

              {m.action?.type === 'whatif' && (
                <WhatIfCard pending={!!m.simPending} sim={m.sim ?? null} />
              )}
            </div>
          </div>
        ))}
        {pending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-secondary px-3.5 py-2 text-sm text-muted-foreground">
              thinking…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {items.length <= 1 && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <Button
              key={s}
              variant="outline"
              size="sm"
              className="min-h-9"
              onClick={() => send(s)}
              disabled={pending}
            >
              {s}
            </Button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-20 flex gap-2 lg:bottom-2"
      >
        <Input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Talk to your analyst…"
          aria-label="Message"
        />
        <Button type="submit" disabled={pending || !input.trim()}>
          Send
        </Button>
      </form>

      <p className="text-xs text-muted-foreground">
        Grounded in your data — money facts come from Runway; for big decisions, confirm
        independently.
      </p>
    </div>
  );
}

/** Gated confirm chip for a proposed expense. Nothing is written until you tap File it. */
function LogChip({
  action,
  state,
  busy,
  onFile,
  onDismiss,
}: {
  action: Extract<ChatAction, { type: 'log' }>;
  state: LogState;
  busy: boolean;
  onFile: () => void;
  onDismiss: () => void;
}) {
  const label = `${formatZAR(action.amount)}${action.merchant ? ` · ${action.merchant}` : ''} · ${action.category}`;

  if (state === 'filed') {
    return <p className="text-xs text-muted-foreground">Filed {label}.</p>;
  }
  if (state === 'dismissed') {
    return <p className="text-xs text-muted-foreground">Dismissed — nothing saved.</p>;
  }
  if (state === 'error') {
    return <p className="text-xs text-floor">Couldn&apos;t file that — try logging it on Today.</p>;
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 text-sm">
      <span>
        File <span className="font-medium tabular-nums">{label}</span>?
      </span>
      <div className="flex gap-2">
        <Button size="sm" onClick={onFile} disabled={busy}>
          File it
        </Button>
        <Button size="sm" variant="outline" onClick={onDismiss} disabled={busy}>
          Not now
        </Button>
      </div>
    </div>
  );
}

/** Read-only what-if: baseline vs scenario, side by side. */
function WhatIfCard({ pending, sim }: { pending: boolean; sim: SimResult | null }) {
  if (pending) {
    return <p className="text-xs text-muted-foreground">running the what-if…</p>;
  }
  if (!sim) {
    return (
      <p className="text-xs text-muted-foreground">
        No open cycle to run that against yet.
      </p>
    );
  }
  const poolUp = sim.poolDelta >= 0;
  const daysDelta = sim.runwayDaysDelta;
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Now</p>
          <p className="font-medium tabular-nums">{formatZAR(sim.baseline.spendablePool)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">If you do this</p>
          <p className="font-medium tabular-nums">{formatZAR(sim.scenario.spendablePool)}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {poolUp ? '+' : '−'}
        {formatZAR(Math.abs(sim.poolDelta))} safe to spend
        {daysDelta != null && daysDelta !== 0 && (
          <>
            {' · '}
            {daysDelta > 0 ? '+' : '−'}
            {Math.abs(Math.round(daysDelta))} days of runway
          </>
        )}
        .
      </p>
    </div>
  );
}
