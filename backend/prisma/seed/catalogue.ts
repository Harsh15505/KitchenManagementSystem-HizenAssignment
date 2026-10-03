import { deriveCents } from '@fernleaf/shared';
import type { PrismaClient } from '../../src/generated/prisma/client';

/**
 * Catalogue, price tiers and menu from vault/08 Knowledge/Demo Data Plan.md (T-313).
 * Idempotent and non-destructive: rows are created when missing (upsert with `update: {}`), so
 * re-seeding never overwrites what an admin changed in the UI.
 */

type Temp = 'HOT' | 'COLD';

interface OptionSeed {
  name: string;
  cost: number;
  allergens?: string[];
  tags?: string[];
  /** Extra charge per portion size, for options used in portioned groups. */
  sizes?: Record<string, number>;
}

interface GroupSeed {
  name: string;
  required: boolean;
  max?: number;
  portions?: string[];
  options: string[];
}

interface DishSeed {
  sku: string;
  name: string;
  description: string;
  temp: Temp;
  cost: number;
  station: string | null;
  allergens?: string[];
  tags?: string[];
  minQty?: number;
  groups?: GroupSeed[];
}

const VEG = ['Vegetarian'];
const VEGAN = ['Vegetarian', 'Vegan', 'Dairy-free'];

const OPTIONS: OptionSeed[] = [
  { name: 'Paneer', cost: 45, allergens: ['Milk / Dairy'], tags: [...VEG, 'High-protein'] },
  { name: 'Tofu', cost: 40, allergens: ['Soy'], tags: [...VEGAN, 'High-protein'] },
  { name: 'Chickpeas', cost: 20, tags: [...VEGAN, 'Gluten-free'] },
  { name: 'Grilled Chicken', cost: 60, tags: ['High-protein', 'Gluten-free'] },
  {
    name: 'Jeera Rice',
    cost: 15,
    tags: [...VEGAN, 'Gluten-free'],
    sizes: { Regular: 0, Large: 40 },
  },
  {
    name: 'Brown Rice',
    cost: 20,
    tags: [...VEGAN, 'Gluten-free'],
    sizes: { Regular: 0, Large: 45 },
  },
  { name: 'Millet', cost: 25, tags: [...VEGAN, 'Gluten-free'], sizes: { Regular: 0, Large: 50 } },
  { name: 'Raita', cost: 12, allergens: ['Milk / Dairy'], tags: [...VEG, 'Gluten-free'] },
  { name: 'Mint Chutney', cost: 5, tags: [...VEGAN, 'Jain', 'Gluten-free'] },
  { name: 'Mango Pickle', cost: 5, allergens: ['Mustard'], tags: VEGAN },
  { name: 'Whole-wheat Roti', cost: 8, allergens: ['Gluten'], tags: VEGAN },
  { name: 'Missi Roti', cost: 10, allergens: ['Gluten'], tags: VEGAN },
  { name: 'Extra Papad', cost: 4, tags: [...VEGAN, 'Gluten-free'] },
  { name: 'Dairy Milk', cost: 0, allergens: ['Milk / Dairy'], tags: VEG },
  { name: 'Oat Milk', cost: 15, allergens: ['Gluten'], tags: VEGAN },
  { name: 'Sweet', cost: 0, tags: VEGAN },
  { name: 'Salted', cost: 0, tags: VEGAN },
];

const PROTEIN: GroupSeed = {
  name: 'Choose your protein',
  required: true,
  options: ['Paneer', 'Tofu', 'Chickpeas'],
};
const RICE: GroupSeed = {
  name: 'Choose your rice',
  required: true,
  portions: ['Regular', 'Large'],
  options: ['Jeera Rice', 'Brown Rice', 'Millet'],
};
const SIDES: GroupSeed = {
  name: 'Add sides',
  required: false,
  max: 2,
  options: ['Raita', 'Mint Chutney', 'Mango Pickle'],
};
const BREAD: GroupSeed = {
  name: 'Choose your bread',
  required: true,
  options: ['Whole-wheat Roti', 'Missi Roti'],
};
const MILK: GroupSeed = {
  name: 'Choose your milk',
  required: true,
  options: ['Dairy Milk', 'Oat Milk'],
};

