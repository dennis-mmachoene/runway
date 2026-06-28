import { cn } from '@/lib/utils';
import { formatZAR } from '@/lib/format';

/** Money with tabular figures so digits stop jittering as the number moves (T1). */
export function Money({
  amount,
  withCents = false,
  className,
}: {
  amount: number;
  withCents?: boolean;
  className?: string;
}) {
  return <span className={cn('tabular-nums', className)}>{formatZAR(amount, withCents)}</span>;
}
