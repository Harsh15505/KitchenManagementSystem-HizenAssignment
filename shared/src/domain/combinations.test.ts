import { describe, expect, it } from 'vitest';
import { type CapturedCombination, capturedKey, normaliseOrder, signatureOf } from './combinations';
import type { MenuDishView } from './menu';

const REG = 'size-regular';
const LRG = 'size-large';

/** A bowl as the menu function would present it: priced, with offered options. */
const bowl: MenuDishView = {
  menuItemId: 'mi-bowl',
  dishId: 'bowl',
  name: 'Paneer Tikka Rice Bowl',
  description: '',
  imageUrl: null,
  temperature: 'HOT',
  priceCents: 420,
  minOrderQty: null,
  allergenIds: ['dairy'],
  dietaryTagIds: [],
  allergenConflicts: [],
  dietMatches: [],
  groups: [
    {
      id: 'g-protein',
      name: 'Choose your protein',
      isRequired: true,
      maxSelections: 1,
      usesPortions: false,
      portionSizeIds: [],
      options: [
        {
          optionId: 'paneer',
          name: 'Paneer',
          priceCents: 110,
          allergenIds: ['dairy'],
          allergenConflicts: [],
          sizes: [],
        },
        {
          optionId: 'tofu',
          name: 'Tofu',
          priceCents: 100,
          allergenIds: ['soy'],
          allergenConflicts: ['soy'],
          sizes: [],
        },
      ],
    },
    {
      id: 'g-rice',
      name: 'Choose your rice',
      isRequired: true,
      maxSelections: 1,
      usesPortions: true,
      portionSizeIds: [REG, LRG],
      options: [
        {
          optionId: 'brown',
          name: 'Brown Rice',
          priceCents: 50,
          allergenIds: [],
          allergenConflicts: [],
          sizes: [
            { portionSizeId: REG, extraCents: 0 },
            { portionSizeId: LRG, extraCents: 45 },
          ],
        },
        {
          optionId: 'jeera',
          name: 'Jeera Rice',
          priceCents: 40,
          allergenIds: [],
          allergenConflicts: [],
          sizes: [
            { portionSizeId: REG, extraCents: 0 },
            { portionSizeId: LRG, extraCents: 40 },
          ],
        },
      ],
    },
    {
      id: 'g-sides',
      name: 'Add sides',
      isRequired: false,
      maxSelections: 2,
      usesPortions: false,
      portionSizeIds: [],
      options: [
        {
          optionId: 'raita',
          name: 'Raita',
          priceCents: 30,
          allergenIds: [],
          allergenConflicts: [],
          sizes: [],
        },
        {
          optionId: 'pickle',
          name: 'Mango Pickle',
          priceCents: 15,
          allergenIds: [],
          allergenConflicts: [],
          sizes: [],
        },
        {
          optionId: 'chutney',
          name: 'Mint Chutney',
          priceCents: 15,
          allergenIds: [],
          allergenConflicts: [],
          sizes: [],
        },
      ],
    },
  ],
};
const samosa: MenuDishView = {
  ...bowl,
  dishId: 'samosa',
  menuItemId: 'mi-s',
  name: 'Samosa Snack Box',
  priceCents: 170,
  minOrderQty: 2,
  groups: [],
};
const MENU = new Map([
  ['bowl', bowl],
  ['samosa', samosa],
]);

const protein = (o = 'paneer') => ({ groupId: 'g-protein', optionId: o });
const rice = (o: string, size: string | null = REG) => ({
  groupId: 'g-rice',
  optionId: o,
  portionSizeId: size,
});
const issueCodes = (r: ReturnType<typeof normaliseOrder>) =>
  r.ok ? [] : r.issues.map((i) => i.code);

