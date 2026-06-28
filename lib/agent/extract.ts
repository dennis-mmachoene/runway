import 'server-only';

import { GoogleGenAI } from '@google/genai';
import { GEMINI_API_KEY } from '@/lib/env.server';
import { CATEGORIES, isCategory, type Category } from '@/lib/categories';
import type { DocumentKind, ProposalPayload, TransactionKind } from '@/lib/db/types';

export interface ExtractionResult {
  payload: ProposalPayload;
  confidence: { amount: number; date: number };
}

const COMMON = [
  'Read the attached document and return JSON ONLY (no prose, no code fences).',
  'Amounts are South African Rand. Dates as ISO yyyy-mm-dd. Use the document\'s own date.',
  `category must be exactly one of: ${CATEGORIES.join(', ')}.`,
  'Also return confidence_amount and confidence_date in 0..1 for how clearly you read each.',
].join('\n');

const PROMPTS: Record<DocumentKind, string> = {
  payslip: [
    COMMON,
    'This is a payslip. Extract NET pay (take-home) as amount, pay date as date, employer as merchant.',
    'Shape: {"amount":number,"date":string,"merchant":string,"category":"other","kind":"flow","confidence_amount":number,"confidence_date":number}',
  ].join('\n'),
  receipt: [
    COMMON,
    'This is a purchase receipt. Extract the total as amount, the merchant, and the date; guess the best category.',
    'Shape: {"amount":number,"date":string,"merchant":string,"category":string,"kind":"flow","confidence_amount":number,"confidence_date":number}',
  ].join('\n'),
  invoice: [
    COMMON,
    'This is an invoice. Extract the total as amount, the payee as merchant, and the date; guess the best category.',
    'Shape: {"amount":number,"date":string,"merchant":string,"category":string,"kind":"flow","confidence_amount":number,"confidence_date":number}',
  ].join('\n'),
  statement: [
    COMMON,
    'This is a bank statement. Extract the single most prominent line if asked; otherwise return the total debited.',
    'Shape: {"amount":number,"date":string,"merchant":string,"category":string,"kind":"flow","confidence_amount":number,"confidence_date":number}',
  ].join('\n'),
  other: [
    COMMON,
    'Extract the total as amount, who it was paid to as merchant, and the date; guess the best category.',
    'Shape: {"amount":number,"date":string,"merchant":string,"category":string,"kind":"flow","confidence_amount":number,"confidence_date":number}',
  ].join('\n'),
};

function clamp01(n: unknown): number {
  const x = Number(n);
  return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0;
}

/**
 * Gemini reads PDFs and images directly — no OCR library. Returns a structured
 * proposal with per-field confidence, or null on any failure (caller stays
 * graceful; an unreadable upload becomes a question, never a guessed record).
 */
export async function extractDocument(
  base64: string,
  mime: string,
  docType: DocumentKind,
): Promise<ExtractionResult | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: PROMPTS[docType] ?? PROMPTS.other }, { inlineData: { mimeType: mime, data: base64 } }] },
      ],
      config: { responseMimeType: 'application/json' },
    });
    const text = res.text;
    if (!text) return null;

    const o = JSON.parse(text) as Record<string, unknown>;
    const amount = Number(o.amount);
    if (!Number.isFinite(amount) || amount <= 0) return null; // no usable amount → caller asks

    const category: Category = typeof o.category === 'string' && isCategory(o.category) ? o.category : 'other';
    const kind: TransactionKind = o.kind === 'lump' || o.kind === 'commitment' ? o.kind : 'flow';
    const dateStr = typeof o.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(o.date) ? o.date.slice(0, 10) : null;

    return {
      payload: {
        amount: Math.round(amount * 100) / 100,
        date: dateStr,
        merchant: typeof o.merchant === 'string' && o.merchant.trim() ? o.merchant.trim() : null,
        category,
        kind,
        employer: docType === 'payslip' ? (typeof o.merchant === 'string' ? o.merchant : null) : undefined,
      },
      confidence: {
        amount: clamp01(o.confidence_amount),
        date: dateStr ? clamp01(o.confidence_date) : 0,
      },
    };
  } catch {
    return null;
  }
}
