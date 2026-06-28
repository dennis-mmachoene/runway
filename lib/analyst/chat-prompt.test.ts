import { describe, it, expect } from 'vitest';
import { buildChatSystemInstruction } from './chat-prompt';

describe('buildChatSystemInstruction', () => {
  const s = buildChatSystemInstruction('{"safeToSpend":{"pool":2000}}');

  it('embeds the data snapshot', () => {
    expect(s).toContain('"pool":2000');
  });

  it('frames it as a conversation, not a Q&A', () => {
    expect(s.toLowerCase()).toContain('conversation');
  });

  it('keeps facts grounded and forbids invention', () => {
    expect(s).toContain('ONLY from the JSON');
    expect(s).toContain('Never invent or guess a number');
  });

  it('allows general money talk but not reckless advice', () => {
    expect(s.toLowerCase()).toContain('not a licensed advisor');
  });
});
