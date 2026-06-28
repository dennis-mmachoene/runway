import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OnboardingClient } from './onboarding-client';

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

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
