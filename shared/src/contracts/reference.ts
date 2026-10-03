import { z } from 'zod';

/** FR-SET-03: admin-managed lists. Entries in use are deactivated, never deleted. */
export const REFERENCE_TYPES = [
  'allergens',
  'dietary-tags',
  'kitchen-stations',
  'portion-sizes',
  'packaging-types',
] as const;

export type ReferenceType = (typeof REFERENCE_TYPES)[number];

export const REFERENCE_LABELS: Record<ReferenceType, { singular: string; plural: string }> = {
  allergens: { singular: 'Allergen', plural: 'Allergens' },
  'dietary-tags': { singular: 'Dietary tag', plural: 'Dietary tags' },
  'kitchen-stations': { singular: 'Kitchen station', plural: 'Kitchen stations' },
  'portion-sizes': { singular: 'Portion size', plural: 'Portion sizes' },
  'packaging-types': { singular: 'Packaging type', plural: 'Packaging types' },
};

export const referenceTypeSchema = z.enum(REFERENCE_TYPES);

export const createReferenceItemSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(60),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  /** Only packaging types keep a description. */
  description: z.string().trim().max(200).optional(),
});

export const updateReferenceItemSchema = createReferenceItemSchema
  .extend({ isActive: z.boolean() })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export type CreateReferenceItemInput = z.infer<typeof createReferenceItemSchema>;
export type UpdateReferenceItemInput = z.infer<typeof updateReferenceItemSchema>;

export interface ReferenceItem {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  description?: string;
}
