import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/cycles';
import { Button } from '@/components/ui/button';
import { SettingsClient } from './settings-client';

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const settings = await getSettings(supabase);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/today">← Back</Link>
        </Button>
        <h1 className="text-sm font-medium text-muted-foreground">Settings</h1>
      </header>
      <SettingsClient
        settings={{
          floor_default: settings.floor_default,
          lump_threshold: settings.lump_threshold,
          savings_mode: settings.savings_mode,
          leftover_mode: settings.leftover_mode,
        }}
      />
      <p className="text-xs text-muted-foreground">
        See <span className="font-mono">SOAK.md</span> for the four decisions to lock during your
        first cycle.
      </p>
    </main>
  );
}
