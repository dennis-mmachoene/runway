import 'server-only';

/**
 * Server-only secrets and owner config. `import 'server-only'` makes any
 * client-side import a BUILD ERROR — defense in depth so the Supabase SECRET key
 * and `GEMINI_API_KEY` can never reach the browser bundle.
 *
 * Uses Supabase's current SECRET key (`sb_secret_...`), which replaces the legacy
 * `service_role` JWT (deprecating end of 2026). It bypasses RLS — never expose it.
 */
function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(
      `Missing required env var: ${name}. Copy .env.example to .env.local and fill it in (see SETUP.md).`,
    );
  }
  return value;
}

export const SUPABASE_SECRET_KEY = required(
  'SUPABASE_SECRET_KEY',
  process.env.SUPABASE_SECRET_KEY,
);

export const GEMINI_API_KEY = required('GEMINI_API_KEY', process.env.GEMINI_API_KEY);

/** The single allowlisted email (the owner's username). Normalized lower-case. */
export const OWNER_EMAIL = required('OWNER_EMAIL', process.env.OWNER_EMAIL)
  .trim()
  .toLowerCase();
