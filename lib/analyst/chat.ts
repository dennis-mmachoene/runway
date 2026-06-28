import 'server-only';

import { GoogleGenAI } from '@google/genai';
import { GEMINI_API_KEY } from '@/lib/env.server';
import { isCategory, type Category } from '@/lib/categories';
import { buildChatSystemInstruction, type ChatAction, type ChatMessage, type ChatReply } from './chat-prompt';

function sanitizeAction(raw: unknown): ChatAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  if (a.type === 'log') {
    const amount = Number(a.amount);
    if (!Number.isFinite(amount) || amount <= 0) return null; // never a guessed amount
    const category: Category = typeof a.category === 'string' && isCategory(a.category) ? a.category : 'other';
    return { type: 'log', amount: Math.round(amount * 100) / 100, merchant: typeof a.merchant === 'string' && a.merchant.trim() ? a.merchant.trim() : null, category };
  }
  if (a.type === 'whatif') {
    const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : undefined);
    return {
      type: 'whatif',
      oneOffPurchase: num(a.oneOffPurchase),
      incomeDelta: num(a.incomeDelta),
      extraMonthlyCommitment: num(a.extraMonthlyCommitment),
      fasterPct: num(a.fasterPct),
    };
  }
  return null;
}

/** Multi-turn chat that may also propose a gated action. */
export async function chatWithAnalyst(messages: ChatMessage[], contextJson: string): Promise<ChatReply> {
  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const res = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.text }],
      })),
      config: { systemInstruction: buildChatSystemInstruction(contextJson), responseMimeType: 'application/json' },
    });
    const text = res.text;
    if (!text) return { reply: "I'm not sure I followed — could you say a bit more?", action: null };
    const o = JSON.parse(text) as Record<string, unknown>;
    return {
      reply: typeof o.reply === 'string' && o.reply.trim() ? o.reply.trim() : "Tell me a little more.",
      action: sanitizeAction(o.action),
    };
  } catch {
    return { reply: "I couldn't reach the analyst right now — try again in a moment.", action: null };
  }
}
