import 'server-only';

import { GoogleGenAI } from '@google/genai';
import { GEMINI_API_KEY } from '@/lib/env.server';
import { buildChatSystemInstruction, type ChatMessage } from './chat-prompt';

/**
 * Multi-turn conversation with the analyst. The whole dialogue is sent each turn
 * (Gemini is stateless here), grounded by the system instruction's data snapshot.
 */
export async function chatWithAnalyst(
  messages: ChatMessage[],
  contextJson: string,
): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const res = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.text }],
      })),
      config: { systemInstruction: buildChatSystemInstruction(contextJson) },
    });
    return res.text?.trim() || "I'm not sure I followed — could you say a bit more?";
  } catch {
    return "I couldn't reach the analyst right now — try again in a moment.";
  }
}
