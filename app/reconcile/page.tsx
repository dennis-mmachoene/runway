import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/app-shell';
import { ReconcileClient } from './reconcile-client';

export default async function ReconcilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  return (
    <AppShell title="Reconcile">
      <p className="mb-4 text-sm text-muted-foreground">
        Import a bank statement to correct the month. Daily logs don&apos;t have to be perfect — this
        is where truth catches up.
      </p>
      <ReconcileClient />
    </AppShell>
  );
}
