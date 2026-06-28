import * as React from 'react';
import { lock } from '@/lib/auth/actions';
import { PrimaryNav, SectionNav } from '@/components/nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';

/**
 * The persistent app frame (N1/S1): grouped nav (rail on desktop, tab bar on
 * mobile), a single header with the theme toggle + Lock, and the section sub-nav.
 * Retires the copy-pasted per-page headers.
 */
export function AppShell({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="lg:pl-48">
      <PrimaryNav />
      <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-4 lg:pb-10">
        <header className="mb-3 flex items-center justify-between">
          <h1 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title ?? 'Runway'}
          </h1>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <form action={lock}>
              <Button variant="ghost" size="sm" type="submit" className="min-h-9">
                Lock
              </Button>
            </form>
          </div>
        </header>
        <SectionNav />
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}
