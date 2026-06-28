import { formatDate, formatZAR } from '@/lib/format';

/**
 * Draws the metaphor the app is named after: a descent from today's balance to
 * the floor, at the current flow rate (V1). Honest — a linear scale from 0 to the
 * opening balance, no truncated axis. Pure inline SVG, no dependency.
 */
export function RunwayGauge({
  pool,
  floor,
  runwayDate,
  learning,
}: {
  pool: number;
  floor: number;
  runwayDate: string | null;
  learning: boolean;
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

  const descending = !learning && runwayDate != null && pool > 0;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={
        descending
          ? `Runway: ${formatZAR(pool)} above your floor, descending to it on ${formatDate(runwayDate!)}.`
          : `Runway: ${formatZAR(pool)} above your floor; still learning your pace.`
      }
      className="animate-draw"
    >
      {descending ? (
        <>
          <polygon
            points={`${left},${yTop} ${right},${yFloor} ${left},${yFloor}`}
            fill="var(--color-safe)"
            opacity="0.14"
          />
          <line x1={left} y1={yTop} x2={right} y2={yFloor} stroke="var(--color-brand)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx={right} cy={yFloor} r="3.5" fill="var(--color-brand)" />
          <text x={right} y={yFloor - 7} textAnchor="end" fontSize="10" fill="var(--color-floor)">
            {formatDate(runwayDate!)}
          </text>
        </>
      ) : (
        <>
          <rect x={left} y={yTop} width={right - left} height={Math.max(0, yFloor - yTop)} fill="var(--color-safe)" opacity="0.14" />
          <text x={(left + right) / 2} y={(yTop + yFloor) / 2} textAnchor="middle" fontSize="10" fill="var(--color-muted-foreground, currentColor)">
            still learning your pace
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
