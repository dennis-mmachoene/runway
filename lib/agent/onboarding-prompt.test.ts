import { describe, it, expect } from 'vitest';
import { buildOnboardingInstruction } from './onboarding-prompt';

describe('buildOnboardingInstruction', () => {
  const s = buildOnboardingInstruction('Dennis');

  it('addresses the owner by name', () => {
    expect(s).toContain('onboarding Dennis');
    expect(s).toContain('Address them as Dennis');
  });

  it('covers the required topics', () => {
    for (const topic of ['Income', 'Commitments', 'Subscriptions', 'floor', 'Savings', 'Spending habits']) {
      expect(s).toContain(topic);
    }
  });

  it('asks one thing at a time and never assumes', () => {
    expect(s).toContain('ONE focused question at a time');
    expect(s).toContain('Never assume');
  });

  it('specifies the JSON turn contract with a proposal', () => {
    expect(s).toContain('"reply": string');
    expect(s).toContain('"done": boolean');
    expect(s).toContain('"proposal"');
    expect(s).toContain('"savingsMode": "automatic"|"best_effort"');
  });
});
