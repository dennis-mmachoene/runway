import * as React from 'react';

/** A real first-run moment, not an afterthought (E1). */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed p-8 text-center">
      {/* a hint of the runway metaphor: a line descending to a floor */}
      <svg width="96" height="44" viewBox="0 0 96 44" fill="none" aria-hidden className="text-floor">
        <line x1="0" y1="40" x2="96" y2="40" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M2 6 L70 40" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="70" cy="40" r="3" fill="var(--color-brand)" />
      </svg>
      <p className="text-lg font-medium">{title}</p>
      {children && <div className="max-w-xs text-sm text-muted-foreground">{children}</div>}
      {action}
    </div>
  );
}
