import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getOpenCycle } from '@/lib/cycles';
import { OnboardingClient } from './onboarding-client';

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  // O1: onboarding is first-run only. Once a cycle exists, re-running it would
  // double-insert commitments and open a second cycle — so send them home.
  const open = await getOpenCycle(supabase);
  if (open) redirect('/today');

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-6">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Let&apos;s set up Runway</h1>
        <p className="text-sm text-muted-foreground">
          A quick conversation — I&apos;ll build your picture, then you confirm before anything is
          saved.
        </p>
      </header>
      <OnboardingClient />
    </main>
  );
}
