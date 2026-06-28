import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getOpenCycle } from '@/lib/cycles';
import type { Commitment } from '@/lib/db/types';
import { AppShell } from '@/components/app-shell';
import { CommitmentsClient } from './commitments-client';

export default async function CommitmentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const { data } = await supabase
    .from('commitments')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  const commitments = (data as Commitment[]) ?? [];

  let paidIds: string[] = [];
  const open = await getOpenCycle(supabase);
  if (open?.start_at) {
    const { data: txs } = await supabase
      .from('transactions')
      .select('commitment_id')
      .eq('kind', 'commitment')
      .gte('logged_at', open.start_at);
    paidIds = ((txs as { commitment_id: string | null }[]) ?? [])
      .map((t) => t.commitment_id)
      .filter((id): id is string => !!id);
  }

  return (
    <AppShell title="Commitments">
      <CommitmentsClient commitments={commitments} paidIds={paidIds} />
    </AppShell>
  );
}
