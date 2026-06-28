'use client';

import * as React from 'react';
import { chat } from '@/lib/analyst/actions';
import type { ChatMessage } from '@/lib/analyst/chat-prompt';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const GREETING =
  "Hi — I'm your Runway analyst. Ask about your money, or let's talk something through.";

const SUGGESTIONS = [
  'How am I doing this cycle?',
  'Where is most of my money going?',
  'Give me one sharp observation.',
  'Can I afford a R8 000 phone?',
];

export function AskClient() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    { role: 'assistant', text: GREETING },
  ]);
  const [input, setInput] = React.useState('');
  const [pending, startTransition] = React.useTransition();
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pending]);

  function send(text: string) {
    const t = text.trim();
    if (!t || pending) return;
    const next: ChatMessage[] = [...messages, { role: 'user', text: t }];
    setMessages(next);
    setInput('');
    startTransition(async () => {
      const reply = await chat(next);
      setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
    });
  }

  return (
    <div className="flex min-h-[70vh] flex-col gap-4">
      <div className="flex flex-1 flex-col gap-3">
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
            <div className="rounded-2xl rounded-bl-sm bg-secondary px-3.5 py-2 text-sm text-muted-foreground">
              thinking…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <Button key={s} variant="outline" size="sm" className="min-h-9" onClick={() => send(s)} disabled={pending}>
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
