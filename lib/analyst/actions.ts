'use server';

import { createClient } from '@/lib/supabase/server';
import { buildModelContext } from './context';
import { askAnalyst } from './ask';
import { chatWithAnalyst } from './chat';
import type { ChatMessage } from './chat-prompt';
import { OBSERVATION_QUESTION } from './prompt';

/** Multi-turn chat: send the running conversation, grounded in live data. */
export async function chat(messages: ChatMessage[]): Promise<string> {
  const trimmed = messages.filter((m) => m.text.trim()).slice(-20); // cap history
  // Gemini requires the turn list to start with a user message.
  const firstUser = trimmed.findIndex((m) => m.role === 'user');
  const convo = firstUser >= 0 ? trimmed.slice(firstUser) : [];
  if (!convo.length) return 'What would you like to talk through?';
  const supabase = await createClient();
  const ctx = await buildModelContext(supabase);
  return chatWithAnalyst(convo, JSON.stringify(ctx));
}

export async function ask(question: string): Promise<string> {
  const q = question.trim();
  if (!q) return 'Ask me something about your money.';
  const supabase = await createClient();
  const ctx = await buildModelContext(supabase);
  return askAnalyst(q, JSON.stringify(ctx));
}

/** The quiet analyst: one sharp, grounded observation, only when asked for. */
export async function observe(): Promise<string> {
  const supabase = await createClient();
  const ctx = await buildModelContext(supabase);
  return askAnalyst(OBSERVATION_QUESTION, JSON.stringify(ctx));
}
