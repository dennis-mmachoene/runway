import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
const password = process.env.OWNER_PASSWORD;

if (!url || !secret || !email || !password) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, OWNER_EMAIL, or OWNER_PASSWORD in .env.local',
  );
  process.exit(1);
}

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function getOrCreateOwner(): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (!error && data.user) {
    console.log(`Created owner user: ${data.user.email}`);
    return data.user.id;
  }

  // Already exists — find the id (we don't reset an existing password here).
  const { data: list, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) {
    console.error('Lookup failed:', listErr.message);
    process.exit(1);
  }
  const existing = list.users.find((u) => u.email?.toLowerCase() === email);
  if (!existing) {
    console.error('Owner exists but could not be found:', error?.message);
    process.exit(1);
  }
  console.log(`Owner ${email} already exists — leaving password unchanged.`);
  return existing.id;
}

async function main() {
  const userId = await getOrCreateOwner();
  // Service-role insert bypasses RLS, so set user_id explicitly (auth.uid() is null here).
  const { error } = await admin.from('settings').upsert({ user_id: userId }, { onConflict: 'user_id' });
  if (error) {
    console.error('Could not seed settings (did you run the schema migration first?):', error.message);
    process.exit(1);
  }
  console.log('Settings row ensured. Seed complete.');
}

main();
