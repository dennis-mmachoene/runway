import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/lib/env';

/**
 * Supabase client for Client Components. Sessions are persisted in httpOnly
 * cookies (written by the server / proxy), NOT localStorage.
 */
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}
