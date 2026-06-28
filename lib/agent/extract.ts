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
  'Amounts are South African Rand (the figure only, no "R" or thousands separators). Dates as ISO yyyy-mm-dd; use the document\'s own date, never today.',
  `category must be exactly one of: ${CATEGORIES.join(', ')}.`,
  'Set confidence_amount and confidence_date in 0..1 for how clearly you could read each. If a value is unclear, partly obscured, or you are inferring it, score it LOW — a wrong-but-confident read is worse than a low score that asks Dennis.',
].join('\n');

const CATEGORY_HINTS =
  'category guide: groceries=supermarkets/food shops; eating_out=restaurants/takeaways/cafes; transport=fuel/ride-hailing/parking/public transport; bills=utilities/telecoms/insurance/subscriptions; shopping=retail/clothing/electronics; health=pharmacy/medical/gym; entertainment=streaming/events/games; cash=ATM/cash withdrawal; other=anything that does not clearly fit. If genuinely unsure, use "other".';

const PROMPTS: Record<DocumentKind, string> = {
  payslip: [
    COMMON,
    'This is a payslip. amount = NET pay / take-home (the final amount actually paid into the account) — NOT gross, NOT total earnings, NOT a deduction. Ignore gross, tax, UIF and other line items.',
    'date = the pay date (when paid), not the period start/end. merchant = the employer name.',
    'category is always "other" for a payslip; kind is always "flow".',
    'Shape: {"amount":number,"date":string,"merchant":string,"category":"other","kind":"flow","confidence_amount":number,"confidence_date":number}',
  ].join('\n'),
  receipt: [
    COMMON,
    'This is a purchase receipt. amount = the final TOTAL paid (VAT-inclusive grand total) — NOT a subtotal, NOT a single line item, NOT the change or cash tendered.',
    'date = the purchase date/time on the receipt. merchant = the shop/business name (usually the header).',
    CATEGORY_HINTS,
    'Shape: {"amount":number,"date":string,"merchant":string,"category":string,"kind":"flow","confidence_amount":number,"confidence_date":number}',
  ].join('\n'),
  invoice: [
    COMMON,
    'This is an invoice/bill. amount = the TOTAL AMOUNT DUE / balance payable (VAT-inclusive) — not a subtotal or a partial line.',
    'date = the DUE date if present, otherwise the invoice/issue date. merchant = the biller/payee (who is owed).',
    CATEGORY_HINTS,
    'Shape: {"amount":number,"date":string,"merchant":string,"category":string,"kind":"flow","confidence_amount":number,"confidence_date":number}',
  ].join('\n'),
  // Statements are handled by the multi-line reconcile extractor, not here. This
  // prompt is a defensive fallback if a single-line statement is ever routed in.
  statement: [
    COMMON,
    'This looks like a bank statement, but treat it as a single charge: extract the most prominent single debit as amount, its date, and its description as merchant.',
    CATEGORY_HINTS,
    'Shape: {"amount":number,"date":string,"merchant":string,"category":string,"kind":"flow","confidence_amount":number,"confidence_date":number}',
  ].join('\n'),
  other: [
    COMMON,
    'amount = the total paid or due. merchant = who it was paid to / who issued it. date = the document\'s date.',
    CATEGORY_HINTS,
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
