import 'server-only';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/lib/env';

/**
 * Supabase client for Server Components, Route Handlers, and Server Actions.
 * In Next 16, `cookies()` is async — it must be awaited. Uses the publishable
 * key and the user's session (RLS applies), never the secret key.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component (cookies read-only). Safe to ignore:
          // the proxy refreshes the session cookie on every request.
        }
      },
    },
  });
}
