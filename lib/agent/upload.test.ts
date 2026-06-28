import { describe, it, expect } from 'vitest';
import { checkUpload, MAX_UPLOAD_BYTES } from './upload';

describe('checkUpload', () => {
  it('accepts allowed types within the size cap', () => {
    expect(checkUpload(1000, 'application/pdf')).toEqual({ ok: true });
    expect(checkUpload(1000, 'image/jpeg')).toEqual({ ok: true });
    expect(checkUpload(1000, 'image/png')).toEqual({ ok: true });
    expect(checkUpload(1000, 'image/webp')).toEqual({ ok: true });
  });

  it('ignores mime parameters and casing', () => {
    expect(checkUpload(1000, 'IMAGE/JPEG; charset=binary')).toEqual({ ok: true });
  });

  it('rejects empty files', () => {
    expect(checkUpload(0, 'application/pdf').ok).toBe(false);
  });

  it('rejects files over the cap', () => {
    expect(checkUpload(MAX_UPLOAD_BYTES + 1, 'application/pdf').ok).toBe(false);
  });

  it('rejects disallowed types', () => {
    expect(checkUpload(1000, 'application/zip').ok).toBe(false);
    expect(checkUpload(1000, 'text/csv').ok).toBe(false);
    expect(checkUpload(1000, '').ok).toBe(false);
  });
});
