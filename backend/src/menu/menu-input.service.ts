import { Injectable } from '@nestjs/common';
import {
  effectiveTierId,
  type MenuInput,
  type MenuInputCategory,
  type MenuInputDish,
  type MenuInputOption,
  type PricingContext,
} from '@fernleaf/shared';
import { DomainError } from '../common/domain-error';
import { PricingService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.service';

export interface EmployeeMenuContext {
  input: MenuInput;
  employee: {
    id: string;
    name: string;
    email: string;
    isActive: boolean;
    company: { id: string; name: string; isActive: boolean; priceTierId: string | null };
    allergenIds: string[];
    dietaryTagIds: string[];
  };
  tier: { id: string; name: string; isCompanyTier: boolean };
}

/** The parts of the menu input that don't depend on the employee: load once, reuse many times. */
export interface MenuCatalogue {
  categories: MenuInputCategory[];
  dishes: Map<string, MenuInputDish>;
  options: Map<string, MenuInputOption>;
  pricing: PricingContext;
  defaultTierId: string;
  tierNames: Map<string, string>;
}

const employeeSelect = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  company: {
    select: {
      id: true,
      name: true,
      isActive: true,
      priceTierId: true,
      hiddenCategories: { select: { categoryId: true } },
      hiddenMenuItems: { select: { menuItemId: true } },
    },
  },
  allergies: { select: { allergenId: true } },
  dietaryPreferences: { select: { dietaryTagId: true } },
} as const;

/**
 * Loads everything `resolveEmployeeMenu` needs for one employee (BR-MEN-04). The menu preview,
 * order validation and the demo generator all go through here, so they can't disagree.
 */
@Injectable()
export class MenuInputService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  async forEmployee(employeeId: string, catalogue?: MenuCatalogue): Promise<EmployeeMenuContext> {
    const [employee, cat] = await Promise.all([
      this.prisma.employee.findUnique({ where: { id: employeeId }, select: employeeSelect }),
      catalogue ?? this.loadCatalogue(),
    ]);
    if (!employee) throw new DomainError('NOT_FOUND', 'Employee not found.');

    const tierId = effectiveTierId(employee.company, cat.defaultTierId);
    const { hiddenCategories, hiddenMenuItems, ...company } = employee.company;
    const allergenIds = employee.allergies.map((a) => a.allergenId);
    const dietaryTagIds = employee.dietaryPreferences.map((p) => p.dietaryTagId);
    return {
      input: {
        categories: cat.categories,
        dishes: cat.dishes,
        options: cat.options,
        hidden: {
          categoryIds: new Set(hiddenCategories.map((h) => h.categoryId)),
          menuItemIds: new Set(hiddenMenuItems.map((h) => h.menuItemId)),
        },
        tierId,
        pricing: cat.pricing,
        employee: { allergenIds: new Set(allergenIds), dietaryTagIds: new Set(dietaryTagIds) },
      },
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        isActive: employee.isActive,
        company,
        allergenIds,
        dietaryTagIds,
      },
      tier: {
        id: tierId,
        name: cat.tierNames.get(tierId) ?? 'Unknown tier',
        isCompanyTier: company.priceTierId !== null,
      },
    };
  }

  async loadCatalogue(): Promise<MenuCatalogue> {
    const [pricing, categories, dishes, options] = await Promise.all([
      this.pricing.loadContext(),
      this.prisma.menuCategory.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          sortOrder: true,
          isActive: true,
          isSecret: true,
          items: { select: { id: true, dishId: true, sortOrder: true, isActive: true } },
        },
      }),
      this.prisma.dish.findMany({
        where: { menuItems: { some: {} } },
        select: {
          id: true,
          name: true,
          description: true,
          imageUrl: true,
          temperature: true,
          costPriceCents: true,
          isActive: true,
          minOrderQty: true,
          allergens: { select: { allergenId: true } },
          dietaryTags: { select: { dietaryTagId: true } },
          optionGroups: {
            select: {
              id: true,
              name: true,
              isRequired: true,
              maxSelections: true,
              sortOrder: true,
              usesPortions: true,
              portionSizes: { orderBy: { sortOrder: 'asc' }, select: { portionSizeId: true } },
              items: { select: { optionId: true, sortOrder: true } },
            },
          },
        },
      }),
      this.prisma.option.findMany({
        select: {
          id: true,
          name: true,
          costPriceCents: true,
          isActive: true,
          allergens: { select: { allergenId: true } },
          dietaryTags: { select: { dietaryTagId: true } },
          portionPrices: { select: { portionSizeId: true, extraChargeCents: true } },
        },
      }),
    ]);
    return {
      categories,
      pricing: pricing.ctx,
      defaultTierId: pricing.defaultTierId,
      tierNames: pricing.tierNames,
      dishes: new Map(
        dishes.map((d): [string, MenuInputDish] => [
          d.id,
          {
            id: d.id,
            name: d.name,
            description: d.description,
            imageUrl: d.imageUrl,
            temperature: d.temperature,
            costCents: d.costPriceCents,
            isActive: d.isActive,
            minOrderQty: d.minOrderQty,
            allergenIds: d.allergens.map((a) => a.allergenId),
            dietaryTagIds: d.dietaryTags.map((t) => t.dietaryTagId),
            groups: d.optionGroups.map((g) => ({
              id: g.id,
              name: g.name,
              isRequired: g.isRequired,
              maxSelections: g.maxSelections,
              sortOrder: g.sortOrder,
              usesPortions: g.usesPortions,
              portionSizeIds: g.portionSizes.map((p) => p.portionSizeId),
              items: g.items,
            })),
          },
        ]),
      ),
      options: new Map(
        options.map((o): [string, MenuInputOption] => [
          o.id,
          {
            id: o.id,
            name: o.name,
            costCents: o.costPriceCents,
            isActive: o.isActive,
            allergenIds: o.allergens.map((a) => a.allergenId),
            dietaryTagIds: o.dietaryTags.map((t) => t.dietaryTagId),
            portionExtras: new Map(
              o.portionPrices.map((p) => [p.portionSizeId, p.extraChargeCents]),
            ),
          },
        ]),
      ),
    };
  }
}
