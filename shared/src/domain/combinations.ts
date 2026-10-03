import type { ErrorCode } from '../errors';
import type { MenuDishView } from './menu';
import type { Cents } from './money';

/**
 * Order lines → validated, canonical, merged, priced combinations (BR-CMB-01..05, BR-MNY-02,
 * BR-PRC-07, TRD §8.3). Pure: the caller passes the employee's orderable dishes (from the same
 * menu function as the preview, BR-MEN-04) and, on edit, the prices captured earlier.
 */

export interface ChoiceInput {
  groupId: string;
  optionId: string;
  portionSizeId?: string | null;
}

export interface CombinationInput {
  quantity: number;
  choices: readonly ChoiceInput[];
}

export interface LineInput {
  dishId: string;
  quantity: number;
  combinations: readonly CombinationInput[];
}

export interface NormalisedChoice {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  portionSizeId: string | null;
  /** Option price on the tier + portion extra (captured). */
  priceCents: Cents;
  /** Display order (menu order of group, then option). */
  sortOrder: number;
}

export interface NormalisedCombination {
  signature: string;
  quantity: number;
  unitPriceCents: Cents;
  totalCents: Cents;
  choices: NormalisedChoice[];
  /** True when the prices came from the order as saved before (BR-PRC-07). */
  captured: boolean;
}

export interface NormalisedLine {
  dishId: string;
  dishName: string;
  dishSku: string | null;
  quantity: number;
  dishPriceCents: Cents;
  totalCents: Cents;
  combinations: NormalisedCombination[];
}

export interface LineIssue {
  path: string;
  code: ErrorCode;
  message: string;
}

export interface AllergenWarning {
  path: string;
  dishName: string;
  allergenIds: string[];
}

/** What an earlier save of the same order captured, keyed by `dishId|signature`. */
export interface CapturedCombination {
  dishName: string;
  dishSku: string | null;
  dishPriceCents: Cents;
  unitPriceCents: Cents;
  choices: NormalisedChoice[];
}

export type NormaliseResult =
  | { ok: true; lines: NormalisedLine[]; totalCents: Cents; warnings: AllergenWarning[] }
  | { ok: false; issues: LineIssue[] };

/**
 * BR-CMB-04: canonical identity of a combination. Sorted by ids (not display order) so that
 * reordering groups or options in the catalogue never changes an existing combination's
 * identity, which would silently re-price it on the next edit (ADR-027).
 */
export function signatureOf(choices: readonly ChoiceInput[]): string {
  return choices
    .map((c) => `${c.groupId}:${c.optionId}${c.portionSizeId ? `@${c.portionSizeId}` : ''}`)
    .sort()
    .join('|');
}

export const capturedKey = (dishId: string, signature: string) => `${dishId}|${signature}`;

const isPositiveInt = (n: number) => Number.isInteger(n) && n >= 1;

export function normaliseOrder(
  lines: readonly LineInput[],
  orderable: ReadonlyMap<string, MenuDishView>,
  captured: ReadonlyMap<string, CapturedCombination> = new Map(),
): NormaliseResult {
  const issues: LineIssue[] = [];
  const warnings: AllergenWarning[] = [];
  const out: NormalisedLine[] = [];

  if (lines.length === 0)
    issues.push({ path: 'lines', code: 'VALIDATION_FAILED', message: 'Add at least one dish.' });

  const seenDishes = new Set<string>();
  lines.forEach((line, i) => {
    const at = `lines.${i}`;
    // BR-CMB-01: one line per dish.
    if (seenDishes.has(line.dishId)) {
      issues.push({
        path: `${at}.dishId`,
        code: 'COMBINATION_INVALID',
        message: 'This dish is already on the order; add a combination to its line instead.',
      });
      return;
    }
    seenDishes.add(line.dishId);

    const dish = orderable.get(line.dishId);
    const result = normaliseLine(line, at, dish, captured, issues);
    if (!result) return;
    out.push(result);

    if (dish) {
      const conflicts = new Set(dish.allergenConflicts);
      for (const combination of result.combinations)
        for (const choice of combination.choices) {
          const option = dish.groups
            .find((g) => g.id === choice.groupId)
            ?.options.find((o) => o.optionId === choice.optionId);
          for (const id of option?.allergenConflicts ?? []) conflicts.add(id);
        }
      if (conflicts.size > 0)
        warnings.push({ path: at, dishName: dish.name, allergenIds: [...conflicts] });
    }
  });

  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    lines: out,
    totalCents: out.reduce((sum, l) => sum + l.totalCents, 0),
    warnings,
  };
}