describe('BR-CMB-01..04: combinations', () => {
  it('BR-CMB-01: the brief example, 10 bowls = 6 brown + 4 jeera, gives 2 prep units', () => {
    const r = normaliseOrder(
      [
        {
          dishId: 'bowl',
          quantity: 10,
          combinations: [
            { quantity: 6, choices: [protein(), rice('brown')] },
            { quantity: 4, choices: [protein(), rice('jeera')] },
          ],
        },
      ],
      MENU,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lines[0]!.combinations).toHaveLength(2);
    expect(r.lines[0]!.combinations.map((c) => c.quantity)).toEqual([6, 4]);
  });

  it('BR-CMB-01: 6 + 3 is not 10', () => {
    const r = normaliseOrder(
      [
        {
          dishId: 'bowl',
          quantity: 10,
          combinations: [
            { quantity: 6, choices: [protein(), rice('brown')] },
            { quantity: 3, choices: [protein(), rice('jeera')] },
          ],
        },
      ],
      MENU,
    );
    expect(issueCodes(r)).toEqual(['QUANTITY_MISMATCH']);
    expect(r.ok ? null : r.issues[0]!.path).toBe('lines.0.quantity');
  });

  it('BR-CMB-01: one line per dish', () => {
    const line = {
      dishId: 'bowl',
      quantity: 1,
      combinations: [{ quantity: 1, choices: [protein(), rice('brown')] }],
    };
    expect(issueCodes(normaliseOrder([line, line], MENU))).toEqual(['COMBINATION_INVALID']);
  });

  it('BR-CMB-02: a required group needs a choice', () => {
    const r = normaliseOrder(
      [{ dishId: 'bowl', quantity: 1, combinations: [{ quantity: 1, choices: [rice('brown')] }] }],
      MENU,
    );
    expect(issueCodes(r)).toEqual(['COMBINATION_INVALID']);
    expect(r.ok ? '' : r.issues[0]!.message).toContain('Choose your protein');
  });

  it('BR-CMB-02: max selections, foreign options and duplicates are refused', () => {
    const tooMany = [
      protein(),
      rice('brown'),
      { groupId: 'g-sides', optionId: 'raita' },
      { groupId: 'g-sides', optionId: 'pickle' },
      { groupId: 'g-sides', optionId: 'chutney' },
    ];
    expect(
      issueCodes(
        normaliseOrder(
          [{ dishId: 'bowl', quantity: 1, combinations: [{ quantity: 1, choices: tooMany }] }],
          MENU,
        ),
      ),
    ).toEqual(['COMBINATION_INVALID']);
    const foreign = [protein(), rice('brown'), { groupId: 'g-sides', optionId: 'paneer' }];
    expect(
      issueCodes(
        normaliseOrder(
          [{ dishId: 'bowl', quantity: 1, combinations: [{ quantity: 1, choices: foreign }] }],
          MENU,
        ),
      ),
    ).toEqual(['COMBINATION_INVALID']);
    const twice = [
      protein(),
      rice('brown'),
      { groupId: 'g-sides', optionId: 'raita' },
      { groupId: 'g-sides', optionId: 'raita' },
    ];
    expect(
      issueCodes(
        normaliseOrder(
          [{ dishId: 'bowl', quantity: 1, combinations: [{ quantity: 1, choices: twice }] }],
          MENU,
        ),
      ),
    ).toEqual(['COMBINATION_INVALID']);
  });

  it('BR-CMB-03: a portioned group needs a size, a plain group refuses one', () => {
    expect(
      issueCodes(
        normaliseOrder(
          [
            {
              dishId: 'bowl',
              quantity: 1,
              combinations: [{ quantity: 1, choices: [protein(), rice('brown', null)] }],
            },
          ],
          MENU,
        ),
      ),
    ).toEqual(['PORTION_SIZE_UNSUPPORTED']);
    const sizedProtein = { ...protein(), portionSizeId: REG };
    expect(
      issueCodes(
        normaliseOrder(
          [
            {
              dishId: 'bowl',
              quantity: 1,
              combinations: [{ quantity: 1, choices: [sizedProtein, rice('brown')] }],
            },
          ],
          MENU,
        ),
      ),
    ).toEqual(['PORTION_SIZE_UNSUPPORTED']);
  });

  it('BR-CMB-04: identical combinations merge (3 + 3 → one unit of 6)', () => {
    const r = normaliseOrder(
      [
        {
          dishId: 'bowl',
          quantity: 6,
          combinations: [
            { quantity: 3, choices: [protein(), rice('brown')] },
            { quantity: 3, choices: [rice('brown'), protein()] },
          ],
        },
      ],
      MENU,
    );
    expect(r.ok && r.lines[0]!.combinations.map((c) => c.quantity)).toEqual([6]);
  });

  it('BR-CMB-04: the signature ignores input order', () => {
    expect(signatureOf([protein(), rice('brown')])).toBe(signatureOf([rice('brown'), protein()]));
    expect(signatureOf([rice('brown', REG)])).not.toBe(signatureOf([rice('brown', LRG)]));
  });

  it('BR-CMB-05: minimum order quantity', () => {
    const r = normaliseOrder(
      [{ dishId: 'samosa', quantity: 1, combinations: [{ quantity: 1, choices: [] }] }],
      MENU,
    );
    expect(issueCodes(r)).toEqual(['MIN_QTY_NOT_MET']);
  });

  it('a dish not on the employee menu is refused', () => {
    const r = normaliseOrder(
      [{ dishId: 'lamb', quantity: 1, combinations: [{ quantity: 1, choices: [] }] }],
      MENU,
    );
    expect(issueCodes(r)).toEqual(['DISH_NOT_AVAILABLE']);
  });
});

