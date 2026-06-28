'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { onboardingConverse, confirmOnboarding } from '@/lib/agent/actions';
import type { ChatMessage } from '@/lib/analyst/chat-prompt';
import type { OnboardingProposal } from '@/lib/agent/onboarding-prompt';
import { Money } from '@/components/money';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function OnboardingClient() {
  const router = useRouter();
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [proposal, setProposal] = React.useState<OnboardingProposal | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const started = React.useRef(false);
  const endRef = React.useRef<HTMLDivElement>(null);

  const turn = React.useCallback((history: ChatMessage[]) => {
    startTransition(async () => {
      const res = await onboardingConverse(history);
      setMessages((prev) => [...prev, { role: 'assistant', text: res.reply }]);
      if (res.done && res.proposal) setProposal(res.proposal);
    });
  }, []);

  React.useEffect(() => {
    if (started.current) return;
    started.current = true;
    const kickoff: ChatMessage[] = [{ role: 'user', text: "Hi — I'd like to set up Runway." }];
    setMessages(kickoff);
    turn(kickoff);
  }, [turn]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pending]);

  function send(text: string) {
    const t = text.trim();
    if (!t || pending) return;
    const next: ChatMessage[] = [...messages, { role: 'user', text: t }];
    setMessages(next);
    setInput('');
    turn(next);
  }

  function confirm() {
    if (!proposal) return;
    setError(null);
    startTransition(async () => {
      const res = await confirmOnboarding(proposal);
      if (!res.ok) setError(res.error);
      else {
        router.push('/today');
        router.refresh();
      }
    });
  }

  const committed = proposal
    ? proposal.commitments.reduce((s, c) => s + c.amount, 0) + proposal.subscriptions.reduce((s, x) => s + x.amount, 0)
    : 0;
  const spendable = proposal ? proposal.income.amount - committed - proposal.floor : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {messages.map((m, i) => (
          <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm',
                m.role === 'user'
                  ? 'rounded-br-sm bg-primary text-primary-foreground'
                  : 'rounded-bl-sm bg-secondary text-secondary-foreground',
              )}
            >
              {m.text}
            </div>
          </div>
        ))}
        {pending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-secondary px-3.5 py-2 text-sm text-muted-foreground">…</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {proposal && (
        <Card className="animate-rise">
          <CardHeader>
            <CardTitle>Here&apos;s your picture, {proposal.displayName}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Income</span>
              <Money amount={proposal.income.amount} />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Committed (incl. subscriptions)</span>
              <Money amount={committed} />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Floor</span>
              <Money amount={proposal.floor} />
            </div>
            <div className="flex justify-between border-t pt-2 font-medium">
              <span>You can actually spend</span>
              <Money amount={spendable} />
            </div>
            <p className="text-xs text-muted-foreground">
              Savings: {proposal.savingsMode === 'automatic' ? 'sacred (off the top)' : 'best-effort'} ·{' '}
              {proposal.commitments.length} commitments · {proposal.subscriptions.length} subscriptions.
              Not right? Keep chatting to adjust.
            </p>
            <div className="mt-1 flex gap-2">
              <Button onClick={confirm} disabled={pending} className="min-h-11">
                Looks right — set it up
              </Button>
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          </CardContent>
        </Card>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-2 flex gap-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your answer…"
          aria-label="Message"
        />
        <Button type="submit" disabled={pending || !input.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
