import { Injectable } from '@nestjs/common';
import {
  type CatalogueListQuery,
  type OptionDto,
  type OptionInput,
  type Paginated,
  paginated,
  portionViolations,
  type UpdateOptionInput,
} from '@fernleaf/shared';
import { DomainError } from '../common/domain-error';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const optionSelect = {
  id: true,
  name: true,
  description: true,
  costPriceCents: true,
  isActive: true,
  allergens: { select: { allergenId: true } },
  dietaryTags: { select: { dietaryTagId: true } },
  portionPrices: { select: { portionSizeId: true, extraChargeCents: true } },
  _count: { select: { groupItems: true } },
} satisfies Prisma.OptionSelect;

type OptionRow = Prisma.OptionGetPayload<{ select: typeof optionSelect }>;

const toDto = (row: OptionRow): OptionDto => ({
  id: row.id,
  name: row.name,
  description: row.description,
  costPriceCents: row.costPriceCents,
  isActive: row.isActive,
  allergenIds: row.allergens.map((a) => a.allergenId),
  dietaryTagIds: row.dietaryTags.map((t) => t.dietaryTagId),
  portionExtras: row.portionPrices,
  usedInGroups: row._count.groupItems,
});

/** FR-CAT-03: reusable options with their own cost, allergens, tags and (FR-CAT-05) sizes. */
@Injectable()
export class OptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: CatalogueListQuery): Promise<Paginated<OptionDto>> {
    const where: Prisma.OptionWhereInput = {
      ...(query.active ? { isActive: query.active === 'true' } : {}),
      ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.option.findMany({
        where,
        select: optionSelect,
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.option.count({ where }),
    ]);
    return paginated(rows.map(toDto), total, query);
  }

  async get(id: string): Promise<OptionDto> {
    const row = await this.prisma.option.findUnique({ where: { id }, select: optionSelect });
    if (!row) throw new DomainError('NOT_FOUND', 'Option not found.');
    return toDto(row);
  }

  async create(input: OptionInput): Promise<OptionDto> {
    await this.assertNameFree(input.name);
    const { allergenIds, dietaryTagIds, portionExtras, ...fields } = input;
    const row = await this.prisma.option.create({
      data: {
        ...fields,
        allergens: { create: allergenIds.map((allergenId) => ({ allergenId })) },
        dietaryTags: { create: dietaryTagIds.map((dietaryTagId) => ({ dietaryTagId })) },
        portionPrices: { create: portionExtras },
      },
      select: optionSelect,
    });
    return toDto(row);
  }

  async update(id: string, input: UpdateOptionInput): Promise<OptionDto> {
    const existing = await this.prisma.option.findUnique({ where: { id }, select: { name: true } });
    if (!existing) throw new DomainError('NOT_FOUND', 'Option not found.');
    if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) {
      await this.assertNameFree(input.name);
    }
    const { allergenIds, dietaryTagIds, portionExtras, ...fields } = input;
    if (portionExtras)
      await this.assertSizesStillCovered(id, input.name ?? existing.name, portionExtras);

    await this.prisma.$transaction(async (tx) => {
      await tx.option.update({ where: { id }, data: fields });
      if (allergenIds) {
        await tx.optionAllergen.deleteMany({ where: { optionId: id } });
        await tx.optionAllergen.createMany({
          data: allergenIds.map((allergenId) => ({ optionId: id, allergenId })),
        });
      }
      if (dietaryTagIds) {
        await tx.optionDietaryTag.deleteMany({ where: { optionId: id } });
        await tx.optionDietaryTag.createMany({
          data: dietaryTagIds.map((dietaryTagId) => ({ optionId: id, dietaryTagId })),
        });
      }
      if (portionExtras) {
        await tx.optionPortionPrice.deleteMany({ where: { optionId: id } });
        await tx.optionPortionPrice.createMany({
          data: portionExtras.map((p) => ({ ...p, optionId: id })),
        });
      }
    });
    return this.get(id);
  }

  /** FR-CAT-05: an option can't drop a size that a portioned group it belongs to still sells. */
  private async assertSizesStillCovered(
    optionId: string,
    optionName: string,
    extras: ReadonlyArray<{ portionSizeId: string }>,
  ): Promise<void> {
    const groups = await this.prisma.optionGroup.findMany({
      where: { usesPortions: true, items: { some: { optionId } } },
      select: {
        name: true,
        dish: { select: { name: true } },
        portionSizes: { select: { portionSizeId: true } },
      },
    });
    const supported = new Set(extras.map((e) => e.portionSizeId));
    for (const group of groups) {
      const violation = portionViolations(
        group.portionSizes.map((p) => p.portionSizeId),
        [{ id: optionId, name: optionName, supportedSizeIds: supported }],
      )[0];
      if (violation) {
        throw new DomainError(
          'PORTION_SIZE_UNSUPPORTED',
          `"${group.name}" on ${group.dish.name} sells this option in sizes it would no longer support.`,
          {
            fieldErrors: { portionExtras: ['Keep every size used by its portioned groups'] },
            details: { ...violation },
          },
        );
      }
    }
  }

  private async assertNameFree(name: string): Promise<void> {
    const clash = await this.prisma.option.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { name: true },
    });
    if (clash) {
      throw new DomainError('UNIQUE_VIOLATION', `An option named "${clash.name}" already exists.`, {
        fieldErrors: { name: ['Already used by another option'] },
      });
    }
  }
}