describe('BR-MNY-02: prices', () => {
  it('BR-MNY-02: unit = dish + options + size extras; total = unit × qty; order = Σ lines', () => {
    const r = normaliseOrder(
      [
        {
          dishId: 'bowl',
          quantity: 3,
          combinations: [
            {
              quantity: 2,
              choices: [
                protein('tofu'),
                rice('brown', LRG),
                { groupId: 'g-sides', optionId: 'raita' },
              ],
            },
            { quantity: 1, choices: [protein(), rice('jeera')] },
          ],
        },
        { dishId: 'samosa', quantity: 2, combinations: [{ quantity: 2, choices: [] }] },
      ],
      MENU,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [big, small] = r.lines[0]!.combinations;
    expect(big!.unitPriceCents).toBe(420 + 100 + 50 + 45 + 30); // 645
    expect(big!.totalCents).toBe(1290);
    expect(small!.unitPriceCents).toBe(420 + 110 + 40); // 570
    expect(r.lines[0]!.totalCents).toBe(1860);
    expect(r.lines[1]!.totalCents).toBe(340);
    expect(r.totalCents).toBe(2200);
  });

  it('warns about allergen conflicts on chosen options', () => {
    const r = normaliseOrder(
      [
        {
          dishId: 'bowl',
          quantity: 1,
          combinations: [{ quantity: 1, choices: [protein('tofu'), rice('brown')] }],
        },
      ],
      MENU,
    );
    expect(r.ok && r.warnings).toEqual([
      { path: 'lines.0', dishName: 'Paneer Tikka Rice Bowl', allergenIds: ['soy'] },
    ]);
  });
});

describe('BR-PRC-07: price capture on edit', () => {
  const choices = [protein(), rice('brown')];
  const signature = signatureOf(choices);
  const kept: CapturedCombination = {
    dishName: 'Paneer Tikka Rice Bowl',
    dishSku: 'FL-BWL-001',
    dishPriceCents: 400,
    unitPriceCents: 555,
    choices: [],
  };
  const captured = new Map([[capturedKey('bowl', signature), kept]]);

  it('BR-PRC-07: an unchanged combination keeps its captured price; a new one uses today’s', () => {
    const r = normaliseOrder(
      [
        {
          dishId: 'bowl',
          quantity: 3,
          combinations: [
            { quantity: 2, choices },
            { quantity: 1, choices: [protein(), rice('jeera')] },
          ],
        },
      ],
      MENU,
      captured,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [old, fresh] = r.lines[0]!.combinations;
    expect([old!.unitPriceCents, old!.captured]).toEqual([555, true]);
    expect([fresh!.unitPriceCents, fresh!.captured]).toEqual([570, false]);
  });

  it('BR-PRC-07: a captured combination survives the dish leaving the menu; new ones do not', () => {
    const empty = new Map<string, MenuDishView>();
    const keptOnly = normaliseOrder(
      [{ dishId: 'bowl', quantity: 2, combinations: [{ quantity: 2, choices }] }],
      empty,
      captured,
    );
    expect(keptOnly.ok && keptOnly.lines[0]!.totalCents).toBe(1110);
    const withNew = normaliseOrder(
      [
        {
          dishId: 'bowl',
          quantity: 3,
          combinations: [
            { quantity: 2, choices },
            { quantity: 1, choices: [protein(), rice('jeera')] },
          ],
        },
      ],
      empty,
      captured,
    );
    expect(issueCodes(withNew)).toEqual(['DISH_NOT_AVAILABLE']);
  });
});
