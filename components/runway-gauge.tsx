import { formatDate, formatZAR } from '@/lib/format';

/**
 * Draws the metaphor the app is named after: a descent from today's balance to
 * the floor, at the current flow rate.
 *
 * Honest in BOTH axes. Vertical: a linear scale from 0 to today's balance, no
 * truncated axis. Horizontal: time until the next expected income (the cycle
 * window), so the line crosses the floor exactly where it really does — a near
 * crossing reads steep and early (urgent), a comfortable one shallow and late.
 * If the runway outlasts the window, the line exits the right edge still above
 * the floor: you make it to payday. Pure inline SVG, no dependency.
 */
export function RunwayGauge({
  pool,
  floor,
  runwayDate,
  runwayDays,
  cycleDaysRemaining,
  expectedEndDate = null,
  learning,
  depleted = false,
}: {
  pool: number;
  floor: number;
  runwayDate: string | null;
  /** Days from today until the floor is hit. `null` at cold start. */
  runwayDays?: number | null;
  /** Days from today until the next expected income — the x-axis span. */
  cycleDaysRemaining?: number;
  /** Estimated date of the next income, labelling the right edge. */
  expectedEndDate?: string | null;
  learning: boolean;
  /** Cycle is spent down to (or below) the floor — distinct from "still learning". */
  depleted?: boolean;
}) {
  const W = 320;
  const H = 120;
  const pad = 18;
  const left = 6;
  const right = W - 6;
  const total = Math.max(pool + floor, 1);
  const innerH = H - 2 * pad;
  const y = (v: number) => H - pad - (Math.max(0, Math.min(v, total)) / total) * innerH;
  const yTop = y(total);
  const yFloor = y(floor);
  const plotW = right - left;

  const descending =
    !learning && !depleted && runwayDate != null && pool > 0 && (runwayDays ?? 0) > 0;

  // Where the descent lands relative to the cycle window.
  const span = Math.max(1, cycleDaysRemaining ?? runwayDays ?? 1);
  const rd = runwayDays ?? 0;
  const frac = rd / span; // <1 hits floor before next income; ≥1 outlasts it
  const hitsWithinCycle = descending && frac <= 1;
  const xCross = left + Math.min(1, frac) * plotW;
  // If it outlasts the window, the y where the line exits the right edge.
  const yExit = yTop + (yFloor - yTop) * Math.min(1, span / Math.max(rd, 1));

  const ariaLabel = depleted
    ? "Runway: you're at your floor — nothing safe to spend."
    : !descending
      ? `Runway: ${formatZAR(pool)} above your floor; still learning your pace.`
      : hitsWithinCycle
        ? `Runway: ${formatZAR(pool)} above your floor, hitting it on ${formatDate(runwayDate!)} — before your next income.`
        : `Runway: ${formatZAR(pool)} above your floor; at this pace you reach your next income on ${formatDate(runwayDate!)} with room to spare.`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={ariaLabel} className="animate-draw">
      {depleted ? (
        <text x={(left + right) / 2} y={yFloor - 8} textAnchor="middle" fontSize="10" fill="var(--color-caution)">
          you&apos;re at your floor
        </text>
      ) : descending ? (
        hitsWithinCycle ? (
          <>
            {/* descent reaches the floor BEFORE the next income — the urgent case */}
            <polygon points={`${left},${yTop} ${xCross},${yFloor} ${left},${yFloor}`} fill="var(--color-safe)" opacity="0.14" />
            <line x1={left} y1={yTop} x2={xCross} y2={yFloor} stroke="var(--color-brand)" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx={xCross} cy={yFloor} r="3.5" fill="var(--color-floor)" />
            <text x={Math.max(left + 20, Math.min(xCross, right - 30))} y={yFloor - 7} textAnchor="middle" fontSize="10" fill="var(--color-floor)">
              {formatDate(runwayDate!)}
            </text>
          </>
        ) : (
          <>
            {/* descent outlasts the window — you reach your next income with room */}
            <polygon points={`${left},${yTop} ${right},${yExit} ${right},${yFloor} ${left},${yFloor}`} fill="var(--color-safe)" opacity="0.14" />
            <line x1={left} y1={yTop} x2={right} y2={yExit} stroke="var(--color-brand)" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx={right} cy={yExit} r="3.5" fill="var(--color-brand)" />
          </>
        )
      ) : (
        <>
          <rect x={left} y={yTop} width={right - left} height={Math.max(0, yFloor - yTop)} fill="var(--color-safe)" opacity="0.14" />
          <text x={(left + right) / 2} y={(yTop + yFloor) / 2} textAnchor="middle" fontSize="10" fill="var(--color-muted-foreground, currentColor)">
            still learning your pace
          </text>
        </>
      )}

      {/* the next-income marker — the right edge of the window (estimated cadence) */}
      {descending && expectedEndDate && (
        <>
          <line x1={right} y1={yTop - 4} x2={right} y2={yFloor} stroke="var(--color-muted-foreground, currentColor)" strokeWidth="1" strokeDasharray="2 3" opacity="0.5" />
          <text x={right} y={yTop - 7} textAnchor="end" fontSize="8" fill="var(--color-muted-foreground, currentColor)" opacity="0.8">
            next pay ~{formatDate(expectedEndDate)}
          </text>
        </>
      )}

      {/* the floor — the line you never cross */}
      <line x1={left} y1={yFloor} x2={right} y2={yFloor} stroke="var(--color-floor)" strokeWidth="1.5" strokeDasharray="4 3" />
      <text x={left} y={yFloor + 12} fontSize="9" fill="var(--color-floor)">
        floor {formatZAR(floor)}
      </text>
    </svg>
  );
}
