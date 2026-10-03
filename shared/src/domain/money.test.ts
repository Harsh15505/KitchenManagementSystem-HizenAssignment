import { describe, expect, it } from 'vitest';
import { centsToInput, deriveCents, divCeil, formatUsd, parseUsd, sumCents } from './money';

describe('divCeil', () => {
  it('divides exactly and rounds remainders up', () => {
    expect(divCeil(10, 5)).toBe(2);
    expect(divCeil(11, 5)).toBe(3);
    expect(divCeil(0, 7)).toBe(0);
  });

  it('rejects negative or non-integer input', () => {
    expect(() => divCeil(-1, 5)).toThrow(RangeError);
    expect(() => divCeil(1.5, 5)).toThrow(RangeError);
    expect(() => divCeil(1, 0)).toThrow(RangeError);
  });
});

describe('BR-PRC-03: derived prices round up to the next 5 cents', () => {
  it('$2.11 becomes $2.15 (the brief example: 88¢ × 2.4 = 211.2¢)', () => {
    expect(deriveCents(88, 24_000)).toBe(215);
  });

  it('keeps a value that is already a multiple of 5 cents', () => {
    expect(deriveCents(215, 10_000)).toBe(215);
  });

  it('rounds a fractional cent up across a 5-cent boundary (295.2¢ → 300¢)', () => {
    expect(deriveCents(123, 24_000)).toBe(300);
  });

  it('applies percentage tiers: Standard + 15 % of $19.99 → $23.00', () => {
    expect(deriveCents(1999, 11_500)).toBe(2300);
  });

  it('applies discounts: Standard − 10 % of $10.03 → $9.05', () => {
    expect(deriveCents(1003, 9_000)).toBe(905);
  });

  it('has no floating point drift where 0.1 + 0.2 would fail', () => {
    expect(deriveCents(10, 10_000) + deriveCents(20, 10_000)).toBe(30);
  });
});

describe('BR-MNY-01: money is integer cents', () => {
  it('sums integer cents', () => {
    expect(sumCents([1050, 250, 0])).toBe(1300);
  });

  it('refuses fractional cents', () => {
    expect(() => sumCents([10.5])).toThrow(RangeError);
  });

  it('formats for display only', () => {
    expect(formatUsd(123456)).toBe('$1,234.56');
  });
});

describe('parseUsd: typed dollars to integer cents without floats', () => {
  it('parses whole and fractional dollars exactly', () => {
    expect(parseUsd('12')).toBe(1200);
    expect(parseUsd('12.5')).toBe(1250);
    expect(parseUsd('0.29')).toBe(29); // parseFloat('0.29') * 100 = 28.999…
    expect(parseUsd('$1,250.75')).toBe(125075);
  });

  it('rejects non-money input', () => {
    for (const bad of ['', 'abc', '1.234', '-5', '1e3']) expect(parseUsd(bad), bad).toBeNull();
  });

  it('round-trips through the edit format', () => {
    expect(centsToInput(1250)).toBe('12.50');
    expect(centsToInput(5)).toBe('0.05');
    expect(parseUsd(centsToInput(98765))).toBe(98765);
  });
});
