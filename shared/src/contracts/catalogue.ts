import { z } from 'zod';
import { paginationQuerySchema } from './pagination';

const cents = z.number().int('Use whole cents').min(0).max(10_000_000);
const ids = z.array(z.uuid()).max(50);

export const catalogueListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  active: z.enum(['true', 'false']).optional(),
  stationId: z.uuid().optional(),
});
export type CatalogueListQuery = z.infer<typeof catalogueListQuerySchema>;

/** FR-CAT-01: everything a dish carries. */
export const dishInputSchema = z.object({
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9-]{1,30}$/, 'Use letters, digits and dashes, e.g. FL-BWL-001'),
  name: z.string().trim().min(2, 'Enter a name').max(80),
  description: z.string().trim().max(500).default(''),
  imageUrl: z.url('Enter a full image URL').max(500).nullable().default(null),
  temperature: z.enum(['HOT', 'COLD']),
  costPriceCents: cents,
  kitchenStationId: z.uuid().nullable().default(null),
  minOrderQty: z.number().int().min(1).max(500).nullable().default(null),
  allergenIds: ids.default([]),
  dietaryTagIds: ids.default([]),
});
export type DishInput = z.infer<typeof dishInputSchema>;

export const updateDishSchema = dishInputSchema
  .extend({ isActive: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateDishInput = z.infer<typeof updateDishSchema>;

/** FR-CAT-03 + FR-CAT-05: a reusable option and the sizes it supports. */
export const optionInputSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(60),
  description: z.string().trim().max(200).default(''),
  costPriceCents: cents,
  allergenIds: ids.default([]),
  dietaryTagIds: ids.default([]),
  portionExtras: z
    .array(z.object({ portionSizeId: z.uuid(), extraChargeCents: cents }))
    .max(10)
    .default([])
    .refine(
      (rows) => new Set(rows.map((r) => r.portionSizeId)).size === rows.length,
      'Each size once',
    ),
});
export type OptionInput = z.infer<typeof optionInputSchema>;

export const updateOptionSchema = optionInputSchema
  .extend({ isActive: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateOptionInput = z.infer<typeof updateOptionSchema>;

/** FR-CAT-04: a dish's question, its offered options in order, and (FR-CAT-05) its sizes. */
export const optionGroupInputSchema = z
  .object({
    name: z.string().trim().min(2, 'Name the choice, e.g. Choose your protein').max(60),
    isRequired: z.boolean(),
    maxSelections: z.number().int().min(1).max(10),
    usesPortions: z.boolean().default(false),
    portionSizeIds: ids.default([]),
    optionIds: ids.min(1, 'Add at least one option'),
  })
  .refine((g) => !g.usesPortions || g.portionSizeIds.length > 0, {
    message: 'Choose the sizes this group sells',
    path: ['portionSizeIds'],
  })
  .refine((g) => new Set(g.optionIds).size === g.optionIds.length, {
    message: 'Each option once',
    path: ['optionIds'],
  });
export type OptionGroupInput = z.infer<typeof optionGroupInputSchema>;

export const reorderSchema = z.object({ ids: ids.min(1) });

export interface DishListItem {
  id: string;
  sku: string;
  name: string;
  temperature: 'HOT' | 'COLD';
  costPriceCents: number;
  isActive: boolean;
  station: { id: string; name: string } | null;
  groupCount: number;
  menuPlacements: number;
}

export interface OptionGroupDto {
  id: string;
  name: string;
  isRequired: boolean;
  maxSelections: number;
  sortOrder: number;
  usesPortions: boolean;
  portionSizes: Array<{ id: string; name: string }>;
  options: Array<{ id: string; name: string; isActive: boolean }>;
}

export interface DishDetail extends DishListItem {
  description: string;
  imageUrl: string | null;
  minOrderQty: number | null;
  allergenIds: string[];
  dietaryTagIds: string[];
  groups: OptionGroupDto[];
}

export interface OptionDto {
  id: string;
  name: string;
  description: string;
  costPriceCents: number;
  isActive: boolean;
  allergenIds: string[];
  dietaryTagIds: string[];
  portionExtras: Array<{ portionSizeId: string; extraChargeCents: number }>;
  usedInGroups: number;
}
