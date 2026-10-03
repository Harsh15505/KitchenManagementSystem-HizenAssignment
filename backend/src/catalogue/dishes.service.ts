import { Injectable } from '@nestjs/common';
import {
  type CatalogueListQuery,
  type DishDetail,
  type DishInput,
  type DishListItem,
  type Paginated,
  paginated,
  type UpdateDishInput,
} from '@fernleaf/shared';
import { DomainError } from '../common/domain-error';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const listSelect = {
  id: true,
  sku: true,
  name: true,
  temperature: true,
  costPriceCents: true,
  isActive: true,
  kitchenStation: { select: { id: true, name: true } },
  _count: { select: { optionGroups: true, menuItems: true } },
} satisfies Prisma.DishSelect;

type ListRow = Prisma.DishGetPayload<{ select: typeof listSelect }>;

const toListItem = (row: ListRow): DishListItem => ({
  id: row.id,
  sku: row.sku,
  name: row.name,
  temperature: row.temperature,
  costPriceCents: row.costPriceCents,
  isActive: row.isActive,
  station: row.kitchenStation,
  groupCount: row._count.optionGroups,
  menuPlacements: row._count.menuItems,
});

/** FR-CAT-01/02: dishes are deactivated, never deleted (historical orders reference them). */
@Injectable()
export class DishesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: CatalogueListQuery): Promise<Paginated<DishListItem>> {
    const where: Prisma.DishWhereInput = {
      ...(query.active ? { isActive: query.active === 'true' } : {}),
      ...(query.stationId ? { kitchenStationId: query.stationId } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { sku: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.dish.findMany({
        where,
        select: listSelect,
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.dish.count({ where }),
    ]);
    return paginated(rows.map(toListItem), total, query);
  }

  async get(id: string): Promise<DishDetail> {
    const dish = await this.prisma.dish.findUnique({
      where: { id },
      select: {
        ...listSelect,
        description: true,
        imageUrl: true,
        minOrderQty: true,
        allergens: { select: { allergenId: true } },
        dietaryTags: { select: { dietaryTagId: true } },
        optionGroups: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            isRequired: true,
            maxSelections: true,
            sortOrder: true,
            usesPortions: true,
            portionSizes: {
              orderBy: { sortOrder: 'asc' },
              select: { portionSize: { select: { id: true, name: true } } },
            },
            items: {
              orderBy: { sortOrder: 'asc' },
              select: { option: { select: { id: true, name: true, isActive: true } } },
            },
          },
        },
      },
    });
    if (!dish) throw new DomainError('NOT_FOUND', 'Dish not found.');
    return {
      ...toListItem(dish),
      description: dish.description,
      imageUrl: dish.imageUrl,
      minOrderQty: dish.minOrderQty,
      allergenIds: dish.allergens.map((a) => a.allergenId),
      dietaryTagIds: dish.dietaryTags.map((t) => t.dietaryTagId),
      groups: dish.optionGroups.map((g) => ({
        id: g.id,
        name: g.name,
        isRequired: g.isRequired,
        maxSelections: g.maxSelections,
        sortOrder: g.sortOrder,
        usesPortions: g.usesPortions,
        portionSizes: g.portionSizes.map((p) => p.portionSize),
        options: g.items.map((i) => i.option),
      })),
    };
  }

  async create(input: DishInput): Promise<DishDetail> {
    await this.assertSkuFree(input.sku);
    const { allergenIds, dietaryTagIds, ...fields } = input;
    const dish = await this.prisma.dish.create({
      data: {
        ...fields,
        allergens: { create: allergenIds.map((allergenId) => ({ allergenId })) },
        dietaryTags: { create: dietaryTagIds.map((dietaryTagId) => ({ dietaryTagId })) },
      },
      select: { id: true },
    });
    return this.get(dish.id);
  }

  async update(id: string, input: UpdateDishInput): Promise<DishDetail> {
    const existing = await this.prisma.dish.findUnique({ where: { id }, select: { sku: true } });
    if (!existing) throw new DomainError('NOT_FOUND', 'Dish not found.');
    if (input.sku && input.sku !== existing.sku) await this.assertSkuFree(input.sku);

    const { allergenIds, dietaryTagIds, ...fields } = input;
    await this.prisma.$transaction(async (tx) => {
      await tx.dish.update({ where: { id }, data: fields });
      if (allergenIds) {
        await tx.dishAllergen.deleteMany({ where: { dishId: id } });
        await tx.dishAllergen.createMany({
          data: allergenIds.map((allergenId) => ({ dishId: id, allergenId })),
        });
      }
      if (dietaryTagIds) {
        await tx.dishDietaryTag.deleteMany({ where: { dishId: id } });
        await tx.dishDietaryTag.createMany({
          data: dietaryTagIds.map((dietaryTagId) => ({ dishId: id, dietaryTagId })),
        });
      }
    });
    return this.get(id);
  }

  private async assertSkuFree(sku: string): Promise<void> {
    if (await this.prisma.dish.findUnique({ where: { sku }, select: { id: true } })) {
      throw new DomainError('UNIQUE_VIOLATION', `SKU ${sku} is already used by another dish.`, {
        fieldErrors: { sku: ['Already used by another dish'] },
      });
    }
  }
}
