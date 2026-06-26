import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from '@/lib/env';
import { SUPABASE_SECRET_KEY } from '@/lib/env.server';

/**
 * Admin Supabase client using the SECRET key. BYPASSES Row Level Security.
 * Use ONLY in trusted server contexts (e.g. the owner seed script). Never import
 * into client code — the `server-only` guard enforces that.
 */
export function createAdminClient() {
  return createSupabaseClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
