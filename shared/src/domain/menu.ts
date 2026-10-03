import type { Cents } from './money';
import { type PricingContext, resolvePrice } from './pricing';

/**
 * The employee menu (BR-MEN-01..04, A-10..A-12, TRD §8.4). One pure function serves the menu
 * preview AND order validation, so what staff see is exactly what the server accepts.
 */

export interface MenuInputCategory {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  isSecret: boolean;
  items: ReadonlyArray<{ id: string; dishId: string; sortOrder: number; isActive: boolean }>;
}

export interface MenuInputGroup {
  id: string;
  name: string;
  isRequired: boolean;
  maxSelections: number;
  sortOrder: number;
  usesPortions: boolean;
  /** The sizes this group sells, in display order. */
  portionSizeIds: readonly string[];
  items: ReadonlyArray<{ optionId: string; sortOrder: number }>;
}

export interface MenuInputDish {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  temperature: 'HOT' | 'COLD';
  costCents: Cents;
  isActive: boolean;
  minOrderQty: number | null;
  allergenIds: readonly string[];
  dietaryTagIds: readonly string[];
  groups: readonly MenuInputGroup[];
}

export interface MenuInputOption {
  id: string;
  name: string;
  costCents: Cents;
  isActive: boolean;
  allergenIds: readonly string[];
  dietaryTagIds: readonly string[];
  /** Extra charge per portion size the option supports (absent = size not supported). */
  portionExtras: ReadonlyMap<string, Cents>;
}

export interface MenuInput {
  categories: readonly MenuInputCategory[];
  dishes: ReadonlyMap<string, MenuInputDish>;
  options: ReadonlyMap<string, MenuInputOption>;
  hidden: { categoryIds: ReadonlySet<string>; menuItemIds: ReadonlySet<string> };
  tierId: string;
  pricing: PricingContext;
  employee: { allergenIds: ReadonlySet<string>; dietaryTagIds: ReadonlySet<string> };
}

/**
 * Which secret categories to include: none (the listed menu), the one opened by slug,
 * or all of them (order validation: secret categories are "reachable").
 */
export type SecretAccess = { mode: 'listed' } | { mode: 'slug'; slug: string } | { mode: 'all' };

export interface MenuOptionView {
  optionId: string;
  name: string;
  priceCents: Cents;
  allergenIds: string[];
  allergenConflicts: string[];
  sizes: Array<{ portionSizeId: string; extraCents: Cents }>;
}

export interface MenuGroupView {
  id: string;
  name: string;
  isRequired: boolean;
  maxSelections: number;
  usesPortions: boolean;
  portionSizeIds: string[];
  options: MenuOptionView[];
}

export interface MenuDishView {
  menuItemId: string;
  dishId: string;
  name: string;
  description: string;
  imageUrl: string | null;
  temperature: 'HOT' | 'COLD';
  priceCents: Cents;
  minOrderQty: number | null;
  allergenIds: string[];
  dietaryTagIds: string[];
  /** Dish allergens the employee is allergic to (options carry their own conflicts). */
  allergenConflicts: string[];
  /** Employee dietary preferences this dish satisfies. */
  dietMatches: string[];
  groups: MenuGroupView[];
}

export interface MenuCategoryView {
  id: string;
  name: string;
  slug: string;
  isSecret: boolean;
  items: MenuDishView[];
}

const bySort = <T extends { sortOrder: number }>(a: T, b: T) => a.sortOrder - b.sortOrder;
const intersect = (ids: readonly string[], set: ReadonlySet<string>) =>
  ids.filter((id) => set.has(id));

