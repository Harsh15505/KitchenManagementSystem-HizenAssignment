import { describe, expect, it } from 'vitest';
import {
  bpsToMultiplier,
  bpsToPercent,
  effectiveTierId,
  findDerivationCycle,
  multiplierToBps,
  percentToBps,
  type PricedItem,
  pricingContext,
  resolvePrice,
  resolveWithoutOverride,
  TierCycleError,
  type TierRule,
} from './pricing';

const standard: TierRule = {
  id: 'std',
  name: 'Standard',
  derivation: 'FROM_COST',
  factorBps: 24_000,
  baseTierId: null,
};
const enterprise: TierRule = {
  id: 'ent',
  name: 'Enterprise',
  derivation: 'FROM_TIER',
  factorBps: 9_000,
  baseTierId: 'std',
};
const partner: TierRule = {
  id: 'ptn',
  name: 'Partner',
  derivation: 'FROM_TIER',
  factorBps: 11_500,
  baseTierId: 'std',
};
const startup: TierRule = {
  id: 'stp',
  name: 'Startup',
  derivation: 'MANUAL',
  factorBps: null,
  baseTierId: null,
};
const TIERS = [standard, enterprise, partner, startup];

const bowl: PricedItem = { kind: 'DISH', id: 'bowl', costCents: 88 };
const rice: PricedItem = { kind: 'OPTION', id: 'rice', costCents: 0 };

const ctx = (rows: Parameters<typeof pricingContext>[1] = []) => pricingContext(TIERS, rows);

describe('BR-PRC-02/03: derived tiers', () => {
  it('cost × 2.4 rounds up to 5¢: 88¢ → 211.2¢ → $2.15 (the brief example)', () => {
    expect(resolvePrice(bowl, 'std', ctx())).toEqual({ cents: 215, source: 'DERIVED' });
  });

  it('derives from another tier: Partner = Standard + 15% → 215 × 1.15 = 247.25 → 250¢', () => {
    expect(resolvePrice(bowl, 'ptn', ctx())).toEqual({ cents: 250, source: 'DERIVED' });
  });

  it('chains through the base tier override: Enterprise = Standard − 10% of an overridden 1200¢', () => {
    const c = ctx([{ tierId: 'std', kind: 'DISH', itemId: 'bowl', priceCents: 1200 }]);
    expect(resolvePrice(bowl, 'ent', c)).toEqual({ cents: 1080, source: 'DERIVED' });
  });
});

describe('BR-PRC-02: overrides and exclusions', () => {
  it('an explicit override beats derivation, used exactly as typed (no rounding)', () => {
    const c = ctx([{ tierId: 'ptn', kind: 'DISH', itemId: 'bowl', priceCents: 1199 }]);
    expect(resolvePrice(bowl, 'ptn', c)).toEqual({ cents: 1199, source: 'EXPLICIT' });
  });

  it('an explicit exclusion means "not sold on this tier"', () => {
    const c = ctx([{ tierId: 'ent', kind: 'DISH', itemId: 'bowl', priceCents: null }]);
    expect(resolvePrice(bowl, 'ent', c)).toEqual({ cents: null, source: 'EXCLUDED' });
  });

  it('an exclusion on the base tier removes the derived price too', () => {
    const c = ctx([{ tierId: 'std', kind: 'DISH', itemId: 'bowl', priceCents: null }]);
    expect(resolvePrice(bowl, 'ptn', c)).toEqual({
      cents: null,
      source: 'MISSING',
      reason: 'NO_BASE_PRICE',
    });
  });
});

describe('BR-PRC-04: no price means hidden, never $0', () => {
  it('a manual tier without a row has no price', () => {
    expect(resolvePrice(bowl, 'stp', ctx())).toEqual({
      cents: null,
      source: 'MISSING',
      reason: 'NOT_SET',
    });
  });

  it('a manual tier uses its explicit price', () => {
    const c = ctx([{ tierId: 'stp', kind: 'DISH', itemId: 'bowl', priceCents: 990 }]);
    expect(resolvePrice(bowl, 'stp', c).cents).toBe(990);
  });

  it('a dish deriving to 0 (cost not entered) counts as missing', () => {
    const free: PricedItem = { kind: 'DISH', id: 'x', costCents: 0 };
    expect(resolvePrice(free, 'std', ctx())).toMatchObject({ cents: null, reason: 'NOT_POSITIVE' });
  });

  it('an option may legitimately cost 0 (e.g. plain rice)', () => {
    expect(resolvePrice(rice, 'std', ctx())).toEqual({ cents: 0, source: 'DERIVED' });
  });

  it('an unknown tier resolves to missing instead of throwing', () => {
    expect(resolvePrice(bowl, 'nope', ctx())).toMatchObject({
      cents: null,
      reason: 'UNKNOWN_TIER',
    });
  });
});

