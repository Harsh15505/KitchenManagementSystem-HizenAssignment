import { describe, expect, it } from 'vitest';
import {
  dishInputSchema,
  optionInputSchema,
  updateDishSchema,
  updateOptionSchema,
} from './catalogue';

describe('catalogue contracts', () => {
  it('BUG-003 a partial dish update carries only the fields sent', () => {
    expect(updateDishSchema.parse({ isActive: false })).toEqual({ isActive: false });
    expect(updateDishSchema.parse({ name: 'Paneer Bowl' })).toEqual({ name: 'Paneer Bowl' });
  });

  it('BUG-003 a partial option update carries only the fields sent', () => {
    expect(updateOptionSchema.parse({ isActive: false })).toEqual({ isActive: false });
  });

  it('BUG-003 creating still fills the optional fields', () => {
    const dish = dishInputSchema.parse({
      sku: 'fl-bwl-001',
      name: 'Paneer Bowl',
      temperature: 'HOT',
      costPriceCents: 240,
    });
    expect(dish).toMatchObject({
      sku: 'FL-BWL-001',
      description: '',
      imageUrl: null,
      kitchenStationId: null,
      minOrderQty: null,
      allergenIds: [],
      dietaryTagIds: [],
    });
    expect(optionInputSchema.parse({ name: 'Chicken', costPriceCents: 120 })).toMatchObject({
      description: '',
      portionExtras: [],
    });
  });

  it('rejects an empty update', () => {
    expect(updateDishSchema.safeParse({}).success).toBe(false);
  });
});
