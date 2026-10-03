import { z } from 'zod';
import { paginationQuerySchema } from './pagination';

const password = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(200)
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/\d/, 'Include at least one number');

export const staffListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  active: z.enum(['true', 'false']).optional(),
});

export const createStaffSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name').max(100),
  email: z.email('Enter a valid email address').trim().toLowerCase(),
  phone: z.string().trim().max(30).optional(),
  roleId: z.uuid('Choose a role'),
  password,
});

export const updateStaffSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    phone: z.string().trim().max(30).nullable(),
    roleId: z.uuid(),
    isActive: z.boolean(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export const resetPasswordSchema = z.object({ password });

export type StaffListQuery = z.infer<typeof staffListQuerySchema>;
export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export interface RoleSummary {
  id: string;
  key: string;
  name: string;
  description: string;
  permissions: string[];
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  role: { id: string; key: string; name: string };
}
