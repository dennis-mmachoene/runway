import { formatZAR } from '@/lib/format';

export interface DiffSummary {
  /** No prior "last seen" — first open. */
  firstLook: boolean;
  incomeConfirmedCount: number;
  commitmentsPaidCount: number;
  flowSpent: number;
  /** Notable one-liners (e.g. a variable bill landing under reserve). */
  notable: string[];
  /** Runway is healthy. */
  onTrack: boolean;
  /** Not enough flow history to judge pace yet. */
  learning: boolean;
}

export interface Greeting {
  headline: string;
  notable: string | null;
}

function joinClauses(clauses: string[]): string {
  if (clauses.length === 1) return clauses[0];
  if (clauses.length === 2) return `${clauses[0]} and ${clauses[1]}`;
  return `${clauses.slice(0, -1).join(', ')}, and ${clauses[clauses.length - 1]}`;
}

/**
 * The live gauge greeting: one calm line about what changed since you last
 * looked, plus at most one notable aside. Never a ledger.
 */
export function buildGreeting(s: DiffSummary): Greeting {
  const notable = s.notable[0] ?? null;

  if (s.firstLook) {
    return { headline: 'Here’s where you stand.', notable };
  }

  const clauses: string[] = [];
  if (s.incomeConfirmedCount > 0) clauses.push('income in');
  if (s.commitmentsPaidCount > 0) {
    clauses.push(s.commitmentsPaidCount === 1 ? 'a commitment paid' : `${s.commitmentsPaidCount} commitments paid`);
  }
  if (s.flowSpent > 0) clauses.push(`${formatZAR(s.flowSpent)} spent`);

  if (clauses.length === 0) {
    return { headline: 'Nothing’s changed since you last looked.', notable };
  }

  const tail = s.learning ? 'still learning your pace' : s.onTrack ? 'still on track' : 'keep an eye on it';
  return { headline: `Since you last looked — ${joinClauses(clauses)}, ${tail}.`, notable };
}
