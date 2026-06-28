/**
 * Upload constraints (A5). One-user app, but an unbounded upload that gets
 * buffered, base64'd and shipped to Gemini is a footgun — memory, cost, and a
 * failed call. Cap size and allow only document-ish types. Pure + tested.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export type UploadCheck = { ok: true } | { ok: false; error: string };

export function checkUpload(size: number, mime: string | null | undefined): UploadCheck {
  if (!size || size <= 0) return { ok: false, error: 'That file looks empty.' };
  if (size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: 'That file is over 10MB — please upload a smaller scan or PDF.' };
  }
  const m = (mime ?? '').toLowerCase().split(';')[0].trim();
  if (!ALLOWED_MIME.has(m)) {
    return { ok: false, error: 'I can read PDFs and photos (PDF, JPG, PNG, WEBP) — that type isn\'t supported.' };
  }
  return { ok: true };
}