const DISHES: DishSeed[] = [
  // Bowls
  {
    sku: 'FL-BWL-001',
    name: 'Paneer Tikka Rice Bowl',
    description: 'Tandoor-charred paneer, pickled onions, mint yoghurt',
    temp: 'HOT',
    cost: 175,
    station: 'Tandoor',
    allergens: ['Milk / Dairy'],
    tags: VEG,
    groups: [PROTEIN, RICE, SIDES],
  },
  {
    sku: 'FL-BWL-002',
    name: 'Chole Rice Bowl',
    description: 'Slow-cooked Punjabi chickpeas with kachumber',
    temp: 'HOT',
    cost: 140,
    station: 'Curry & Dal',
    tags: VEGAN,
    groups: [PROTEIN, RICE, SIDES],
  },
  {
    sku: 'FL-BWL-003',
    name: 'Rajma Chawal Bowl',
    description: 'Kidney bean curry, the Delhi Sunday classic',
    temp: 'HOT',
    cost: 135,
    station: 'Curry & Dal',
    tags: VEGAN,
    groups: [RICE, SIDES],
  },
  {
    sku: 'FL-BWL-004',
    name: 'Grilled Chicken Bowl',
    description: 'Herb-marinated chicken thigh, charred corn, chilli oil',
    temp: 'HOT',
    cost: 210,
    station: 'Grill',
    tags: ['High-protein'],
    groups: [{ ...PROTEIN, options: ['Grilled Chicken', 'Paneer'] }, RICE, SIDES],
  },
  {
    sku: 'FL-BWL-005',
    name: 'Thai Green Curry Bowl',
    description: 'Coconut green curry with seasonal vegetables',
    temp: 'HOT',
    cost: 190,
    station: 'Curry & Dal',
    allergens: ['Soy'],
    tags: VEGAN,
    groups: [PROTEIN, RICE],
  },
  // Wraps & Rolls
  {
    sku: 'FL-WRP-001',
    name: 'Paneer Kathi Roll',
    description: 'Kolkata-style roll with egg-free paratha',
    temp: 'HOT',
    cost: 120,
    station: 'Tandoor',
    allergens: ['Milk / Dairy', 'Gluten'],
    tags: VEG,
    groups: [BREAD, SIDES],
  },
  {
    sku: 'FL-WRP-002',
    name: 'Falafel Wrap',
    description: 'Crisp falafel, tahini, pickled turnip',
    temp: 'HOT',
    cost: 110,
    station: 'Grill',
    allergens: ['Gluten', 'Sesame'],
    tags: VEGAN,
    groups: [BREAD],
  },
  {
    sku: 'FL-WRP-003',
    name: 'Chicken Shawarma Wrap',
    description: 'Spit-roasted chicken, garlic toum',
    temp: 'HOT',
    cost: 150,
    station: 'Grill',
    allergens: ['Gluten', 'Egg'],
    tags: ['High-protein'],
    groups: [BREAD, SIDES],
  },
  {
    sku: 'FL-SNK-001',
    name: 'Samosa Snack Box',
    description: 'Two Punjabi samosas with tamarind chutney (order at least 2 boxes)',
    temp: 'HOT',
    cost: 70,
    station: 'Curry & Dal',
    allergens: ['Gluten'],
    tags: VEGAN,
    minQty: 2,
  },
  // Thalis
  {
    sku: 'FL-THL-001',
    name: 'Mini Veg Thali',
    description: 'Dal, sabzi, rice, roti, salad and a sweet',
    temp: 'HOT',
    cost: 195,
    station: 'Curry & Dal',
    allergens: ['Milk / Dairy', 'Gluten'],
    tags: VEG,
    groups: [BREAD, { ...SIDES, options: ['Raita', 'Mango Pickle', 'Extra Papad'] }],
  },
  {
    sku: 'FL-THL-002',
    name: 'Jain Thali',
    description: 'No onion, garlic or root vegetables',
    temp: 'HOT',
    cost: 200,
    station: 'Curry & Dal',
    allergens: ['Milk / Dairy', 'Gluten'],
    tags: [...VEG, 'Jain'],
    groups: [BREAD],
  },
  {
    sku: 'FL-THL-003',
    name: 'South Indian Meal',
    description: 'Sambar, rasam, poriyal, curd rice, appalam',
    temp: 'HOT',
    cost: 185,
    station: 'Curry & Dal',
    allergens: ['Milk / Dairy', 'Mustard'],
    tags: [...VEG, 'Gluten-free'],
    groups: [{ ...SIDES, options: ['Mango Pickle', 'Extra Papad'] }],
  },
  // Salads
  {
    sku: 'FL-SLD-001',
    name: 'Quinoa Kachumber Salad',
    description: 'Quinoa, cucumber, tomato, lemon, roasted peanuts',
    temp: 'COLD',
    cost: 150,
    station: 'Cold Kitchen',
    allergens: ['Peanuts'],
    tags: [...VEGAN, 'Gluten-free'],
  },
  {
    sku: 'FL-SLD-002',
    name: 'Sprouts Chaat Salad',
    description: 'Moong sprouts, pomegranate, chaat masala',
    temp: 'COLD',
    cost: 95,
    station: 'Cold Kitchen',
    tags: [...VEGAN, 'Gluten-free', 'High-protein'],
  },
  // Breakfast
  {
    sku: 'FL-BRK-001',
    name: 'Masala Oats',
    description: 'Savoury oats with vegetables and peanuts',
    temp: 'HOT',
    cost: 70,
    station: 'Curry & Dal',
    allergens: ['Gluten', 'Peanuts'],
    tags: VEGAN,
  },
  {
    sku: 'FL-BRK-002',
    name: 'Poha',
    description: 'Flattened rice, curry leaves, peanuts, lime',
    temp: 'HOT',
    cost: 60,
    station: 'Curry & Dal',
    allergens: ['Peanuts'],
    tags: [...VEGAN, 'Gluten-free'],
  },
  {
    sku: 'FL-BRK-003',
    name: 'Idli Sambar',
    description: 'Three idlis, sambar, coconut chutney',
    temp: 'HOT',
    cost: 75,
    station: 'Curry & Dal',
    allergens: ['Mustard'],
    tags: [...VEGAN, 'Gluten-free'],
  },
  {
    sku: 'FL-BRK-004',
    name: 'Avocado Toast',
    description: 'Sourdough, smashed avocado, chilli flakes',
    temp: 'COLD',
    cost: 130,
    station: 'Cold Kitchen',
    allergens: ['Gluten'],
    tags: VEGAN,
  },
  {
    sku: 'FL-FRT-001',
    name: 'Seasonal Fruit Cup',
    description: 'Cut seasonal fruit with chaat masala',
    temp: 'COLD',
    cost: 65,
    station: null,
    tags: [...VEGAN, 'Jain', 'Gluten-free'],
  },
  // Desserts
  {
    sku: 'FL-DST-001',
    name: 'Gulab Jamun (2 pcs)',
    description: 'Warm, cardamom syrup',
    temp: 'HOT',
    cost: 40,
    station: 'Pastry',
    allergens: ['Milk / Dairy', 'Gluten'],
    tags: VEG,
  },
  {
    sku: 'FL-DST-002',
    name: 'Mango Shrikhand',
    description: 'Hung curd, Alphonso mango, pistachio',
    temp: 'COLD',
    cost: 55,
    station: 'Cold Kitchen',
    allergens: ['Milk / Dairy', 'Tree nuts'],
    tags: [...VEG, 'Gluten-free'],
  },
  {
    sku: 'FL-DST-003',
    name: 'Ragi Brownie',
    description: 'Finger-millet brownie, jaggery',
    temp: 'COLD',
    cost: 50,
    station: 'Pastry',
    allergens: ['Milk / Dairy', 'Egg'],
    tags: [...VEG, 'Gluten-free'],
  },
  // Beverages
  {
    sku: 'FL-BEV-001',
    name: 'Masala Chai',
    description: 'Assam tea, ginger, cardamom',
    temp: 'HOT',
    cost: 25,
    station: 'Beverages',
    tags: VEG,
    groups: [MILK],
  },
  {
    sku: 'FL-BEV-002',
    name: 'Cold Coffee',
    description: 'Slow-brewed, lightly sweetened',
    temp: 'COLD',
    cost: 55,
    station: 'Beverages',
    tags: VEG,
    groups: [MILK],
  },
  {
    sku: 'FL-BEV-003',
    name: 'Fresh Lime Soda',
    description: 'Fresh lime, soda, mint',
    temp: 'COLD',
    cost: 25,
    station: 'Beverages',
    tags: [...VEGAN, 'Jain', 'Gluten-free'],
    groups: [{ name: 'Sweet or salted', required: true, options: ['Sweet', 'Salted'] }],
  },
  // Chef's Table (secret)
  {
    sku: 'FL-CHF-001',
    name: 'Truffle Mushroom Khichdi',
    description: 'Moong-rice khichdi, wild mushrooms, truffle ghee',
    temp: 'HOT',
    cost: 320,
    station: 'Curry & Dal',
    allergens: ['Milk / Dairy'],
    tags: [...VEG, 'Gluten-free'],
  },
  {
    sku: 'FL-CHF-002',
    name: 'Lamb Rogan Josh Bowl',
    description: 'Kashmiri lamb curry, saffron rice',
    temp: 'HOT',
    cost: 380,
    station: 'Curry & Dal',
    allergens: ['Milk / Dairy'],
    tags: ['High-protein', 'Gluten-free'],
    groups: [RICE],
  },
];

