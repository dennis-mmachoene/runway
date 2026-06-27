import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { AskClient } from './ask-client';

export default async function AskPage() {
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
        <h1 className="text-sm font-medium text-muted-foreground">Ask</h1>
      </header>
      <AskClient />
    </main>
  );
}
