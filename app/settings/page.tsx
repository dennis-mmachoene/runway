import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/cycles';
import { updateSettings } from '@/lib/settings/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const selectClass =
  'mt-1 flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]';

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

      <Card>
        <CardHeader>
          <CardTitle>The numbers that shape your runway</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateSettings} className="flex flex-col gap-4">
            <label className="text-xs text-muted-foreground">
              Floor — the line you never cross (safe-to-spend is above this)
              <Input
                name="floor_default"
                type="number"
                step="0.01"
                min="0"
                defaultValue={settings.floor_default}
              />
            </label>

            <label className="text-xs text-muted-foreground">
              Lump threshold — spend at/above this is offered as a one-off (lump)
              <Input
                name="lump_threshold"
                type="number"
                step="0.01"
                min="1"
                defaultValue={settings.lump_threshold}
              />
            </label>

            <label className="text-xs text-muted-foreground">
              Savings — automatic is sacred (off the top); best-effort competes with flexible
              <select name="savings_mode" defaultValue={settings.savings_mode} className={selectClass}>
                <option value="automatic">Automatic (sacred)</option>
                <option value="best_effort">Best-effort</option>
              </select>
            </label>

            <label className="text-xs text-muted-foreground">
              Leftover at cycle-end — never silently reset
              <select name="leftover_mode" defaultValue={settings.leftover_mode} className={selectClass}>
                <option value="sweep_emergency">Sweep to emergency fund</option>
                <option value="roll_buffer">Roll into a buffer</option>
              </select>
            </label>

            <Button type="submit">Save</Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        See <span className="font-mono">SOAK.md</span> for the four decisions to lock during your
        first cycle.
      </p>
    </main>
  );
}
