import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { IncomeEvent } from '@/lib/db/types';
import { AppShell } from '@/components/app-shell';
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
    <AppShell title="Income">
      <IncomeClient income={income} today={today} />
    </AppShell>
  );
}
