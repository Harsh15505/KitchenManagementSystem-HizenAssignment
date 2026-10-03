import { z } from 'zod';

export const menuSlug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, digits and dashes, e.g. chefs-table')
  .min(2)
  .max(40);

/** FR-MEN-01/03. No defaults: the update schema is a partial of this shape (see BUG-003). */
const categoryShape = {
  name: z.string().trim().min(2, 'Enter a name').max(60),
  slug: menuSlug,
  description: z.string().trim().max(300),
  isSecret: z.boolean(),
  isActive: z.boolean(),
};

export const menuCategoryInputSchema = z.object(categoryShape);
export type MenuCategoryInput = z.infer<typeof menuCategoryInputSchema>;

export const updateMenuCategorySchema = z
  .object(categoryShape)
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateMenuCategoryInput = z.infer<typeof updateMenuCategorySchema>;

export const addMenuItemSchema = z.object({ dishId: z.uuid() });
export const updateMenuItemSchema = z.object({ isActive: z.boolean() });

export interface MenuItemDto {
  id: string;
  sortOrder: number;
  isActive: boolean;
  dish: { id: string; sku: string; name: string; isActive: boolean };
  /** The dish has no effective price on the default tier, so most employees won't see it. */
  unpricedOnDefaultTier: boolean;
}

export interface MenuCategoryDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  isSecret: boolean;
  hiddenForCompanies: number;
  items: MenuItemDto[];
}

/** "Chef's Table" → "chefs-table" */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}
