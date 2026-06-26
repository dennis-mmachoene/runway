/**
 * Public, client-safe configuration. ONLY `NEXT_PUBLIC_*` values belong here —
 * anything in this file may be inlined into the browser bundle. Secrets live in
 * `lib/env.server.ts`, marked `server-only` so a stray client import fails the build.
 *
 * Uses Supabase's current PUBLISHABLE key (`sb_publishable_...`), which replaces
 * the legacy `anon` JWT (deprecating end of 2026). Safe to expose to the browser.
 */
function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(
      `Missing required env var: ${name}. Copy .env.example to .env.local and fill it in (see SETUP.md).`,
    );
  }
  return value;
}

export const SUPABASE_URL = required(
  'NEXT_PUBLIC_SUPABASE_URL',
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);

export const SUPABASE_PUBLISHABLE_KEY = required(
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
