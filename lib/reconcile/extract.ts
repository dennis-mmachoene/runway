import 'server-only';

import { GoogleGenAI } from '@google/genai';
import { GEMINI_API_KEY } from '@/lib/env.server';
import type { StatementLine } from './types';
import { sanitizeStatementLines } from './sanitize';

const PROMPT = [
  'You are reading a bank or card statement (image or PDF). Return JSON ONLY (no prose, no code fences).',
  'Return {"lines": [ ... ]} where each element is one real transaction row:',
  '{"date":"yyyy-mm-dd","description":string,"amount":number}.',
  'amount is SIGNED in South African Rand: money OUT (debits, purchases, withdrawals, fees) is NEGATIVE; money IN (deposits, credits, refunds, salary) is POSITIVE.',
  'Strip the "R"/"ZAR" symbol and thousands separators — return the number only.',
  "Use each row's own transaction date. Read EVERY transaction row, top to bottom.",
  'Do NOT include: opening/closing balance lines, the running-balance column, brought-forward/carried-forward rows, section headers, or summary/total rows. Only actual transactions.',
].join('\n');

/**
 * Vision-extract every transaction line from a statement document. Returns null
 * on failure or when nothing usable was read — the caller stays graceful and the
 * owner can paste a CSV instead. Each line is signed (negative = money out).
 */
export async function extractStatementLines(base64: string, mime: string): Promise<StatementLine[] | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: PROMPT }, { inlineData: { mimeType: mime, data: base64 } }] },
      ],
      config: { responseMimeType: 'application/json' },
    });
    const text = res.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as unknown;
    const arr = Array.isArray(parsed)
      ? parsed
      : (parsed as Record<string, unknown> | null)?.lines;
    const lines = sanitizeStatementLines(arr);
    return lines.length ? lines : null;
  } catch {
    return null;
  }
}
