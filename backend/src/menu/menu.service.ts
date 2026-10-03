import { Injectable } from '@nestjs/common';
import type { MenuCategoryDto, MenuCategoryInput, UpdateMenuCategoryInput } from '@fernleaf/shared';
import { DomainError } from '../common/domain-error';
import type { Prisma } from '../generated/prisma/client';
import { PricingService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.service';

const categorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  sortOrder: true,
  isActive: true,
  isSecret: true,
  _count: { select: { hiddenFor: true } },
  items: {
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      sortOrder: true,
      isActive: true,
      dish: { select: { id: true, sku: true, name: true, isActive: true } },
    },
  },
} satisfies Prisma.MenuCategorySelect;

type CategoryRow = Prisma.MenuCategoryGetPayload<{ select: typeof categorySelect }>;

/** FR-MEN-01..03: ordered categories (some secret) placing dishes, each orderable on its own. */
@Injectable()
export class MenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  async list(): Promise<MenuCategoryDto[]> {
    const [rows, unpriced] = await Promise.all([
      this.prisma.menuCategory.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: categorySelect,
      }),
      this.pricing.dishesUnpricedOnDefault(),
    ]);
    return rows.map((row) => this.toDto(row, unpriced));
  }

  async create(input: MenuCategoryInput): Promise<MenuCategoryDto> {
    await this.assertUnique(input.name, input.slug);
    const last = await this.prisma.menuCategory.aggregate({ _max: { sortOrder: true } });
    const row = await this.prisma.menuCategory.create({
      data: { ...input, sortOrder: (last._max.sortOrder ?? 0) + 1 },
      select: { id: true },
    });
    return this.get(row.id);
  }

  async update(id: string, input: UpdateMenuCategoryInput): Promise<MenuCategoryDto> {
    await this.assertCategory(id);
    await this.assertUnique(input.name, input.slug, id);
    await this.prisma.menuCategory.update({ where: { id }, data: input });
    return this.get(id);
  }

  /** Items and company hiding go with it; orders keep their own dish snapshot. */
  async remove(id: string): Promise<void> {
    await this.assertCategory(id);
    await this.prisma.menuCategory.delete({ where: { id } });
  }

  async reorderCategories(ids: string[]): Promise<MenuCategoryDto[]> {
    const count = await this.prisma.menuCategory.count();
    const known = await this.prisma.menuCategory.count({ where: { id: { in: ids } } });
    if (known !== ids.length || count !== ids.length)
      throw new DomainError('VALIDATION_FAILED', 'Send every category exactly once.');
    await this.prisma.$transaction(
      ids.map((id, sortOrder) =>
        this.prisma.menuCategory.update({ where: { id }, data: { sortOrder } }),
      ),
    );
    return this.list();
  }

  async addItem(categoryId: string, dishId: string): Promise<MenuCategoryDto> {
    await this.assertCategory(categoryId);
    const dish = await this.prisma.dish.findUnique({
      where: { id: dishId },
      select: { name: true },
    });
    if (!dish) throw new DomainError('NOT_FOUND', 'Dish not found.');
    const clash = await this.prisma.menuItem.findUnique({
      where: { categoryId_dishId: { categoryId, dishId } },
      select: { id: true },
    });
    if (clash)
      throw new DomainError('UNIQUE_VIOLATION', `${dish.name} is already in this category.`);
    const last = await this.prisma.menuItem.aggregate({
      where: { categoryId },
      _max: { sortOrder: true },
    });
    await this.prisma.menuItem.create({
      data: { categoryId, dishId, sortOrder: (last._max.sortOrder ?? 0) + 1 },
    });
    return this.get(categoryId);
  }

  async updateItem(id: string, isActive: boolean): Promise<MenuCategoryDto> {
    const item = await this.prisma.menuItem.update({
      where: { id },
      data: { isActive },
      select: { categoryId: true },
    });
    return this.get(item.categoryId);
  }

  async removeItem(id: string): Promise<MenuCategoryDto> {
    const item = await this.prisma.menuItem.delete({ where: { id }, select: { categoryId: true } });
    return this.get(item.categoryId);
  }

  async reorderItems(categoryId: string, ids: string[]): Promise<MenuCategoryDto> {
    await this.assertCategory(categoryId);
    const items = await this.prisma.menuItem.findMany({
      where: { categoryId },
      select: { id: true },
    });
    const own = new Set(items.map((i) => i.id));
    if (ids.length !== own.size || ids.some((id) => !own.has(id)))
      throw new DomainError('VALIDATION_FAILED', 'Send every item of this category exactly once.');
    await this.prisma.$transaction(
      ids.map((id, sortOrder) =>
        this.prisma.menuItem.update({ where: { id }, data: { sortOrder } }),
      ),
    );
    return this.get(categoryId);
  }

  private async get(id: string): Promise<MenuCategoryDto> {
    const [row, unpriced] = await Promise.all([
      this.prisma.menuCategory.findUnique({ where: { id }, select: categorySelect }),
      this.pricing.dishesUnpricedOnDefault(),
    ]);
    if (!row) throw new DomainError('NOT_FOUND', 'Menu category not found.');
    return this.toDto(row, unpriced);
  }

  private toDto(row: CategoryRow, unpriced: Set<string>): MenuCategoryDto {
    const { _count, items, ...fields } = row;
    return {
      ...fields,
      hiddenForCompanies: _count.hiddenFor,
      items: items.map((item) => ({
        ...item,
        unpricedOnDefaultTier: item.dish.isActive && unpriced.has(item.dish.id),
      })),
    };
  }

  private async assertCategory(id: string): Promise<void> {
    if (!(await this.prisma.menuCategory.findUnique({ where: { id }, select: { id: true } })))
      throw new DomainError('NOT_FOUND', 'Menu category not found.');
  }

  private async assertUnique(name?: string, slug?: string, exceptId?: string): Promise<void> {
    const or: Prisma.MenuCategoryWhereInput[] = [];
    if (name) or.push({ name: { equals: name, mode: 'insensitive' } });
    if (slug) or.push({ slug });
    if (or.length === 0) return;
    const clash = await this.prisma.menuCategory.findFirst({
      where: { OR: or, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { name: true, slug: true },
    });
    if (!clash) return;
    const field = slug && clash.slug === slug ? 'slug' : 'name';
    throw new DomainError('UNIQUE_VIOLATION', `Another category already uses that ${field}.`, {
      fieldErrors: { [field]: ['Already used'] },
    });
  }
}
