import type { MatchableLog, StatementLine } from './types';

const DAY = 86_400_000;

function daysApart(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / DAY;
}

/**
 * Best matching log for a statement line: same absolute amount (±1c) within a
 * date window, preferring a merchant-name hint. Crucially the window is by date,
 * so a line near a cycle boundary still matches a log in the adjacent cycle.
 */
export function findMatch(
  line: StatementLine,
  logs: MatchableLog[],
  windowDays = 3,
): string | null {
  const target = Math.abs(line.amount);
  const descLower = line.description.toLowerCase();
  const candidates = logs.filter(
    (l) =>
      Math.abs(Math.abs(Number(l.amount)) - target) < 0.01 &&
      daysApart(l.logged_at, line.date) <= windowDays,
  );
  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    const aHint = a.merchant && descLower.includes(a.merchant.toLowerCase()) ? 0 : 1;
    const bHint = b.merchant && descLower.includes(b.merchant.toLowerCase()) ? 0 : 1;
    if (aHint !== bHint) return aHint - bHint;
    return daysApart(a.logged_at, line.date) - daysApart(b.logged_at, line.date);
  });
  return candidates[0].id;
}

/** Match a set of spend lines to logs, each log used at most once. */
export function matchAll(
  spend: StatementLine[],
  logs: MatchableLog[],
  windowDays = 3,
): (string | null)[] {
  const used = new Set<string>();
  return spend.map((line) => {
    const id = findMatch(
      line,
      logs.filter((l) => !used.has(l.id)),
      windowDays,
    );
    if (id) used.add(id);
    return id;
  });
}