function normaliseLine(
  line: LineInput,
  at: string,
  dish: MenuDishView | undefined,
  captured: ReadonlyMap<string, CapturedCombination>,
  issues: LineIssue[],
): NormalisedLine | null {
  const before = issues.length;

  // BR-CMB-01: positive quantities that add up to the line quantity.
  if (!isPositiveInt(line.quantity))
    issues.push({
      path: `${at}.quantity`,
      code: 'QUANTITY_MISMATCH',
      message: 'Quantity must be a whole number of at least 1.',
    });
  if (line.combinations.length === 0)
    issues.push({
      path: `${at}.combinations`,
      code: 'QUANTITY_MISMATCH',
      message: 'Add at least one combination.',
    });
  line.combinations.forEach((c, j) => {
    if (!isPositiveInt(c.quantity))
      issues.push({
        path: `${at}.combinations.${j}.quantity`,
        code: 'QUANTITY_MISMATCH',
        message: 'Quantity must be a whole number of at least 1.',
      });
  });
  const sum = line.combinations.reduce((s, c) => s + c.quantity, 0);
  if (isPositiveInt(line.quantity) && sum !== line.quantity)
    issues.push({
      path: `${at}.quantity`,
      code: 'QUANTITY_MISMATCH',
      message: `The combinations add up to ${sum}, but the line says ${line.quantity}.`,
    });

  // Validate and price each combination, then merge identical ones (BR-CMB-04).
  const merged = new Map<string, NormalisedCombination>();
  let meta: { name: string; sku: string | null; priceCents: Cents } | null = dish
    ? { name: dish.name, sku: null, priceCents: dish.priceCents }
    : null;

  line.combinations.forEach((combination, j) => {
    const path = `${at}.combinations.${j}`;
    const signature = signatureOf(combination.choices);
    const kept = captured.get(capturedKey(line.dishId, signature));

    let priced: Omit<NormalisedCombination, 'quantity' | 'totalCents'> | null = null;
    if (kept) {
      // BR-PRC-07: an unchanged combination keeps its captured prices, even if the dish or an
      // option has since been hidden or re-priced (grandfathered).
      meta ??= { name: kept.dishName, sku: kept.dishSku, priceCents: kept.dishPriceCents };
      priced = {
        signature,
        unitPriceCents: kept.unitPriceCents,
        choices: kept.choices,
        captured: true,
      };
    } else if (!dish) {
      issues.push({
        path: `${at}.dishId`,
        code: 'DISH_NOT_AVAILABLE',
        message: "This dish isn't on this employee's menu for their company and tier.",
      });
    } else {
      const choices = validateChoices(combination.choices, dish, path, issues);
      if (choices)
        priced = {
          signature,
          unitPriceCents: dish.priceCents + choices.reduce((s, c) => s + c.priceCents, 0),
          choices,
          captured: false,
        };
    }
    if (!priced || !isPositiveInt(combination.quantity)) return;

    const existing = merged.get(signature);
    if (existing) {
      existing.quantity += combination.quantity;
      existing.totalCents = existing.unitPriceCents * existing.quantity;
    } else {
      merged.set(signature, {
        ...priced,
        quantity: combination.quantity,
        totalCents: priced.unitPriceCents * combination.quantity,
      });
    }
  });

  // BR-CMB-05: minimum order quantity.
  if (dish?.minOrderQty && isPositiveInt(line.quantity) && line.quantity < dish.minOrderQty)
    issues.push({
      path: `${at}.quantity`,
      code: 'MIN_QTY_NOT_MET',
      message: `${dish.name} needs at least ${dish.minOrderQty} per order.`,
    });

  if (issues.length > before || !meta) return null;
  const combinations = [...merged.values()];
  return {
    dishId: line.dishId,
    dishName: meta.name,
    dishSku: meta.sku,
    quantity: line.quantity,
    dishPriceCents: meta.priceCents,
    totalCents: combinations.reduce((s, c) => s + c.totalCents, 0),
    combinations,
  };
}

