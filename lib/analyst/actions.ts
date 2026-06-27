'use server';

import { createClient } from '@/lib/supabase/server';
import { buildModelContext } from './context';
import { askAnalyst } from './ask';
import { OBSERVATION_QUESTION } from './prompt';

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
