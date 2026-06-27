import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getOpenCycle } from '@/lib/cycles';
import { Button } from '@/components/ui/button';
import type { Commitment } from '@/lib/db/types';
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

  // Which commitments are already paid in the open cycle (have a commitment-tx).
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
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/today">← Back</Link>
        </Button>
        <h1 className="text-sm font-medium text-muted-foreground">Commitments</h1>
      </header>
      <CommitmentsClient commitments={commitments} paidIds={paidIds} />
    </main>
  );
}
