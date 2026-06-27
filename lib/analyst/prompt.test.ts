import { describe, it, expect } from 'vitest';
import { buildAnalystPrompt } from './prompt';

describe('buildAnalystPrompt', () => {
  const p = buildAnalystPrompt('How much on coffee this year?', '{"recent":[{"merchant":"Coffee","amount":38}]}');

  it('embeds the question and the data', () => {
    expect(p).toContain('How much on coffee this year?');
    expect(p).toContain('"merchant":"Coffee"');
  });

  it('enforces the grounding guardrails', () => {
    expect(p).toContain('ONLY from the JSON data');
    expect(p).toContain('say you do not have that yet');
    expect(p).toContain('No generic financial advice');
  });
});