const CATEGORIES: ReadonlyArray<{
  name: string;
  slug: string;
  description: string;
  secret?: boolean;
  skus: string[];
}> = [
  {
    name: 'Bowls',
    slug: 'bowls',
    description: 'Build-your-own rice bowls',
    skus: ['FL-BWL-001', 'FL-BWL-002', 'FL-BWL-003', 'FL-BWL-004', 'FL-BWL-005'],
  },
  {
    name: 'Wraps & Rolls',
    slug: 'wraps-rolls',
    description: 'Handheld lunches and snacks',
    skus: ['FL-WRP-001', 'FL-WRP-002', 'FL-WRP-003', 'FL-SNK-001'],
  },
  {
    name: 'Thalis',
    slug: 'thalis',
    description: 'Complete meals on one plate',
    skus: ['FL-THL-001', 'FL-THL-002', 'FL-THL-003'],
  },
  {
    name: 'Salads',
    slug: 'salads',
    description: 'Cold, fresh and light',
    skus: ['FL-SLD-001', 'FL-SLD-002', 'FL-FRT-001'],
  },
  {
    name: 'Breakfast',
    slug: 'breakfast',
    description: 'For early delivery slots',
    skus: ['FL-BRK-001', 'FL-BRK-002', 'FL-BRK-003', 'FL-BRK-004', 'FL-FRT-001'],
  },
  {
    name: 'Desserts',
    slug: 'desserts',
    description: 'Something sweet',
    skus: ['FL-DST-001', 'FL-DST-002', 'FL-DST-003'],
  },
  {
    name: 'Beverages',
    slug: 'beverages',
    description: 'Hot and cold drinks',
    skus: ['FL-BEV-001', 'FL-BEV-002', 'FL-BEV-003'],
  },
  {
    name: "Chef's Table",
    slug: 'chefs-table',
    description: 'Off-menu specials, opened by link only',
    secret: true,
    skus: ['FL-CHF-001', 'FL-CHF-002'],
  },
];

