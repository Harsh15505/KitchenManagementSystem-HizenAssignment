import { Injectable } from '@nestjs/common';
import {
  findDerivationCycle,
  type PricedItem,
  type PricedItemKind,
  type PriceTierDto,
  type PriceTierInput,
  type PricingContext,
  pricingContext,
  resolvePrice,
  resolveWithoutOverride,
  type TierGrid,
  type TierGridQuery,
  type TierGridRow,
  type TierPriceChanges,
  type TierRule,
} from '@fernleaf/shared';
import { DomainError } from '../common/domain-error';
import { PrismaService } from '../prisma/prisma.service';

interface CatalogueItem extends PricedItem {
  sku: string | null;
  name: string;
}

/** Everything price resolution needs, loaded in one go (the catalogue is small: tens of rows). */
interface PricingSnapshot {
  tiers: Array<TierRule & { description: string; sortOrder: number; companyCount: number }>;
  defaultTierId: string;
  ctx: PricingContext;
  dishes: CatalogueItem[];
  options: CatalogueItem[];
}

/** FR-PRC-01..06: tiers, their derivation, the default tier, and per-item prices. */
@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<PriceTierDto[]> {
    const snap = await this.snapshot();
    return snap.tiers.map((t) => this.toDto(t, snap));
  }

  async get(id: string): Promise<PriceTierDto> {
    const snap = await this.snapshot();
    const tier = snap.tiers.find((t) => t.id === id);
    if (!tier) throw new DomainError('NOT_FOUND', 'Price tier not found.');
    return this.toDto(tier, snap);
  }

  async create(input: PriceTierInput): Promise<PriceTierDto> {
    await this.assertNameFree(input.name);
    if (input.baseTierId) await this.assertTierExists(input.baseTierId);
    const last = await this.prisma.priceTier.aggregate({ _max: { sortOrder: true } });
    const row = await this.prisma.priceTier.create({
      data: { ...input, sortOrder: (last._max.sortOrder ?? 0) + 1 },
      select: { id: true },
    });
    return this.get(row.id);
  }

  async update(id: string, input: PriceTierInput): Promise<PriceTierDto> {
    const snap = await this.snapshot();
    const existing = snap.tiers.find((t) => t.id === id);
    if (!existing) throw new DomainError('NOT_FOUND', 'Price tier not found.');
    if (input.name.toLowerCase() !== existing.name.toLowerCase())
      await this.assertNameFree(input.name);

    if (input.derivation === 'FROM_TIER' && input.baseTierId) {
      if (!snap.tiers.some((t) => t.id === input.baseTierId))
        throw new DomainError('NOT_FOUND', 'The base tier does not exist.');
      // BR-PRC-05: no tier may (indirectly) derive from itself.
      const loop = findDerivationCycle(
        id,
        input.baseTierId,
        new Map(snap.tiers.map((t) => [t.id, t])),
      );
      if (loop) {
        const name = (tierId: string) => snap.tiers.find((t) => t.id === tierId)?.name ?? tierId;
        throw new DomainError(
          'TIER_CYCLE',
          `That would make tiers derive from each other in a loop: ${loop.map(name).join(' → ')}.`,
          { fieldErrors: { baseTierId: ['Creates a loop'] } },
        );
      }
    }
    await this.prisma.priceTier.update({ where: { id }, data: input });
    return this.get(id);
  }

  /** FR-PRC-02 / BR-PRC-06: the default lives on the settings row, so switching is one update. */
  async makeDefault(id: string): Promise<PriceTierDto> {
    await this.assertTierExists(id);
    await this.prisma.platformSettings.update({
      where: { id: 1 },
      data: { defaultPriceTierId: id },
    });
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    const tier = await this.prisma.priceTier.findUnique({
      where: { id },
      select: {
        name: true,
        _count: { select: { companies: true, orders: true, derivedTiers: true, defaultFor: true } },
      },
    });
    if (!tier) throw new DomainError('NOT_FOUND', 'Price tier not found.');
    const c = tier._count;
    const blockers = [
      c.defaultFor > 0 && 'it is the default tier',
      c.companies > 0 && `${c.companies} compan${c.companies === 1 ? 'y uses' : 'ies use'} it`,
      c.derivedTiers > 0 &&
        `${c.derivedTiers} tier${c.derivedTiers === 1 ? ' derives' : 's derive'} from it`,
      c.orders > 0 && 'past orders were priced on it',
    ].filter(Boolean);
    if (blockers.length > 0)
      throw new DomainError('CONFLICT', `${tier.name} can't be deleted: ${blockers.join(', ')}.`);
    await this.prisma.priceTier.delete({ where: { id } });
  }

  /** FR-PRC-06: every active item with its explicit, derived and effective price on one tier. */
  async grid(id: string, query: TierGridQuery): Promise<TierGrid> {
    const snap = await this.snapshot();
    const tier = snap.tiers.find((t) => t.id === id);
    if (!tier) throw new DomainError('NOT_FOUND', 'Price tier not found.');
    const items = query.kind === 'DISH' ? snap.dishes : snap.options;
    const q = query.q?.toLowerCase();

    const rows: TierGridRow[] = [];
    for (const item of items) {
      if (q && !item.name.toLowerCase().includes(q) && !item.sku?.toLowerCase().includes(q))
        continue;
      const effective = resolvePrice(item, id, snap.ctx);
      if (query.missingOnly === 'true' && effective.source !== 'MISSING') continue;
      const explicit = snap.ctx.explicit(id, item);
      rows.push({
        itemId: item.id,
        sku: item.sku,
        name: item.name,
        costCents: item.costCents,
        baseCents:
          tier.derivation === 'FROM_TIER' && tier.baseTierId
            ? resolvePrice(item, tier.baseTierId, snap.ctx).cents
            : null,
        derivedCents: resolveWithoutOverride(item, id, snap.ctx).cents,
        entry: !explicit
          ? null
          : explicit.cents === null
            ? { kind: 'EXCLUDED' }
            : { kind: 'SET', priceCents: explicit.cents },
        effectiveCents: effective.cents,
        source: effective.source,
      });
    }
    return { tier: this.toDto(tier, snap), rows };
  }

  /** FR-PRC-06 bulk save, all or nothing. `clear` removes the row so derivation applies again. */
  async savePrices(
    id: string,
    input: TierPriceChanges,
    userId: string,
  ): Promise<{ saved: number }> {
    await this.assertTierExists(id);
    const ids = (type: PricedItemKind) =>
      input.changes.filter((c) => c.itemType === type).map((c) => c.itemId);
    const [dishCount, optionCount] = await Promise.all([
      this.prisma.dish.count({ where: { id: { in: ids('DISH') } } }),
      this.prisma.option.count({ where: { id: { in: ids('OPTION') } } }),
    ]);
    if (dishCount !== ids('DISH').length || optionCount !== ids('OPTION').length)
      throw new DomainError('NOT_FOUND', 'Some of the items no longer exist. Reload the grid.');

    await this.prisma.$transaction(
      input.changes.map((c) => {
        const priceCents = c.action === 'exclude' ? null : (c.priceCents ?? null);
        if (c.itemType === 'DISH') {
          const where = { tierId_dishId: { tierId: id, dishId: c.itemId } };
          return c.action === 'clear'
            ? this.prisma.dishTierPrice.deleteMany({ where: { tierId: id, dishId: c.itemId } })
            : this.prisma.dishTierPrice.upsert({
                where,
                create: { tierId: id, dishId: c.itemId, priceCents, updatedById: userId },
                update: { priceCents, updatedById: userId },
              });
        }
        const where = { tierId_optionId: { tierId: id, optionId: c.itemId } };
        return c.action === 'clear'
          ? this.prisma.optionTierPrice.deleteMany({ where: { tierId: id, optionId: c.itemId } })
          : this.prisma.optionTierPrice.upsert({
              where,
              create: { tierId: id, optionId: c.itemId, priceCents, updatedById: userId },
              update: { priceCents, updatedById: userId },
            });
      }),
    );
    return { saved: input.changes.length };
  }

  /**
   * Active dishes employees on the default tier can't see: missing a price or explicitly not sold
   * there (flagged on the menu screen).
   */
  async dishesUnpricedOnDefault(): Promise<Set<string>> {
    const snap = await this.snapshot();
    return new Set(
      snap.dishes
        .filter((d) => resolvePrice(d, snap.defaultTierId, snap.ctx).cents === null)
        .map((d) => d.id),
    );
  }

  private toDto(tier: PricingSnapshot['tiers'][number], snap: PricingSnapshot): PriceTierDto {
    const missing = (items: CatalogueItem[]) =>
      items.filter((item) => resolvePrice(item, tier.id, snap.ctx).source === 'MISSING').length;
    const base = tier.baseTierId ? snap.tiers.find((t) => t.id === tier.baseTierId) : undefined;
    return {
      id: tier.id,
      name: tier.name,
      description: tier.description,
      derivation: tier.derivation,
      factorBps: tier.factorBps,
      baseTier: base ? { id: base.id, name: base.name } : null,
      isDefault: tier.id === snap.defaultTierId,
      companyCount: tier.companyCount,
      missingDishes: missing(snap.dishes),
      missingOptions: missing(snap.options),
    };
  }

  private async snapshot(): Promise<PricingSnapshot> {
    const [tiers, settings, dishPrices, optionPrices, dishes, options] =
      await this.prisma.$transaction([
        this.prisma.priceTier.findMany({
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            description: true,
            derivation: true,
            factorBps: true,
            baseTierId: true,
            sortOrder: true,
            _count: { select: { companies: true } },
          },
        }),
        this.prisma.platformSettings.findUnique({
          where: { id: 1 },
          select: { defaultPriceTierId: true },
        }),
        this.prisma.dishTierPrice.findMany({
          select: { tierId: true, dishId: true, priceCents: true },
        }),
        this.prisma.optionTierPrice.findMany({
          select: { tierId: true, optionId: true, priceCents: true },
        }),
        this.prisma.dish.findMany({
          where: { isActive: true },
          orderBy: { name: 'asc' },
          select: { id: true, sku: true, name: true, costPriceCents: true },
        }),
        this.prisma.option.findMany({
          where: { isActive: true },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, costPriceCents: true },
        }),
      ]);
    if (!settings)
      throw new DomainError('INTERNAL', 'Platform settings are missing. Run the seed.');

    const rules = tiers.map(({ _count, ...t }) => ({ ...t, companyCount: _count.companies }));
    return {
      tiers: rules,
      defaultTierId: settings.defaultPriceTierId,
      ctx: pricingContext(rules, [
        ...dishPrices.map((r) => ({
          tierId: r.tierId,
          kind: 'DISH' as const,
          itemId: r.dishId,
          priceCents: r.priceCents,
        })),
        ...optionPrices.map((r) => ({
          tierId: r.tierId,
          kind: 'OPTION' as const,
          itemId: r.optionId,
          priceCents: r.priceCents,
        })),
      ]),
      dishes: dishes.map((d) => ({
        kind: 'DISH',
        id: d.id,
        sku: d.sku,
        name: d.name,
        costCents: d.costPriceCents,
      })),
      options: options.map((o) => ({
        kind: 'OPTION',
        id: o.id,
        sku: null,
        name: o.name,
        costCents: o.costPriceCents,
      })),
    };
  }

  private async assertTierExists(id: string): Promise<void> {
    if (!(await this.prisma.priceTier.findUnique({ where: { id }, select: { id: true } })))
      throw new DomainError('NOT_FOUND', 'Price tier not found.');
  }

  private async assertNameFree(name: string): Promise<void> {
    const clash = await this.prisma.priceTier.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (clash)
      throw new DomainError('UNIQUE_VIOLATION', `A tier called ${name} already exists.`, {
        fieldErrors: { name: ['Already used'] },
      });
  }
}
