import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { SimulateClient } from './simulate-client';

export default async function SimulatePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/today">← Back</Link>
        </Button>
        <h1 className="text-sm font-medium text-muted-foreground">What-if</h1>
      </header>
      <p className="text-sm text-muted-foreground">
        Not &ldquo;can I afford it?&rdquo; but &ldquo;what does it cost my future self?&rdquo; Stack the
        shocks and watch both futures.
      </p>
      <SimulateClient />
    </main>
  );
}
