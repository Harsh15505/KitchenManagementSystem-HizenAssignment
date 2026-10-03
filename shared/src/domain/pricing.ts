import { type BasisPoints, type Cents, deriveCents } from './money';

/**
 * Price resolution (BR-PRC-01..05, TRD §8.2). Pure: callers load tiers and explicit prices and
 * pass them in, so the same rules serve the menu, the order quote and the tier grid.
 */

export type PriceDerivation = 'MANUAL' | 'FROM_COST' | 'FROM_TIER';

export interface TierRule {
  id: string;
  name: string;
  derivation: PriceDerivation;
  /** 10000 = ×1.0. Required unless MANUAL. */
  factorBps: BasisPoints | null;
  /** Required for FROM_TIER. */
  baseTierId: string | null;
}

export type PricedItemKind = 'DISH' | 'OPTION';

export interface PricedItem {
  kind: PricedItemKind;
  id: string;
  costCents: Cents;
}

/** An explicit row on a tier: a price, or `null` meaning "explicitly not sold on this tier". */
export interface ExplicitPrice {
  cents: Cents | null;
}

export interface PricingContext {
  tiers: ReadonlyMap<string, TierRule>;
  explicit(tierId: string, item: PricedItem): ExplicitPrice | undefined;
}

export type PriceSource = 'EXPLICIT' | 'DERIVED' | 'EXCLUDED' | 'MISSING';
export type MissingReason = 'NOT_SET' | 'NO_BASE_PRICE' | 'NOT_POSITIVE' | 'UNKNOWN_TIER';

export interface ResolvedPrice {
  cents: Cents | null;
  source: PriceSource;
  reason?: MissingReason;
}

export class TierCycleError extends Error {
  constructor(readonly chain: string[]) {
    super(`Price tiers derive from each other in a loop: ${chain.join(' → ')}`);
    this.name = 'TierCycleError';
  }
}

/** BR-PRC-04: a dish needs a price > 0 to count; an option may legitimately cost 0. */
function acceptable(item: PricedItem, cents: Cents): boolean {
  return item.kind === 'DISH' ? cents > 0 : cents >= 0;
}

export function resolvePrice(item: PricedItem, tierId: string, ctx: PricingContext): ResolvedPrice {
  return resolveInner(item, tierId, ctx, []);
}

function resolveInner(
  item: PricedItem,
  tierId: string,
  ctx: PricingContext,
  chain: string[],
): ResolvedPrice {
  if (chain.includes(tierId)) throw new TierCycleError([...chain, tierId]);
  const tier = ctx.tiers.get(tierId);
  if (!tier) return { cents: null, source: 'MISSING', reason: 'UNKNOWN_TIER' };

  // 1. An explicit row always wins: a full price on MANUAL tiers, an override on derived tiers.
  const explicit = ctx.explicit(tierId, item);
  if (explicit) {
    if (explicit.cents === null) return { cents: null, source: 'EXCLUDED' };
    return acceptable(item, explicit.cents)
      ? { cents: explicit.cents, source: 'EXPLICIT' }
      : { cents: null, source: 'MISSING', reason: 'NOT_POSITIVE' };
  }

  // 2. No row on a manual tier means no price (the dish is hidden, never shown at $0).
  if (tier.derivation === 'MANUAL') return { cents: null, source: 'MISSING', reason: 'NOT_SET' };

  // 3. Derived tiers: base × factor, rounded up to the next 5 cents (BR-PRC-03).
  let base: Cents | null;
  if (tier.derivation === 'FROM_COST') {
    base = item.costCents;
  } else {
    if (!tier.baseTierId) return { cents: null, source: 'MISSING', reason: 'NO_BASE_PRICE' };
    base = resolveInner(item, tier.baseTierId, ctx, [...chain, tierId]).cents;
  }
  if (base === null) return { cents: null, source: 'MISSING', reason: 'NO_BASE_PRICE' };

  const cents = deriveCents(base, tier.factorBps ?? 10_000);
  return acceptable(item, cents)
    ? { cents, source: 'DERIVED' }
    : { cents: null, source: 'MISSING', reason: 'NOT_POSITIVE' };
}