/** BR-CMB-02/03: choices only from the dish's groups and what they offer, within the limits. */
function validateChoices(
  choices: readonly ChoiceInput[],
  dish: MenuDishView,
  path: string,
  issues: LineIssue[],
): NormalisedChoice[] | null {
  const before = issues.length;
  const out: NormalisedChoice[] = [];
  const perGroup = new Map<string, Set<string>>();

  choices.forEach((choice, k) => {
    const at = `${path}.choices.${k}`;
    const groupIndex = dish.groups.findIndex((g) => g.id === choice.groupId);
    const group = dish.groups[groupIndex];
    if (!group) {
      issues.push({
        path: at,
        code: 'COMBINATION_INVALID',
        message: `That choice doesn't belong to ${dish.name}.`,
      });
      return;
    }
    const optionIndex = group.options.findIndex((o) => o.optionId === choice.optionId);
    const option = group.options[optionIndex];
    if (!option) {
      issues.push({
        path: at,
        code: 'COMBINATION_INVALID',
        message: `That option isn't offered in "${group.name}".`,
      });
      return;
    }
    const chosen = perGroup.get(group.id) ?? new Set<string>();
    if (chosen.has(option.optionId)) {
      issues.push({
        path: at,
        code: 'COMBINATION_INVALID',
        message: `${option.name} is chosen twice in "${group.name}".`,
      });
      return;
    }
    chosen.add(option.optionId);
    perGroup.set(group.id, chosen);

    let extra = 0;
    const size = choice.portionSizeId ?? null;
    if (group.usesPortions) {
      const sized = option.sizes.find((s) => s.portionSizeId === size);
      if (!size || !sized) {
        issues.push({
          path: at,
          code: 'PORTION_SIZE_UNSUPPORTED',
          message: `Choose a size for ${option.name} in "${group.name}".`,
        });
        return;
      }
      extra = sized.extraCents;
    } else if (size) {
      issues.push({
        path: at,
        code: 'PORTION_SIZE_UNSUPPORTED',
        message: `"${group.name}" doesn't come in sizes.`,
      });
      return;
    }
    out.push({
      groupId: group.id,
      groupName: group.name,
      optionId: option.optionId,
      optionName: option.name,
      portionSizeId: size,
      priceCents: option.priceCents + extra,
      sortOrder: groupIndex * 1000 + optionIndex,
    });
  });

  for (const group of dish.groups) {
    const count = perGroup.get(group.id)?.size ?? 0;
    if (group.isRequired && count === 0)
      issues.push({
        path: `${path}.choices`,
        code: 'COMBINATION_INVALID',
        message: `"${group.name}" needs a choice.`,
      });
    if (count > group.maxSelections)
      issues.push({
        path: `${path}.choices`,
        code: 'COMBINATION_INVALID',
        message: `"${group.name}" allows at most ${group.maxSelections} choice${group.maxSelections === 1 ? '' : 's'}.`,
      });
  }

  if (issues.length > before) return null;
  return out.sort((a, b) => a.sortOrder - b.sortOrder);
}
