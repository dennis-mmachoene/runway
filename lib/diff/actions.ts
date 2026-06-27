'use server';

import { cookies } from 'next/headers';
import { LAST_SEEN_COOKIE } from './last-seen';

/**
 * Stamp "now" as the last time the gauge was seen. Called from the client after
 * the page has rendered (so this visit's diff used the *previous* value).
 */
export async function markSeen(): Promise<void> {
  const store = await cookies();
  store.set(LAST_SEEN_COOKIE, new Date().toISOString(), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}
