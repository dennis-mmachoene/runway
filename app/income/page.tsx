import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import type { IncomeEvent } from '@/lib/db/types';
import { IncomeClient } from './income-client';

export default async function IncomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const { data } = await supabase
    .from('income_events')
    .select('*')
    .order('event_at', { ascending: false });
  const income = (data as IncomeEvent[]) ?? [];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/today">← Back</Link>
        </Button>
        <h1 className="text-sm font-medium text-muted-foreground">Income</h1>
      </header>
      <IncomeClient income={income} today={today} />
    </main>
  );
}
