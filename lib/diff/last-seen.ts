import 'server-only';

import { cookies } from 'next/headers';

export const LAST_SEEN_COOKIE = 'runway_seen';

/** The timestamp of the previous visit to the gauge, or null on first open. */
export async function getLastSeen(): Promise<Date | null> {
  const store = await cookies();
  const value = store.get(LAST_SEEN_COOKIE)?.value;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