/** Standard overrides, used exactly as typed (no 5¢ rounding), to show FR-PRC-05. */
const STANDARD_OVERRIDES: Record<string, number> = {
  'FL-BWL-005': 495,
  'FL-BEV-001': 99,
  'FL-DST-001': 129,
};

async function nameMap(
  rows: Promise<Array<{ id: string; name: string }>>,
): Promise<Map<string, string>> {
  return new Map((await rows).map((r) => [r.name, r.id]));
}

function need(map: Map<string, string>, name: string, kind: string): string {
  const id = map.get(name);
  if (!id) throw new Error(`Seed: unknown ${kind} "${name}". Run the reference seed first.`);
  return id;
}

export async function seedCatalogue(prisma: PrismaClient): Promise<void> {
  const select = { select: { id: true, name: true } } as const;
  const [allergens, tags, stations, sizes] = await Promise.all([
    nameMap(prisma.allergen.findMany(select)),
    nameMap(prisma.dietaryTag.findMany(select)),
    nameMap(prisma.kitchenStation.findMany(select)),
    nameMap(prisma.portionSize.findMany(select)),
  ]);
  const allergenRows = (names: string[] = []) =>
    names.map((n) => ({ allergenId: need(allergens, n, 'allergen') }));
  const tagRows = (names: string[] = []) =>
    names.map((n) => ({ dietaryTagId: need(tags, n, 'dietary tag') }));

  // Options
  const optionIds = new Map<string, string>();
  for (const o of OPTIONS) {
    const row = await prisma.option.upsert({
      where: { name: o.name },
      update: {},
      create: {
        name: o.name,
        costPriceCents: o.cost,
        allergens: { create: allergenRows(o.allergens) },
        dietaryTags: { create: tagRows(o.tags) },
        portionPrices: {
          create: Object.entries(o.sizes ?? {}).map(([size, extra]) => ({
            portionSizeId: need(sizes, size, 'portion size'),
            extraChargeCents: extra,
          })),
        },
      },
      select: { id: true },
    });
    optionIds.set(o.name, row.id);
  }

  // Dishes and their option groups
  const dishIds = new Map<string, string>();
  for (const d of DISHES) {
    const dish = await prisma.dish.upsert({
      where: { sku: d.sku },
      update: {},
      create: {
        sku: d.sku,
        name: d.name,
        description: d.description,
        temperature: d.temp,
        costPriceCents: d.cost,
        kitchenStationId: d.station ? need(stations, d.station, 'station') : null,
        minOrderQty: d.minQty ?? null,
        allergens: { create: allergenRows(d.allergens) },
        dietaryTags: { create: tagRows(d.tags) },
      },
      select: { id: true },
    });
    dishIds.set(d.sku, dish.id);

    for (const [sortOrder, g] of (d.groups ?? []).entries()) {
      const group = await prisma.optionGroup.upsert({
        where: { dishId_name: { dishId: dish.id, name: g.name } },
        update: {},
        create: {
          dishId: dish.id,
          name: g.name,
          isRequired: g.required,
          maxSelections: g.max ?? 1,
          sortOrder,
          usesPortions: Boolean(g.portions),
        },
        select: { id: true },
      });
      await prisma.optionGroupItem.createMany({
        data: g.options.map((name, i) => ({
          groupId: group.id,
          optionId: need(optionIds, name, 'option'),
          sortOrder: i,
        })),
        skipDuplicates: true,
      });
      if (g.portions)
        await prisma.optionGroupPortionSize.createMany({
          data: g.portions.map((size, i) => ({
            groupId: group.id,
            portionSizeId: need(sizes, size, 'portion size'),
            sortOrder: i,
          })),
          skipDuplicates: true,
        });
    }
  }

  // Price tiers (Standard is created by the platform seed and is the default)
  const standard = await prisma.priceTier.findUniqueOrThrow({
    where: { name: 'Standard' },
    select: { id: true },
  });
  const tier = (name: string, description: string, data: object, sortOrder: number) =>
    prisma.priceTier.upsert({
      where: { name },
      update: {},
      create: { name, description, sortOrder, ...data },
      select: { id: true },
    });
  const enterprise = await tier(
    'Enterprise',
    'Standard −10 % for large accounts',
    { derivation: 'FROM_TIER', factorBps: 9_000, baseTierId: standard.id },
    1,
  );
  await tier(
    'Partner',
    'Standard +15 % (premium service partners)',
    { derivation: 'FROM_TIER', factorBps: 11_500, baseTierId: standard.id },
    2,
  );
  const startup = await tier(
    'Startup',
    'Hand-set prices; deliberately incomplete',
    { derivation: 'MANUAL', factorBps: null, baseTierId: null },
    3,
  );

  const dishPrice = (tierId: string, sku: string, priceCents: number | null) =>
    prisma.dishTierPrice.upsert({
      where: { tierId_dishId: { tierId, dishId: need(dishIds, sku, 'dish') } },
      update: {},
      create: { tierId, dishId: need(dishIds, sku, 'dish'), priceCents },
    });
  for (const [sku, cents] of Object.entries(STANDARD_OVERRIDES))
    await dishPrice(standard.id, sku, cents);
  // Enterprise accounts don't get the lamb special.
  await dishPrice(enterprise.id, 'FL-CHF-002', null);

  // Startup: about 60 % of dishes priced by hand (cost × 2.2); the rest stay missing → hidden.
  for (const [i, d] of DISHES.entries()) {
    if (i % 5 < 3) await dishPrice(startup.id, d.sku, deriveCents(d.cost, 22_000));
  }
  // Every option except Grilled Chicken, so that choice is not offered on Startup (BR-MEN-03).
  for (const o of OPTIONS) {
    if (o.name === 'Grilled Chicken') continue;
    const optionId = need(optionIds, o.name, 'option');
    await prisma.optionTierPrice.upsert({
      where: { tierId_optionId: { tierId: startup.id, optionId } },
      update: {},
      create: { tierId: startup.id, optionId, priceCents: deriveCents(o.cost, 22_000) },
    });
  }

  // Menu
  for (const [sortOrder, c] of CATEGORIES.entries()) {
    const category = await prisma.menuCategory.upsert({
      where: { slug: c.slug },
      update: {},
      create: {
        name: c.name,
        slug: c.slug,
        description: c.description,
        isSecret: c.secret ?? false,
        sortOrder,
      },
      select: { id: true },
    });
    await prisma.menuItem.createMany({
      data: c.skus.map((sku, i) => ({
        categoryId: category.id,
        dishId: need(dishIds, sku, 'dish'),
        sortOrder: i,
      })),
      skipDuplicates: true,
    });
  }

  console.log(
    `  catalogue: ${OPTIONS.length} options, ${DISHES.length} dishes, 4 tiers, ${CATEGORIES.length} menu categories`,
  );
}
