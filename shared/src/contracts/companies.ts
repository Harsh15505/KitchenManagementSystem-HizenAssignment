import { z } from 'zod';
import { paginationQuerySchema } from './pagination';
import { calendarDateString, domainName } from './settings';

const minutesOfDay = z.number().int().min(0).max(1439);
const optionalText = (max: number) => z.string().trim().max(max);
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{6,20}$/, 'Enter a phone number like +91 98765 43210');

export const workingDaysSchema = z
  .array(z.number().int().min(1).max(7))
  .min(1, 'Choose at least one working day')
  .refine((days) => new Set(days).size === days.length, 'Each weekday once');

/** FR-CMP-01: a delivery address. No defaults (updates are partials of this shape). */
const addressShape = {
  label: z.string().trim().min(2, 'Name the address, e.g. HQ reception').max(60),
  line1: z.string().trim().min(3, 'Enter the street address').max(120),
  line2: optionalText(120),
  city: z.string().trim().min(2, 'Enter the city').max(60),
  postalCode: z.string().trim().min(3, 'Enter the postal code').max(12),
  accessNotes: optionalText(300),
};
export const addressInputSchema = z.object(addressShape);
export type AddressInput = z.infer<typeof addressInputSchema>;
export const updateAddressSchema = z
  .object({ ...addressShape, isActive: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;

/** FR-CMP-01/03/04: everything editable on a company after it exists. */
const companyShape = {
  name: z.string().trim().min(2, 'Enter the company name').max(80),
  priceTierId: z.uuid().nullable(),
  billingContactName: z.string().trim().min(2, 'Enter the billing contact').max(80),
  billingEmail: z.email('Enter a valid email').trim().toLowerCase(),
  billingPhone: phone.nullable(),
  billingAddress: optionalText(300),
  workingDays: workingDaysSchema,
  defaultDeliveryTimeMinutes: minutesOfDay,
  dispatchLeadMinutes: z.number().int().min(0).max(600),
  defaultPackagingTypeId: z.uuid('Choose a packaging type'),
  driverInstructions: optionalText(500),
  defaultDriverId: z.uuid().nullable(),
  isActive: z.boolean(),
};
export const updateCompanySchema = z
  .object(companyShape)
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

/** A-29: the company, its owner, its first domain and its first (default) address, in one go. */
export const createCompanySchema = z.object({
  ...companyShape,
  isActive: z.boolean().optional(),
  domain: domainName,
  address: addressInputSchema,
  owner: z.object({
    name: z.string().trim().min(2, 'Enter the owner name').max(80),
    email: z.email('Enter a valid email').trim().toLowerCase(),
    phone: phone.nullable(),
  }),
});
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

export const companyListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  active: z.enum(['true', 'false']).optional(),
});
export type CompanyListQuery = z.infer<typeof companyListQuerySchema>;

export const companyDomainSchema = z.object({ domain: domainName });
export const companyHolidaySchema = z.object({
  date: calendarDateString,
  name: z.string().trim().min(2, 'Name the holiday').max(80),
});
export type CompanyHolidayInput = z.infer<typeof companyHolidaySchema>;

/** FR-CMP-04: what the company's employees can't see. */
export const menuVisibilitySchema = z.object({
  hiddenCategoryIds: z.array(z.uuid()).max(200),
  hiddenMenuItemIds: z.array(z.uuid()).max(2000),
});
export type MenuVisibilityInput = z.infer<typeof menuVisibilitySchema>;

export interface CompanyListItem {
  id: string;
  name: string;
  isActive: boolean;
  domains: string[];
  priceTier: { id: string; name: string } | null;
  workingDays: number[];
  employeeCount: number;
  owner: { id: string; name: string } | null;
}

export interface CompanyAddressDto {
  id: string;
  label: string;
  line1: string;
  line2: string;
  city: string;
  postalCode: string;
  accessNotes: string;
  isActive: boolean;
  isDefault: boolean;
}

export interface CompanyDetail {
  id: string;
  name: string;
  isActive: boolean;
  priceTier: { id: string; name: string } | null;
  /** The tier employees actually get (the default when none is set, BR-PRC-01). */
  effectiveTier: { id: string; name: string };
  billingContactName: string;
  billingEmail: string;
  billingPhone: string | null;
  billingAddress: string;
  workingDays: number[];
  defaultDeliveryTimeMinutes: number;
  dispatchLeadMinutes: number;
  defaultPackagingType: { id: string; name: string };
  driverInstructions: string;
  defaultDriver: { id: string; name: string } | null;
  owner: { id: string; name: string; email: string } | null;
  domains: Array<{ id: string; domain: string }>;
  addresses: CompanyAddressDto[];
  holidays: Array<{ id: string; date: string; name: string }>;
  hiddenCategoryIds: string[];
  hiddenMenuItemIds: string[];
  employeeCount: number;
}

/** BR-CMP-03: staff who can be a company's default driver. */
export interface DriverOption {
  id: string;
  name: string;
  email: string;
}
