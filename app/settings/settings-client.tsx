'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { updateSettings } from '@/lib/settings/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const selectClass =
  'mt-1 flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]';

interface SettingsView {
  floor_default: number;
  lump_threshold: number;
  savings_mode: string;
  leftover_mode: string;
}

export function SettingsClient({ settings }: { settings: SettingsView }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>The numbers that shape your runway</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setSaved(false);
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              const res = await updateSettings(fd);
              if (!res.ok) setError(res.error);
              else {
                setSaved(true);
                router.refresh();
              }
            });
          }}
          className="flex flex-col gap-4"
        >
          <label className="text-xs text-muted-foreground">
            Floor — the line you never cross (safe-to-spend is above this)
            <Input name="floor_default" type="number" step="0.01" min="0" defaultValue={settings.floor_default} />
          </label>
          <label className="text-xs text-muted-foreground">
            Lump threshold — spend at/above this is offered as a one-off (lump)
            <Input name="lump_threshold" type="number" step="0.01" min="1" defaultValue={settings.lump_threshold} />
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
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          {saved && !error && <p className="text-sm text-muted-foreground" role="status">Saved.</p>}
        </form>
      </CardContent>
    </Card>
  );
}
