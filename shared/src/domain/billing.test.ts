import { describe, expect, it } from 'vitest';
import { cancellationCredit, invoiceTotal, isBillable, shortageCredit } from './billing';

describe('BR-BIL: billing rules', () => {
  it('BR-BIL-01: only confirmed and delivered orders are billable', () => {
    expect(
      ['DRAFT', 'PLACED', 'CONFIRMED', 'DELIVERED', 'CANCELLED', 'REJECTED'].filter(isBillable),
    ).toEqual(['CONFIRMED', 'DELIVERED']);
  });

  it('BR-BIL-02 / BR-MNY-03: invoice total is the sum of its lines, credits included', () => {
    expect(invoiceTotal([{ amountCents: 5220 }, { amountCents: 640 }, { amountCents: -520 }])).toBe(
      5340,
    );
  });

  it('BR-BIL-06: cancelling an invoiced order credits its full total', () => {
    expect(cancellationCredit(5220)).toBe(-5220);
  });

  const combos = [
    { combinationId: 'a', quantity: 6, unitPriceCents: 520, alreadyShort: 0 },
    { combinationId: 'b', quantity: 4, unitPriceCents: 525, alreadyShort: 1 },
  ];

  it('BR-BIL-07: credit = −Σ(short qty × unit price)', () => {
    expect(
      shortageCredit(
        [
          { combinationId: 'a', shortQty: 2 },
          { combinationId: 'b', shortQty: 1 },
        ],
        combos,
        5220,
        0,
      ),
    ).toEqual({
      ok: true,
      creditCents: -(2 * 520 + 525),
    });
  });

  it('BR-BIL-07: a combination can’t be short more than ordered minus earlier shortages', () => {
    expect(shortageCredit([{ combinationId: 'b', shortQty: 4 }], combos, 5220, -525)).toEqual({
      ok: false,
      problem: { code: 'TOO_MANY', combinationId: 'b', remaining: 3 },
    });
  });

  it('BR-BIL-07: credits on an order can never exceed its total', () => {
    expect(shortageCredit([{ combinationId: 'a', shortQty: 6 }], combos, 3000, -100)).toEqual({
      ok: false,
      problem: { code: 'OVER_TOTAL' },
    });
  });

  it('BR-BIL-07: nothing short is refused', () => {
    expect(shortageCredit([{ combinationId: 'a', shortQty: 0 }], combos, 5220, 0)).toEqual({
      ok: false,
      problem: { code: 'EMPTY' },
    });
  });
});
