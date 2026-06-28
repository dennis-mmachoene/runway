import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { ExtractionProposal } from '@/lib/db/types';
import { signedPreviews } from '@/lib/agent/previews';
import { AppShell } from '@/components/app-shell';
import { InboxClient } from './inbox-client';

export default async function InboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const { data } = await supabase
    .from('extraction_proposals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  const proposals = (data as ExtractionProposal[]) ?? [];
  const previews = await signedPreviews(supabase, proposals);

  return (
    <AppShell title="Inbox">
      <InboxClient proposals={proposals} previews={previews} />
    </AppShell>
  );
}
