'use client';

import * as React from 'react';
import { ask, observe } from '@/lib/analyst/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

interface Turn {
  q: string;
  a: string;
}

const SUGGESTIONS = [
  'How much have I spent on coffee this year?',
  'What are my biggest recurring charges?',
  'When did I last replace my tyres?',
];

export function AskClient() {
  const [question, setQuestion] = React.useState('');
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [pending, startTransition] = React.useTransition();

  function send(q: string) {
    const query = q.trim();
    if (!query) return;
    setQuestion('');
    startTransition(async () => {
      const a = await ask(query);
      setTurns((prev) => [{ q: query, a }, ...prev]);
    });
  }

  function getObservation() {
    startTransition(async () => {
      const a = await observe();
      setTurns((prev) => [{ q: 'An observation', a }, ...prev]);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(question);
        }}
        className="flex gap-2"
      >
        <Input
          autoFocus
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything about your money…"
        />
        <Button type="submit" disabled={pending || !question.trim()}>
          {pending ? '…' : 'Ask'}
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <Button key={s} variant="outline" size="sm" onClick={() => send(s)} disabled={pending}>
            {s}
          </Button>
        ))}
        <Button variant="ghost" size="sm" onClick={getObservation} disabled={pending}>
          Give me an observation
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {turns.map((t, i) => (
          <Card key={i}>
            <CardContent className="flex flex-col gap-1 p-4">
              <p className="text-xs text-muted-foreground">{t.q}</p>
              <p className="text-sm">{t.a}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        The analyst answers only from your data — if it&apos;s not in Runway, it&apos;ll say so.
      </p>
    </div>
  );
}
