/** Result of a mutating server action, so the UI can show success or failure. */
export type FormState = { ok: true } | { ok: false; error: string };
