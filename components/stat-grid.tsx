import { Money } from '@/components/money';

export interface Stat {
  label: string;
  amount: number;
}

/** The quiet secondary breakdown — demoted so it doesn't compete with the hero (H2). */
export function StatGrid({ items }: { items: Stat[] }) {
  return (
    <dl className="grid grid-cols-2 gap-y-1 text-xs text-muted-foreground">
      {items.map((s) => (
        <div key={s.label} className="contents">
          <dt>{s.label}</dt>
          <dd className="text-right text-foreground/80">
            <Money amount={s.amount} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
