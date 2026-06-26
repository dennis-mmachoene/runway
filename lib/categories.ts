/**
 * The flat category vocabulary. Mirrors the `category` enum in the database
 * (supabase/migrations/0001_init.sql). Keep the two in sync — the parser and
 * reconcile both map into this set, and a controlled vocabulary keeps the data
 * clean for the deferred layers.
 */
export const CATEGORIES = [
  'groceries',
  'eating_out',
  'transport',
  'bills',
  'shopping',
  'health',
  'entertainment',
  'cash',
  'other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}
