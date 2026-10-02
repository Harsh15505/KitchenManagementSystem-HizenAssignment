/**
 * Money helpers. Every amount in the system is an integer number of US cents
 * (BR-MNY-01). No floating point is used for money arithmetic.
 */

export type Cents = number;

/** 10000 basis points = ×1.0. "cost × 2.4" = 24000, "+15 %" = 11500, "−10 %" = 9000. */
export type BasisPoints = number;

export function assertCents(value: number, label = 'amount'): asserts value is Cents {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be an integer number of cents, got ${value}`);
  }
}

/** Exact ceiling division for non-negative safe integers (no floating point). */
export function divCeil(a: number, b: number): number {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || a < 0 || b <= 0) {
    throw new RangeError(`divCeil expects a >= 0 and b > 0 as safe integers, got ${a}, ${b}`);
  }
  const remainder = a % b;
  return (a - remainder) / b + (remainder > 0 ? 1 : 0);
}

/**
 * Applies a basis-point factor and rounds UP to the next multiple of 5 cents (BR-PRC-03).
 * base × bps / 10000, rounded up to 5¢  ==  ceil(base × bps / 50000) × 5
 */
export function deriveCents(baseCents: Cents, factorBps: BasisPoints): Cents {
  assertCents(baseCents, 'baseCents');
  assertCents(factorBps, 'factorBps');
  return divCeil(baseCents * factorBps, 50_000) * 5;
}

export function sumCents(values: readonly Cents[]): Cents {
  return values.reduce((total, value) => {
    assertCents(value);
    return total + value;
  }, 0);
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Display only. Never parse the output back into money. */
export function formatUsd(cents: Cents): string {
  assertCents(cents);
  return usd.format(cents / 100);
}
