import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/app-shell';
import { SimulateClient } from './simulate-client';

export default async function SimulatePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  return (
    <AppShell title="What-if">
      <p className="mb-4 text-sm text-muted-foreground">
        Not &ldquo;can I afford it?&rdquo; but &ldquo;what does it cost my future self?&rdquo; Stack the
        shocks and watch both futures.
      </p>
      <SimulateClient />
    </AppShell>
  );
}
