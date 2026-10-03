import { describe, expect, it } from 'vitest';
import {
  type MenuInput,
  type MenuInputCategory,
  type MenuInputDish,
  type MenuInputOption,
  orderableDishes,
  resolveEmployeeMenu,
} from './menu';
import { pricingContext, type TierRule } from './pricing';

const standard: TierRule = {
  id: 'std',
  name: 'Standard',
  derivation: 'FROM_COST',
  factorBps: 20_000,
  baseTierId: null,
};
const startup: TierRule = {
  id: 'stp',
  name: 'Startup',
  derivation: 'MANUAL',
  factorBps: null,
  baseTierId: null,
};

const option = (id: string, extra: Partial<MenuInputOption> = {}): MenuInputOption => ({
  id,
  name: id,
  costCents: 50,
  isActive: true,
  allergenIds: [],
  dietaryTagIds: [],
  portionExtras: new Map(),
  ...extra,
});
const dish = (id: string, extra: Partial<MenuInputDish> = {}): MenuInputDish => ({
  id,
  name: id,
  description: '',
  imageUrl: null,
  temperature: 'HOT',
  costCents: 500,
  isActive: true,
  minOrderQty: null,
  allergenIds: [],
  dietaryTagIds: [],
  groups: [],
  ...extra,
});

const bowl = dish('bowl', {
  allergenIds: ['dairy'],
  dietaryTagIds: ['veg'],
  groups: [
    {
      id: 'protein',
      name: 'Choose your protein',
      isRequired: true,
      maxSelections: 1,
      sortOrder: 1,
      usesPortions: false,
      portionSizeIds: [],
      items: [
        { optionId: 'paneer', sortOrder: 1 },
        { optionId: 'tofu', sortOrder: 2 },
      ],
    },
    {
      id: 'rice',
      name: 'Choose your rice',
      isRequired: true,
      maxSelections: 1,
      sortOrder: 2,
      usesPortions: true,
      portionSizeIds: ['reg', 'lrg'],
      items: [
        { optionId: 'jeera', sortOrder: 1 },
        { optionId: 'brown', sortOrder: 2 },
      ],
    },
    {
      id: 'sides',
      name: 'Add sides',
      isRequired: false,
      maxSelections: 2,
      sortOrder: 3,
      usesPortions: false,
      portionSizeIds: [],
      items: [{ optionId: 'raita', sortOrder: 1 }],
    },
  ],
});

const categories: MenuInputCategory[] = [
  {
    id: 'c-bowls',
    name: 'Bowls',
    slug: 'bowls',
    sortOrder: 1,
    isActive: true,
    isSecret: false,
    items: [
      { id: 'mi-bowl', dishId: 'bowl', sortOrder: 2 },
      { id: 'mi-wrap', dishId: 'wrap', sortOrder: 1 },
    ].map((i) => ({ ...i, isActive: true })),
  },
  {
    id: 'c-desserts',
    name: 'Desserts',
    slug: 'desserts',
    sortOrder: 2,
    isActive: true,
    isSecret: false,
    items: [{ id: 'mi-cake', dishId: 'cake', sortOrder: 1, isActive: true }],
  },
  {
    id: 'c-chef',
    name: "Chef's Table",
    slug: 'chefs-table',
    sortOrder: 3,
    isActive: true,
    isSecret: true,
    items: [{ id: 'mi-truffle', dishId: 'truffle', sortOrder: 1, isActive: true }],
  },
];

function input(
  overrides: Partial<MenuInput> = {},
  rows: Parameters<typeof pricingContext>[1] = [],
): MenuInput {
  return {
    categories,
    dishes: new Map([bowl, dish('wrap'), dish('cake'), dish('truffle')].map((d) => [d.id, d])),
    options: new Map(
      [
        option('paneer', { allergenIds: ['dairy'] }),
        option('tofu', { allergenIds: ['soy'] }),
        option('jeera', {
          portionExtras: new Map([
            ['reg', 0],
            ['lrg', 75],
          ]),
        }),
        option('brown', { portionExtras: new Map([['reg', 0]]) }), // no Large → not offered
        option('raita', { isActive: false }),
      ].map((o) => [o.id, o]),
    ),
    hidden: { categoryIds: new Set(), menuItemIds: new Set() },
    tierId: 'std',
    pricing: pricingContext([standard, startup], rows),
    employee: { allergenIds: new Set(['soy']), dietaryTagIds: new Set(['veg']) },
    ...overrides,
  };
}

const names = (menu: ReturnType<typeof resolveEmployeeMenu>) =>
  menu.map((c) => `${c.name}: ${c.items.map((i) => i.name).join(', ')}`);

