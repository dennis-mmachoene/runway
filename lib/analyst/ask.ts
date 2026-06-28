import 'server-only';

import { GoogleGenAI } from '@google/genai';
import { GEMINI_API_KEY } from '@/lib/env.server';
import { buildAnalystPrompt } from './prompt';

/** Ask the analyst, grounded strictly in the provided context. Free-text answer. */
export async function askAnalyst(question: string, contextJson: string): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const res = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: buildAnalystPrompt(question, contextJson),
    });
    return res.text?.trim() || "I couldn't find that in your data.";
  } catch {
    return "I couldn't reach the analyst right now — try again in a moment.";
  }
}