function offeredOptions(group: MenuInputGroup, input: MenuInput): MenuOptionView[] {
  const offered: MenuOptionView[] = [];
  for (const item of [...group.items].sort(bySort)) {
    const option = input.options.get(item.optionId);
    if (!option?.isActive) continue;

    const price = resolvePrice(
      { kind: 'OPTION', id: option.id, costCents: option.costCents },
      input.tierId,
      input.pricing,
    );
    if (price.cents === null) continue; // A-12: unpriced options are not offered

    // FR-CAT-05: in a portioned group the option must support every size the group sells.
    const sizes: MenuOptionView['sizes'] = [];
    if (group.usesPortions) {
      const supportsAll = group.portionSizeIds.every((sizeId) => option.portionExtras.has(sizeId));
      if (!supportsAll) continue;
      for (const sizeId of group.portionSizeIds)
        sizes.push({ portionSizeId: sizeId, extraCents: option.portionExtras.get(sizeId) ?? 0 });
    }

    offered.push({
      optionId: option.id,
      name: option.name,
      priceCents: price.cents,
      allergenIds: [...option.allergenIds],
      allergenConflicts: intersect(option.allergenIds, input.employee.allergenIds),
      sizes,
    });
  }
  return offered;
}

function dishView(menuItemId: string, dish: MenuInputDish, input: MenuInput): MenuDishView | null {
  if (!dish.isActive) return null;
  const price = resolvePrice(
    { kind: 'DISH', id: dish.id, costCents: dish.costCents },
    input.tierId,
    input.pricing,
  );
  if (price.cents === null) return null; // BR-PRC-04: no price on the tier → not on the menu

  const groups: MenuGroupView[] = [];
  for (const group of [...dish.groups].sort(bySort)) {
    const options = offeredOptions(group, input);
    if (options.length === 0) {
      if (group.isRequired) return null; // A-12: a required choice nobody can make → unorderable
      continue; // an optional group with nothing on offer is simply not shown
    }
    groups.push({
      id: group.id,
      name: group.name,
      isRequired: group.isRequired,
      maxSelections: group.maxSelections,
      usesPortions: group.usesPortions,
      portionSizeIds: [...group.portionSizeIds],
      options,
    });
  }

  return {
    menuItemId,
    dishId: dish.id,
    name: dish.name,
    description: dish.description,
    imageUrl: dish.imageUrl,
    temperature: dish.temperature,
    priceCents: price.cents,
    minOrderQty: dish.minOrderQty,
    allergenIds: [...dish.allergenIds],
    dietaryTagIds: [...dish.dietaryTagIds],
    allergenConflicts: intersect(dish.allergenIds, input.employee.allergenIds),
    dietMatches: intersect(dish.dietaryTagIds, input.employee.dietaryTagIds),
    groups,
  };
}

export function resolveEmployeeMenu(
  input: MenuInput,
  access: SecretAccess = { mode: 'listed' },
): MenuCategoryView[] {
  const result: MenuCategoryView[] = [];
  for (const category of [...input.categories].sort(bySort)) {
    if (!category.isActive || input.hidden.categoryIds.has(category.id)) continue; // hiding beats secret
    if (category.isSecret) {
      const reachable =
        access.mode === 'all' || (access.mode === 'slug' && access.slug === category.slug);
      if (!reachable) continue;
    }

    const items: MenuDishView[] = [];
    for (const item of [...category.items].sort(bySort)) {
      if (!item.isActive || input.hidden.menuItemIds.has(item.id)) continue;
      const dish = input.dishes.get(item.dishId);
      const view = dish ? dishView(item.id, dish, input) : null;
      if (view) items.push(view);
    }
    if (items.length > 0) {
      result.push({
        id: category.id,
        name: category.name,
        slug: category.slug,
        isSecret: category.isSecret,
        items,
      });
    }
  }
  return result;
}

/**
 * Dishes the employee may order (BR-MEN-04): visible through ANY placement, including secret
 * categories, which are reachable. Keyed by dishId; the view carries the offered options.
 */
export function orderableDishes(input: MenuInput): Map<string, MenuDishView> {
  const dishes = new Map<string, MenuDishView>();
  for (const category of resolveEmployeeMenu(input, { mode: 'all' })) {
    for (const item of category.items) if (!dishes.has(item.dishId)) dishes.set(item.dishId, item);
  }
  return dishes;
}