describe('BR-MEN-01: what an employee sees', () => {
  it('lists active categories and items in display order, priced on the tier', () => {
    const menu = resolveEmployeeMenu(input());
    expect(names(menu)).toEqual(['Bowls: wrap, bowl', 'Desserts: cake']);
    expect(menu[0]?.items[1]?.priceCents).toBe(1000); // 500¢ cost × 2.0
  });

  it('drops inactive categories, items and dishes', () => {
    const inactive = input({
      categories: categories.map((c) => (c.id === 'c-desserts' ? { ...c, isActive: false } : c)),
      dishes: new Map(
        [bowl, dish('wrap', { isActive: false }), dish('cake'), dish('truffle')].map((d) => [
          d.id,
          d,
        ]),
      ),
    });
    expect(names(resolveEmployeeMenu(inactive))).toEqual(['Bowls: bowl']);
  });

  it('A-10: hiding a category hides its items; hiding an item hides that placement', () => {
    const hidden = input({
      hidden: { categoryIds: new Set(['c-desserts']), menuItemIds: new Set(['mi-wrap']) },
    });
    expect(names(resolveEmployeeMenu(hidden))).toEqual(['Bowls: bowl']);
  });

  it('BR-PRC-04: a dish without a price on the employee tier is absent, not shown at $0', () => {
    const startupMenu = input({ tierId: 'stp' }, [
      { tierId: 'stp', kind: 'DISH', itemId: 'cake', priceCents: 450 },
    ]);
    expect(names(resolveEmployeeMenu(startupMenu))).toEqual(['Desserts: cake']);
  });
});

describe('BR-MEN-02: secret categories', () => {
  it('are not listed', () => {
    expect(resolveEmployeeMenu(input()).map((c) => c.slug)).not.toContain('chefs-table');
  });

  it('are reachable by slug', () => {
    const menu = resolveEmployeeMenu(input(), { mode: 'slug', slug: 'chefs-table' });
    expect(menu.find((c) => c.slug === 'chefs-table')?.items.map((i) => i.dishId)).toEqual([
      'truffle',
    ]);
  });

  it('hiding beats secret: a hidden secret category is unreachable', () => {
    const hidden = input({ hidden: { categoryIds: new Set(['c-chef']), menuItemIds: new Set() } });
    expect(
      resolveEmployeeMenu(hidden, { mode: 'slug', slug: 'chefs-table' }).map((c) => c.slug),
    ).not.toContain('chefs-table');
  });
});

describe('BR-MEN-03 / A-12: offered options', () => {
  const groups = () =>
    resolveEmployeeMenu(input())[0]!.items.find((i) => i.dishId === 'bowl')!.groups;

  it('offers active, priced options; inactive ones and empty optional groups disappear', () => {
    expect(groups().map((g) => g.id)).toEqual(['protein', 'rice']); // sides: raita inactive
  });

  it('FR-CAT-05: in a portioned group only options supporting every size are offered', () => {
    const rice = groups().find((g) => g.id === 'rice')!;
    expect(rice.options.map((o) => o.optionId)).toEqual(['jeera']);
    expect(rice.options[0]?.sizes).toEqual([
      { portionSizeId: 'reg', extraCents: 0 },
      { portionSizeId: 'lrg', extraCents: 75 },
    ]);
  });

  it('a required group with nothing on offer hides the whole dish', () => {
    const noProteins = input({}, [
      { tierId: 'std', kind: 'OPTION', itemId: 'paneer', priceCents: null },
      { tierId: 'std', kind: 'OPTION', itemId: 'tofu', priceCents: null },
    ]);
    expect(resolveEmployeeMenu(noProteins)[0]?.items.map((i) => i.dishId)).toEqual(['wrap']);
  });
});

describe('allergy and diet signals for the employee', () => {
  it('flags allergens the employee has and diets the dish satisfies', () => {
    const view = resolveEmployeeMenu(input())[0]!.items.find((i) => i.dishId === 'bowl')!;
    expect(view.allergenConflicts).toEqual([]); // dish has dairy; employee is allergic to soy
    expect(view.dietMatches).toEqual(['veg']);
    const tofu = view.groups[0]!.options.find((o) => o.optionId === 'tofu')!;
    expect(tofu.allergenConflicts).toEqual(['soy']);
  });
});

describe('BR-MEN-04: order validation uses the same rules', () => {
  it('orderable dishes include secret ones (reachable) but never hidden or unpriced ones', () => {
    const orderable = orderableDishes(
      input({ hidden: { categoryIds: new Set(['c-desserts']), menuItemIds: new Set() } }),
    );
    expect([...orderable.keys()].sort()).toEqual(['bowl', 'truffle', 'wrap']);
  });
});
