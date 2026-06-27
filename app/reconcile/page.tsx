import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { ReconcileClient } from './reconcile-client';

export default async function ReconcilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/today">← Back</Link>
        </Button>
        <h1 className="text-sm font-medium text-muted-foreground">Reconcile</h1>
      </header>
      <p className="text-sm text-muted-foreground">
        Import a bank statement to correct the month. Daily logs don&apos;t have to be perfect — this
        is where truth catches up.
      </p>
      <ReconcileClient />
    </main>
  );
}
