import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/lib/env';

/** Paths reachable without a session. Everything else is gated. */
const PUBLIC_PATHS = new Set(['/', '/auth/callback']);
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

/**
 * Refreshes the session cookie on every request AND gates routes.
 *  - Keeps the httpOnly session fresh (token rotation).
 *  - A session is only "fully authed" once any required MFA step-up is met, so
 *    an aal1 session with a pending TOTP challenge can't reach protected routes.
 *  - Sends fully-authed users off the Enter gate to /today.
 *
 * NOTE: do not insert logic between `createServerClient` and `getUser()`.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // TOTP is mandatory: a session is valid only once stepped up to aal2. A fresh
  // password-only (aal1) session must complete enrollment/challenge first.
  let fullyAuthed = false;
  if (user) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    fullyAuthed = aal?.currentLevel === 'aal2';
  }

  if (!fullyAuthed && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }
  if (fullyAuthed && pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/today';
    return NextResponse.redirect(url);
  }

  // Must return the response carrying the refreshed cookies.
  return response;
}
