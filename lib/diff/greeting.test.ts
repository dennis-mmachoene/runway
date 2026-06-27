import { describe, it, expect } from 'vitest';
import { buildGreeting, type DiffSummary } from './greeting';

function base(o: Partial<DiffSummary> = {}): DiffSummary {
  return {
    firstLook: false,
    incomeConfirmedCount: 0,
    commitmentsPaidCount: 0,
    flowSpent: 0,
    notable: [],
    onTrack: true,
    learning: false,
    ...o,
  };
}

describe('buildGreeting', () => {
  it('first look is calm and generic', () => {
    expect(buildGreeting(base({ firstLook: true })).headline).toBe('Here’s where you stand.');
  });

  it('summarises the diff in one line with an on-track tail', () => {
    const g = buildGreeting(base({ incomeConfirmedCount: 1, commitmentsPaidCount: 1, flowSpent: 1200 }));
    expect(g.headline).toContain('Since you last looked —');
    expect(g.headline).toContain('income in');
    expect(g.headline).toContain('a commitment paid');
    expect(g.headline).toContain('spent');
    expect(g.headline).toContain('still on track');
  });

  it('says nothing changed when there are no events', () => {
    expect(buildGreeting(base()).headline).toBe('Nothing’s changed since you last looked.');
  });

  it('uses the learning tail before there is a pace', () => {
    expect(buildGreeting(base({ flowSpent: 50, learning: true })).headline).toContain('still learning your pace');
  });

  it('surfaces a single notable aside', () => {
    const g = buildGreeting(base({ notable: ['Electricity came in R500 under — back in your pocket.'] }));
    expect(g.notable).toContain('under');
  });
});
