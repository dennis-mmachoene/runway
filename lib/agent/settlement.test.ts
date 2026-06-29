import { describe, it, expect } from 'vitest';
import { classifyBill, type BillCommitment } from './settlement';

const commitments: BillCommitment[] = [
  { id: 'rent', name: 'Greenstone Rentals', amount: 8000, variable_high: null },
  { id: 'gym', name: 'Virgin Active', amount: 499, variable_high: null },
];

describe('classifyBill (B1)', () => {
  it('settles only on a strong payee match', () => {
    const m = classifyBill('GREENSTONE RENTALS', 8000, commitments);
    expect(m.kind).toBe('settle');
    expect(m.kind === 'settle' && m.commitment.id).toBe('rent');
  });

  it('does NOT settle on an amount coincidence with an unrelated payee — it asks', () => {
    // R8,200 furniture vs R8,000 rent: would have wrongly settled before B1.
    const m = classifyBill('Coricraft Furniture', 8200, commitments);
    expect(m.kind).toBe('ask');
    expect(m.kind === 'ask' && m.commitment.id).toBe('rent');
  });

  it('returns none for an unrelated payee and unrelated amount', () => {
    expect(classifyBill('Woolworths', 350, commitments).kind).toBe('none');
  });

  it('does not settle on a shared common word alone', () => {
    const m = classifyBill('Greenstone Mall Parking', 25, commitments);
    expect(m.kind).toBe('none'); // not a strong payee match, amount nowhere near
  });

  it('settles a payee match even when the amount drifted (a real bill that rose)', () => {
    const m = classifyBill('Virgin Active', 540, commitments); // gym went up
    expect(m.kind).toBe('settle');
    expect(m.kind === 'settle' && m.commitment.id).toBe('gym');
  });
});
