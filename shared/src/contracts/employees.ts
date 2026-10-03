import { z } from 'zod';
import { paginationQuerySchema } from './pagination';

const ids = z.array(z.uuid()).max(50);

/** FR-EMP-01. No defaults (the update schema is a partial of this shape). */
const employeeShape = {
  name: z.string().trim().min(2, 'Enter a name').max(80),
  email: z.email('Enter a valid email').trim().toLowerCase(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{6,20}$/, 'Enter a phone number like +91 98765 43210')
    .nullable(),
  canChooseAddress: z.boolean(),
  canChangeDeliveryTime: z.boolean(),
  canChangePackaging: z.boolean(),
  allergenIds: ids,
  dietaryTagIds: ids,
  isActive: z.boolean(),
};

export const createEmployeeSchema = z.object({ ...employeeShape, companyId: z.uuid() });
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = z
  .object(employeeShape)
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

/** FR-EMP-02: moving needs an email on the new company's domains. */
export const moveEmployeeSchema = z.object({
  companyId: z.uuid(),
  email: z.email('Enter a valid email').trim().toLowerCase(),
});
export type MoveEmployeeInput = z.infer<typeof moveEmployeeSchema>;

/** FR-EMP-03: the CSV file's text (read in the browser). */
export const employeeImportSchema = z.object({
  csv: z.string().min(1, 'The file is empty').max(1_000_000, 'The file is larger than 1 MB'),
});
export type EmployeeImportInput = z.infer<typeof employeeImportSchema>;

export interface EmployeeImportResult {
  created: number;
  failed: Array<{ row: number; column: string; message: string }>;
}

export const employeeListQuerySchema = paginationQuerySchema.extend({
  companyId: z.uuid().optional(),
  q: z.string().trim().max(100).optional(),
  active: z.enum(['true', 'false']).optional(),
});
export type EmployeeListQuery = z.infer<typeof employeeListQuerySchema>;

export interface EmployeeDto {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: { id: string; name: string };
  isOwner: boolean;
  canChooseAddress: boolean;
  canChangeDeliveryTime: boolean;
  canChangePackaging: boolean;
  allergenIds: string[];
  dietaryTagIds: string[];
  isActive: boolean;
}
