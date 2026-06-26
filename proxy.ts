import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

/**
 * Next.js 16 Proxy (formerly "middleware"). Runs before every matched route on
 * the Node.js runtime — refreshes the session and gates all routes except the
 * Enter gate and the auth callback.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
