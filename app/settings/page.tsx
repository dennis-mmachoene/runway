import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/cycles';
import { AppShell } from '@/components/app-shell';
import { SettingsClient } from './settings-client';

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const settings = await getSettings(supabase);

  return (
    <AppShell title="Settings">
      <SettingsClient
        settings={{
          floor_default: settings.floor_default,
          lump_threshold: settings.lump_threshold,
          savings_mode: settings.savings_mode,
          leftover_mode: settings.leftover_mode,
        }}
      />
      <p className="mt-4 text-xs text-muted-foreground">
        See <span className="font-mono">SOAK.md</span> for the four decisions to lock during your
        first cycle.
      </p>
    </AppShell>
  );
}
