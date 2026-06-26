'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OWNER_EMAIL } from '@/lib/env.server';

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

export type SignInResult =
  | { ok: true; next: 'done' | 'mfa_enroll' | 'mfa_challenge' }
  | { ok: false; error: string };

/**
 * Password sign-in (factor 1). Lock #3: server-side allowlist of one. Returns a
 * neutral error for any non-owner email or bad password so nothing leaks. On
 * success, TOTP is MANDATORY — the caller is routed to enrollment (first time)
 * or challenge before any protected route will accept the session (aal2).
 */
export async function signIn(emailRaw: string, password: string): Promise<SignInResult> {
  const email = normalize(emailRaw);
  if (email !== OWNER_EMAIL) return { ok: false, error: 'Invalid credentials.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: 'Invalid credentials.' };

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === 'aal2') return { ok: true, next: 'done' };
  if (aal?.nextLevel === 'aal2') return { ok: true, next: 'mfa_challenge' };
  return { ok: true, next: 'mfa_enroll' };
}

export type EnrollResult =
  | { ok: true; factorId: string; qrCode: string; secret: string }
  | { ok: false; error: string };

export async function startTotpEnrollment(): Promise<EnrollResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated.' };
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'Authenticator',
    issuer: 'Runway',
  });
  if (error || !data) return { ok: false, error: 'Could not start enrollment.' };
  return { ok: true, factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export type StepResult = { ok: true } | { ok: false; error: string };

export async function confirmTotpEnrollment(factorId: string, code: string): Promise<StepResult> {
  const supabase = await createClient();
  const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
  if (cErr || !challenge) return { ok: false, error: 'Could not verify. Try again.' };
  const { error: vErr } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: code.trim(),
  });
  if (vErr) return { ok: false, error: 'Invalid code.' };
  return { ok: true };
}

export async function verifyTotpChallenge(code: string): Promise<StepResult> {
  const supabase = await createClient();
  const { data: factors, error: fErr } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp?.[0];
  if (fErr || !factor) return { ok: false, error: 'No authenticator enrolled.' };
  const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: factor.id });
  if (cErr || !challenge) return { ok: false, error: 'Could not verify. Try again.' };
  const { error: vErr } = await supabase.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challenge.id,
    code: code.trim(),
  });
  if (vErr) return { ok: false, error: 'Invalid code.' };
  return { ok: true };
}

export async function lock(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
