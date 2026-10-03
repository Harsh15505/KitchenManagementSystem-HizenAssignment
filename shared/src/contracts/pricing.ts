import { z } from 'zod';
import type { PriceDerivation, PriceSource } from '../domain/pricing';

/** FR-PRC-01/05: a named tier and how it gets prices. Factor is in basis points (10000 = ×1.0). */
export const priceTierInputSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter a name').max(40),
    description: z.string().trim().max(200),
    derivation: z.enum(['MANUAL', 'FROM_COST', 'FROM_TIER']),
    factorBps: z.number().int().min(1, 'Must be above zero').max(100_000).nullable(),
    baseTierId: z.uuid().nullable(),
  })
  .superRefine((t, ctx) => {
    if (t.derivation === 'MANUAL') {
      if (t.factorBps !== null || t.baseTierId !== null)
        ctx.addIssue({
          code: 'custom',
          path: ['derivation'],
          message: 'A manual tier has no factor or base tier',
        });
      return;
    }
    if (t.factorBps === null)
      ctx.addIssue({ code: 'custom', path: ['factorBps'], message: 'Enter the factor' });
    if (t.derivation === 'FROM_TIER' && t.baseTierId === null)
      ctx.addIssue({
        code: 'custom',
        path: ['baseTierId'],
        message: 'Choose the tier it derives from',
      });
    if (t.derivation === 'FROM_COST' && t.baseTierId !== null)
      ctx.addIssue({
        code: 'custom',
        path: ['baseTierId'],
        message: 'A cost-based tier has no base tier',
      });
  });
export type PriceTierInput = z.infer<typeof priceTierInputSchema>;

export interface PriceTierDto {
  id: string;
  name: string;
  description: string;
  derivation: PriceDerivation;
  factorBps: number | null;
  baseTier: { id: string; name: string } | null;
  isDefault: boolean;
  companyCount: number;
  /** Active dishes / options with no effective price on this tier (FR-PRC-06). */
  missingDishes: number;
  missingOptions: number;
}

export const tierGridQuerySchema = z.object({
  kind: z.enum(['DISH', 'OPTION']).default('DISH'),
  missingOnly: z.enum(['true', 'false']).optional(),
  q: z.string().trim().max(100).optional(),
});
export type TierGridQuery = z.infer<typeof tierGridQuerySchema>;

/** What this tier's own row says: a price, an explicit "not sold", or nothing. */
export type TierEntry = { kind: 'SET'; priceCents: number } | { kind: 'EXCLUDED' } | null;

export interface TierGridRow {
  itemId: string;
  sku: string | null;
  name: string;
  costCents: number;
  /** FROM_TIER only: the item's effective price on the base tier. */
  baseCents: number | null;
  /** What derivation alone gives (null on manual tiers or when the base has no price). */
  derivedCents: number | null;
  entry: TierEntry;
  effectiveCents: number | null;
  source: PriceSource;
}

export interface TierGrid {
  tier: PriceTierDto;
  rows: TierGridRow[];
}

/** FR-PRC-06 bulk save: one entry per edited cell. */
export const tierPriceChangesSchema = z.object({
  changes: z
    .array(
      z
        .object({
          itemType: z.enum(['DISH', 'OPTION']),
          itemId: z.uuid(),
          action: z.enum(['set', 'exclude', 'clear']),
          priceCents: z.number().int('Use whole cents').min(0).max(10_000_000).optional(),
        })
        .superRefine((c, ctx) => {
          if (c.action !== 'set') return;
          if (c.priceCents === undefined)
            ctx.addIssue({ code: 'custom', path: ['priceCents'], message: 'Enter a price' });
          // BR-PRC-04: a dish needs a price above zero; an option may be free.
          else if (c.itemType === 'DISH' && c.priceCents === 0)
            ctx.addIssue({
              code: 'custom',
              path: ['priceCents'],
              message: 'A dish price must be above $0.00',
            });
        }),
    )
    .min(1)
    .max(500)
    .refine(
      (rows) => new Set(rows.map((r) => `${r.itemType}|${r.itemId}`)).size === rows.length,
      'Each item once',
    ),
});
export type TierPriceChanges = z.infer<typeof tierPriceChangesSchema>;