describe('BR-PRC-01: which tier an employee pays', () => {
  it('uses the company tier when set, otherwise the default', () => {
    expect(effectiveTierId({ priceTierId: 'ent' }, 'std')).toBe('ent');
    expect(effectiveTierId({ priceTierId: null }, 'std')).toBe('std');
  });

  it('never falls back to the default tier per item: missing on the company tier stays missing', () => {
    const c = ctx([{ tierId: 'std', kind: 'DISH', itemId: 'bowl', priceCents: 999 }]);
    expect(resolvePrice(bowl, effectiveTierId({ priceTierId: 'stp' }, 'std'), c).cents).toBeNull();
  });
});

describe('BR-PRC-05: derivation loops are rejected', () => {
  it('detects a loop before it is saved', () => {
    const map = new Map(TIERS.map((t) => [t.id, t]));
    expect(findDerivationCycle('std', 'ent', map)).toEqual(['std', 'ent', 'std']);
    expect(findDerivationCycle('ptn', 'std', map)).toBeNull();
    expect(findDerivationCycle('ent', 'ent', map)).toEqual(['ent', 'ent']);
  });

  it('throws on a loop that somehow reached the data', () => {
    const loopA: TierRule = {
      id: 'a',
      name: 'A',
      derivation: 'FROM_TIER',
      factorBps: 10_000,
      baseTierId: 'b',
    };
    const loopB: TierRule = {
      id: 'b',
      name: 'B',
      derivation: 'FROM_TIER',
      factorBps: 10_000,
      baseTierId: 'a',
    };
    expect(() => resolvePrice(bowl, 'a', pricingContext([loopA, loopB], []))).toThrow(
      TierCycleError,
    );
  });
});

describe('FR-PRC-05: tier factors typed by staff', () => {
  it('parses multipliers to basis points without floats', () => {
    expect(multiplierToBps('2.4')).toBe(24_000);
    expect(multiplierToBps('1.0725')).toBe(10_725);
    expect(multiplierToBps('3')).toBe(30_000);
    expect(multiplierToBps('0')).toBeNull();
    expect(multiplierToBps('2.40001')).toBeNull();
    expect(multiplierToBps('abc')).toBeNull();
  });

  it('parses percent changes to basis points', () => {
    expect(percentToBps('-10')).toBe(9_000);
    expect(percentToBps('+15')).toBe(11_500);
    expect(percentToBps('7.5')).toBe(10_750);
    expect(percentToBps('-100')).toBeNull();
    expect(percentToBps('5%')).toBeNull();
  });

  it('formats basis points back for editing', () => {
    expect(bpsToMultiplier(24_000)).toBe('2.4');
    expect(bpsToMultiplier(10_725)).toBe('1.0725');
    expect(bpsToMultiplier(30_000)).toBe('3');
    expect(bpsToPercent(9_000)).toBe('-10');
    expect(bpsToPercent(11_500)).toBe('+15');
    expect(bpsToPercent(10_750)).toBe('+7.5');
    expect(bpsToPercent(10_000)).toBe('0');
  });
});

describe('FR-PRC-06: the grid shows what an override replaces', () => {
  it('ignores the tier own row but keeps base-tier overrides', () => {
    const rows = [
      { tierId: 'std', kind: 'DISH' as const, itemId: 'bowl', priceCents: 1200 },
      { tierId: 'ent', kind: 'DISH' as const, itemId: 'bowl', priceCents: 999 },
    ];
    expect(resolvePrice(bowl, 'ent', ctx(rows))).toEqual({ cents: 999, source: 'EXPLICIT' });
    expect(resolveWithoutOverride(bowl, 'ent', ctx(rows))).toEqual({
      cents: 1080,
      source: 'DERIVED',
    });
  });

  it('a manual tier has nothing underneath an override', () => {
    const rows = [{ tierId: 'stp', kind: 'DISH' as const, itemId: 'bowl', priceCents: 500 }];
    expect(resolveWithoutOverride(bowl, 'stp', ctx(rows)).source).toBe('MISSING');
  });
});
