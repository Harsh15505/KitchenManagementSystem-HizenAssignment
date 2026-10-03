import { z } from 'zod';
import { isCalendarDate } from '../domain/time';

const minutesOfDay = z.number().int().min(0).max(1439);
const nonNegativeMinutes = z
  .number()
  .int()
  .min(0)
  .max(24 * 60);

/** FR-SET-01/02: every platform value staff can change without touching code or the DB. */
export const updateSettingsSchema = z
  .object({
    kitchenWorkingDays: z
      .array(z.number().int().min(1).max(7))
      .min(1, 'The kitchen needs at least one working day')
      .refine((days) => new Set(days).size === days.length, 'Each weekday once'),
    cutoffTimeMinutes: minutesOfDay,
    cutoffWorkingDays: z.number().int().min(0).max(14),
    kitchenBufferMinutes: nonNegativeMinutes,
    atRiskWindowMinutes: nonNegativeMinutes,
    onTimeGraceMinutes: nonNegativeMinutes,
    deliveryWindowStartMin: minutesOfDay,
    deliveryWindowEndMin: minutesOfDay,
    deliverySlotMinutes: z.number().int().min(5).max(120),
    defaultDispatchLeadMin: nonNegativeMinutes,
    autoCutoffEnabled: z.boolean(),
    demoAutopilotEnabled: z.boolean(),
  })
  .partial()
  .refine(
    (s) =>
      s.deliveryWindowStartMin === undefined ||
      s.deliveryWindowEndMin === undefined ||
      s.deliveryWindowStartMin < s.deliveryWindowEndMin,
    { message: 'The delivery window must start before it ends', path: ['deliveryWindowEndMin'] },
  );

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export interface PlatformSettingsDto {
  kitchenTimezone: string;
  kitchenWorkingDays: number[];
  cutoffTimeMinutes: number;
  cutoffWorkingDays: number;
  kitchenBufferMinutes: number;
  atRiskWindowMinutes: number;
  onTimeGraceMinutes: number;
  deliveryWindowStartMin: number;
  deliveryWindowEndMin: number;
  deliverySlotMinutes: number;
  defaultDispatchLeadMin: number;
  autoCutoffEnabled: boolean;
  demoAutopilotEnabled: boolean;
  defaultPriceTier: { id: string; name: string };
  updatedAt: string;
}

export const calendarDateString = z
  .string()
  .refine(isCalendarDate, 'Use a real date in YYYY-MM-DD format');

export const createKitchenHolidaySchema = z.object({
  date: calendarDateString,
  name: z.string().trim().min(2, 'Name the holiday').max(80),
});
export type CreateKitchenHolidayInput = z.infer<typeof createKitchenHolidaySchema>;

export interface KitchenHolidayDto {
  id: string;
  date: string;
  name: string;
}

/** Lower-case host name such as gmail.com (BR-CMP-01). */
export const domainName = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/,
    'Enter a domain like gmail.com',
  );

export const publicDomainSchema = z.object({ domain: domainName });
export type PublicDomainInput = z.infer<typeof publicDomainSchema>;
