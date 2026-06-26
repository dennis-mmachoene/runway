'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import {
  signIn,
  startTotpEnrollment,
  confirmTotpEnrollment,
  verifyTotpChallenge,
} from '@/lib/auth/actions';

type Step = 'enter' | 'password' | 'mfa_enroll' | 'mfa_challenge';

export default function EnterGate() {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>('enter');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [enroll, setEnroll] = React.useState<{
    factorId: string;
    qrCode: string;
    secret: string;
  } | null>(null);

  function goToday() {
    router.push('/today');
    router.refresh();
  }

  function onPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await signIn(email, password);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCode('');
      if (res.next === 'done') {
        goToday();
        return;
      }
      if (res.next === 'mfa_challenge') {
        setStep('mfa_challenge');
        return;
      }
      const en = await startTotpEnrollment();
      if (!en.ok) {
        setError(en.error);
        return;
      }
      setEnroll({ factorId: en.factorId, qrCode: en.qrCode, secret: en.secret });
      setStep('mfa_enroll');
    });
  }

  function onEnrollSubmit() {
    if (!enroll) return;
    setError(null);
    startTransition(async () => {
      const res = await confirmTotpEnrollment(enroll.factorId, code);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      goToday();
    });
  }

  function onChallengeSubmit() {
    setError(null);
    startTransition(async () => {
      const res = await verifyTotpChallenge(code);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      goToday();
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {step === 'enter' && (
          <div className="flex justify-center">
            <Button size="lg" onClick={() => setStep('password')}>
              Enter
            </Button>
          </div>
        )}

        {step === 'password' && (
          <form onSubmit={onPasswordSubmit} className="flex flex-col gap-4">
            <Input
              type="email"
              autoComplete="username"
              autoFocus
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              type="password"
              autoComplete="current-password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" disabled={pending}>
              {pending ? 'Checking…' : 'Continue'}
            </Button>
          </form>
        )}

        {step === 'mfa_enroll' && enroll && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-muted-foreground">
              Scan this with your authenticator app, then enter the code.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enroll.qrCode} alt="TOTP QR code" className="h-44 w-44" />
            <code className="text-xs break-all text-muted-foreground">{enroll.secret}</code>
            <InputOTP maxLength={6} value={code} onChange={setCode}>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <Button className="w-full" disabled={pending || code.length < 6} onClick={onEnrollSubmit}>
              {pending ? 'Verifying…' : 'Confirm'}
            </Button>
          </div>
        )}

        {step === 'mfa_challenge' && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-muted-foreground">Enter the code from your authenticator app.</p>
            <InputOTP maxLength={6} value={code} onChange={setCode}>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <Button className="w-full" disabled={pending || code.length < 6} onClick={onChallengeSubmit}>
              {pending ? 'Verifying…' : 'Verify'}
            </Button>
          </div>
        )}

        {error && <p className="mt-4 text-center text-sm text-destructive">{error}</p>}
      </div>
    </main>
  );
}
