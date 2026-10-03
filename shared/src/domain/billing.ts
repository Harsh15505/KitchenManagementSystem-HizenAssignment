import type { Cents } from './money';

/**
 * Billing rules (BR-BIL-01..09, TRD §8.9). Pure: callers pass the rows they loaded.
 */

export const BILLABLE_STATUSES = ['CONFIRMED', 'DELIVERED'] as const;

/** BR-BIL-01: confirmed and delivered orders are owed in full. */
export function isBillable(status: string): boolean {
  return (BILLABLE_STATUSES as readonly string[]).includes(status);
}

/** BR-MNY-03: invoice total = Σ line amounts. */
export function invoiceTotal(lines: ReadonlyArray<{ amountCents: Cents }>): Cents {
  return lines.reduce((sum, l) => sum + l.amountCents, 0);
}

/** BR-BIL-06: cancelling or rejecting an invoiced order credits its full total. */
export function cancellationCredit(orderTotalCents: Cents): Cents {
  return -orderTotalCents;
}

export interface ShortageCombination {
  combinationId: string;
  quantity: number;
  unitPriceCents: Cents;
  /** Already recorded short on earlier shortage adjustments. */
  alreadyShort: number;
}

export type ShortageProblem =
  | { code: 'EMPTY' }
  | { code: 'UNKNOWN_COMBINATION'; combinationId: string }
  | { code: 'TOO_MANY'; combinationId: string; remaining: number }
  | { code: 'OVER_TOTAL' };

/**
 * BR-BIL-07: credit = −Σ(short qty × unit price); per combination the short quantity can't
 * exceed what was ordered (minus earlier shortages), and all credits on an order together can
 * never exceed the order total.
 */
export function shortageCredit(
  items: ReadonlyArray<{ combinationId: string; shortQty: number }>,
  combinations: readonly ShortageCombination[],
  orderTotalCents: Cents,
  existingCreditsCents: Cents,
): { ok: true; creditCents: Cents } | { ok: false; problem: ShortageProblem } {
  const wanted = items.filter((i) => i.shortQty > 0);
  if (wanted.length === 0) return { ok: false, problem: { code: 'EMPTY' } };
  let credit = 0;
  for (const item of wanted) {
    const c = combinations.find((x) => x.combinationId === item.combinationId);
    if (!c)
      return {
        ok: false,
        problem: { code: 'UNKNOWN_COMBINATION', combinationId: item.combinationId },
      };
    const remaining = c.quantity - c.alreadyShort;
    if (!Number.isInteger(item.shortQty) || item.shortQty > remaining)
      return {
        ok: false,
        problem: { code: 'TOO_MANY', combinationId: item.combinationId, remaining },
      };
    credit -= item.shortQty * c.unitPriceCents;
  }
  // existingCreditsCents is ≤ 0; together with the new credit it may not go below −total.
  if (existingCreditsCents + credit < -orderTotalCents)
    return { ok: false, problem: { code: 'OVER_TOTAL' } };
  return { ok: true, creditCents: credit };
}
