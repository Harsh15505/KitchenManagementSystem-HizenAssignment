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

/**
 * Parses what staff type ("12", "12.5", "$1,250.75") into integer cents with string arithmetic,
 * never parseFloat × 100 (0.29 × 100 = 28.999…). Returns null for anything that is not money.
 */
export function parseUsd(input: string): Cents | null {
  const cleaned = input.trim().replace(/^\$/, '').replace(/,/g, '');
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const dollars = Number(match[1]);
  const cents = Number((match[2] ?? '0').padEnd(2, '0'));
  return dollars * 100 + cents;
}

/** Cents to an editable "12.50" string (no currency symbol). */
export function centsToInput(cents: Cents): string {
  assertCents(cents);
  return `${Math.trunc(cents / 100)}.${String(Math.abs(cents % 100)).padStart(2, '0')}`;
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Display only. Never parse the output back into money. */
export function formatUsd(cents: Cents): string {
  assertCents(cents);
  return usd.format(cents / 100);
}