/** BR-PRC-01: the employee's tier is the company's tier, else the platform default. */
export function effectiveTierId(
  company: { priceTierId: string | null },
  defaultTierId: string,
): string {
  return company.priceTierId ?? defaultTierId;
}

/**
 * BR-PRC-05: validate a tier's derivation before saving it. Returns the loop if pointing `tierId`
 * at `baseTierId` would create one, otherwise null.
 */
export function findDerivationCycle(
  tierId: string,
  baseTierId: string | null,
  tiers: ReadonlyMap<string, TierRule>,
): string[] | null {
  const chain = [tierId];
  let current = baseTierId;
  while (current) {
    if (chain.includes(current)) return [...chain, current];
    chain.push(current);
    const next = tiers.get(current);
    current = next?.derivation === 'FROM_TIER' ? next.baseTierId : null;
  }
  return null;
}

/** Build a PricingContext from rows as loaded from the database. */
export function pricingContext(
  tiers: readonly TierRule[],
  explicitRows: ReadonlyArray<{
    tierId: string;
    kind: PricedItemKind;
    itemId: string;
    priceCents: Cents | null;
  }>,
): PricingContext {
  const tierMap = new Map(tiers.map((t) => [t.id, t]));
  const rows = new Map(
    explicitRows.map((r) => [`${r.tierId}|${r.kind}|${r.itemId}`, { cents: r.priceCents }]),
  );
  return {
    tiers: tierMap,
    explicit: (tierId, item) => rows.get(`${tierId}|${item.kind}|${item.id}`),
  };
}

/**
 * Tier factors are stored in basis points (ADR-005) and typed by staff as a multiplier ("2.4",
 * FROM_COST) or a percent change ("-10", FROM_TIER). Parsed from the string, never via floats.
 */
const MULTIPLIER = /^(\d{1,2})(?:\.(\d{1,4}))?$/;
const PERCENT = /^([+-]?)(\d{1,3})(?:\.(\d{1,2}))?$/;

export function multiplierToBps(text: string): BasisPoints | null {
  const m = MULTIPLIER.exec(text.trim());
  if (!m) return null;
  const bps = Number(m[1]) * 10_000 + Number((m[2] ?? '').padEnd(4, '0'));
  return bps > 0 ? bps : null;
}

export function percentToBps(text: string): BasisPoints | null {
  const m = PERCENT.exec(text.trim());
  if (!m) return null;
  const delta = Number(m[2]) * 100 + Number((m[3] ?? '').padEnd(2, '0'));
  const bps = 10_000 + (m[1] === '-' ? -delta : delta);
  return bps > 0 ? bps : null;
}

/** 24000 → "2.4" */
export function bpsToMultiplier(bps: BasisPoints): string {
  const whole = Math.trunc(bps / 10_000);
  const frac = String(bps % 10_000)
    .padStart(4, '0')
    .replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : String(whole);
}

/** 9000 → "-10", 11500 → "+15", 10000 → "0" */
export function bpsToPercent(bps: BasisPoints): string {
  const delta = bps - 10_000;
  const abs = Math.abs(delta);
  const whole = Math.trunc(abs / 100);
  const frac = String(abs % 100)
    .padStart(2, '0')
    .replace(/0+$/, '');
  const body = frac ? `${whole}.${frac}` : String(whole);
  return delta > 0 ? `+${body}` : delta < 0 ? `-${body}` : '0';
}

/**
 * What a tier would charge for an item if it had no explicit row of its own: the grid shows this
 * next to the override so staff can see what they are replacing (FR-PRC-06).
 */
export function resolveWithoutOverride(
  item: PricedItem,
  tierId: string,
  ctx: PricingContext,
): ResolvedPrice {
  return resolvePrice(item, tierId, {
    tiers: ctx.tiers,
    explicit: (t, i) => (t === tierId ? undefined : ctx.explicit(t, i)),
  });
}
