import 'server-only';

import { GoogleGenAI } from '@google/genai';
import { GEMINI_API_KEY } from '@/lib/env.server';
import type { ChatMessage } from '@/lib/analyst/chat-prompt';
import {
  buildOnboardingInstruction,
  type OnboardingProposal,
  type OnboardingTurn,
} from './onboarding-prompt';

const CADENCES = new Set(['monthly', 'weekly', 'annual', 'custom']);

function sanitizeProposal(raw: unknown, fallbackName: string): OnboardingProposal | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const income = (o.income ?? {}) as Record<string, unknown>;
  const amount = Number(income.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null; // never propose a bad income number

  const commitments = Array.isArray(o.commitments)
    ? (o.commitments as Record<string, unknown>[])
        .map((c) => ({
          name: String(c.name ?? '').trim(),
          amount: Number(c.amount),
          cadence: (CADENCES.has(String(c.cadence)) ? String(c.cadence) : 'monthly') as OnboardingProposal['commitments'][number]['cadence'],
          dueDay: c.dueDay != null && Number.isFinite(Number(c.dueDay)) ? Number(c.dueDay) : null,
          type: (c.type === 'variable' ? 'variable' : 'fixed') as 'fixed' | 'variable',
        }))
        .filter((c) => c.name && Number.isFinite(c.amount) && c.amount > 0)
    : [];

  const subscriptions = Array.isArray(o.subscriptions)
    ? (o.subscriptions as Record<string, unknown>[])
        .map((s) => ({ merchant: String(s.merchant ?? '').trim(), amount: Number(s.amount) }))
        .filter((s) => s.merchant && Number.isFinite(s.amount) && s.amount > 0)
    : [];

  return {
    displayName: typeof o.displayName === 'string' && o.displayName.trim() ? o.displayName.trim() : fallbackName,
    income: {
      amount: Math.round(amount * 100) / 100,
      dayOfMonth: income.dayOfMonth != null && Number.isFinite(Number(income.dayOfMonth)) ? Number(income.dayOfMonth) : null,
      irregular: income.irregular === true,
    },
    commitments,
    subscriptions,
    floor: Number.isFinite(Number(o.floor)) ? Math.max(0, Number(o.floor)) : 0,
    savingsMode: o.savingsMode === 'best_effort' ? 'best_effort' : 'automatic',
  };
}

/** One interview turn. Returns the agent's reply and, when ready, a proposal. */
export async function onboardingTurn(messages: ChatMessage[], name: string): Promise<OnboardingTurn> {
  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.text }],
      })),
      config: { systemInstruction: buildOnboardingInstruction(name), responseMimeType: 'application/json' },
    });
    const text = res.text;
    if (!text) return { reply: 'Could you say that once more?', done: false, proposal: null };

    const o = JSON.parse(text) as Record<string, unknown>;
    const done = o.done === true;
    const proposal = done ? sanitizeProposal(o.proposal, name) : null;
    return {
      reply: typeof o.reply === 'string' && o.reply.trim() ? o.reply.trim() : "Tell me a little more.",
      done: done && proposal != null,
      proposal,
    };
  } catch {
    return { reply: "I had trouble there — could you say that again?", done: false, proposal: null };
  }
}
