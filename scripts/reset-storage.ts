import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

/**
 * Empties the private 'documents' storage bucket — the part of the reset that
 * SQL can't do (Supabase blocks direct deletes on storage.objects). Uses the
 * Storage API via the service-role key, which is the sanctioned path. Pairs with
 * supabase/reset.sql (which clears the data tables).
 *
 * Run: npm run reset:storage
 */

const BUCKET = 'documents';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !secret) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local');
  process.exit(1);
}

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Recursively collect every object path under a prefix (files live under
 *  `${userId}/...`, so the top level is folders). */
async function listAll(prefix = ''): Promise<string[]> {
  const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error) {
    console.error(`Could not list "${prefix || '/'}":`, error.message);
    process.exit(1);
  }
  const paths: string[] = [];
  for (const item of data ?? []) {
    const full = prefix ? `${prefix}/${item.name}` : item.name;
    // Folders come back with a null id; recurse. Files have an id.
    if (item.id === null) paths.push(...(await listAll(full)));
    else paths.push(full);
  }
  return paths;
}

async function main() {
  const paths = await listAll();
  if (!paths.length) {
    console.log(`Bucket "${BUCKET}" is already empty.`);
    return;
  }
  const { error } = await admin.storage.from(BUCKET).remove(paths);
  if (error) {
    console.error('Remove failed:', error.message);
    process.exit(1);
  }
  console.log(`Removed ${paths.length} file(s) from "${BUCKET}". Bucket is clean.`);
}

main();
