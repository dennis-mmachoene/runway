'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type IconProps = { className?: string };
const I = (d: string) => ({ className }: IconProps) =>
  (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn('size-5', className)} aria-hidden>
      <path d={d} />
    </svg>
  );

const HomeIcon = I('M3 11l9-8 9 8M5 10v10h14V10');
const WalletIcon = I('M3 7h18v12H3zM3 7l2-3h12l2 3M16 13h2');
const ReconcileIcon = I('M4 7h11M4 7l3-3M4 7l3 3M20 17H9M20 17l-3-3M20 17l-3 3');
const InsightsIcon = I('M4 19V5M4 19h16M8 16v-4M12 16V8M16 16v-7');

interface Group {
  key: string;
  label: string;
  href: string;
  Icon: (p: IconProps) => React.JSX.Element;
  match: (p: string) => boolean;
  sub?: [string, string][];
}

const GROUPS: Group[] = [
  { key: 'today', label: 'Today', href: '/today', Icon: HomeIcon, match: (p) => p === '/today' },
  {
    key: 'money',
    label: 'Money',
    href: '/income',
    Icon: WalletIcon,
    match: (p) => ['/income', '/commitments', '/subscriptions', '/settings'].some((x) => p.startsWith(x)),
    sub: [
      ['/income', 'Income'],
      ['/commitments', 'Commitments'],
      ['/subscriptions', 'Subscriptions'],
      ['/settings', 'Settings'],
    ],
  },
  { key: 'reconcile', label: 'Reconcile', href: '/reconcile', Icon: ReconcileIcon, match: (p) => p.startsWith('/reconcile') },
  {
    key: 'insights',
    label: 'Insights',
    href: '/replay',
    Icon: InsightsIcon,
    match: (p) => ['/replay', '/simulate', '/ask'].some((x) => p.startsWith(x)),
    sub: [
      ['/replay', 'Replay'],
      ['/simulate', 'What-if'],
      ['/ask', 'Ask'],
    ],
  },
];

export function PrimaryNav() {
  const pathname = usePathname() ?? '';
  return (
    <>
      {/* Desktop left rail */}
      <nav className="fixed inset-y-0 left-0 z-20 hidden w-48 flex-col gap-1 border-r bg-background p-3 lg:flex" aria-label="Primary">
        <span className="px-2 py-3 text-sm font-semibold tracking-tight">Runway</span>
        {GROUPS.map((g) => {
          const active = g.match(pathname);
          return (
            <Link
              key={g.key}
              href={g.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm',
                active ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground hover:bg-accent/60',
              )}
            >
              <g.Icon />
              {g.label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t bg-background lg:hidden" aria-label="Primary">
        {GROUPS.map((g) => {
          const active = g.match(pathname);
          return (
            <Link
              key={g.key}
              href={g.href}
              aria-current={active ? 'page' : undefined}
              className={cn('flex min-h-14 flex-col items-center justify-center gap-1 text-[11px]', active ? 'text-foreground' : 'text-muted-foreground')}
            >
              <g.Icon className="size-5" />
              {g.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export function SectionNav() {
  const pathname = usePathname() ?? '';
  const group = GROUPS.find((g) => g.match(pathname));
  if (!group?.sub) return null;
  return (
    <div className="mb-2 flex gap-1 overflow-x-auto" aria-label={`${group.label} sections`}>
      {group.sub.map(([href, label]) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'min-h-11 whitespace-nowrap rounded-md px-3 py-2 text-sm',
              active ? 'bg-secondary font-medium text-foreground' : 'text-muted-foreground hover:bg-accent/60',
            )}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
