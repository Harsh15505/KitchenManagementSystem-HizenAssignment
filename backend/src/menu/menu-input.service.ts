import { Injectable } from '@nestjs/common';
import {
  effectiveTierId,
  type MenuInput,
  type MenuInputDish,
  type MenuInputOption,
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

/**
 * Loads everything `resolveEmployeeMenu` needs for one employee (BR-MEN-04). The menu preview
 * and order validation both go through here, so they can't disagree.
 */
@Injectable()
export class MenuInputService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  async forEmployee(employeeId: string): Promise<EmployeeMenuContext> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
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
      },
    });
    if (!employee) throw new DomainError('NOT_FOUND', 'Employee not found.');

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

    const tierId = effectiveTierId(employee.company, pricing.defaultTierId);
    const { hiddenCategories, hiddenMenuItems, ...company } = employee.company;
    const allergenIds = employee.allergies.map((a) => a.allergenId);
    const dietaryTagIds = employee.dietaryPreferences.map((p) => p.dietaryTagId);

    const input: MenuInput = {
      categories,
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
      hidden: {
        categoryIds: new Set(hiddenCategories.map((h) => h.categoryId)),
        menuItemIds: new Set(hiddenMenuItems.map((h) => h.menuItemId)),
      },
      tierId,
      pricing: pricing.ctx,
      employee: { allergenIds: new Set(allergenIds), dietaryTagIds: new Set(dietaryTagIds) },
    };

    return {
      input,
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
        name: pricing.tierNames.get(tierId) ?? 'Unknown tier',
        isCompanyTier: company.priceTierId !== null,
      },
    };
  }
}
