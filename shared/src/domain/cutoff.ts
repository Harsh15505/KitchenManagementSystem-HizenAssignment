import {
  addDays,
  type CalendarDate,
  compareDates,
  isoWeekday,
  toInstant,
  toLocalDate,
} from './time';

/**
 * Cut-off and deliverability (BR-CAL-01, BR-CUT-01..03, TRD §8.1). Pure: callers pass the
 * calendars and settings they loaded, and the clock's `now`.
 */

export interface KitchenCalendar {
  /** ISO weekdays the kitchen cooks (1 = Monday). */
  workingDays: ReadonlySet<number>;
  holidays: ReadonlySet<string>;
}

export interface CompanyCalendar {
  workingDays: ReadonlySet<number>;
  holidays: ReadonlySet<string>;
}

export interface CutoffSettings {
  /** N: kitchen working days strictly before delivery (0 = the delivery day itself). */
  cutoffWorkingDays: number;
  /** Minutes after midnight in the kitchen time zone. */
  cutoffTimeMinutes: number;
  timeZone: string;
}

export class CalendarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalendarError';
  }
}

export function isKitchenWorkingDay(date: CalendarDate, cal: KitchenCalendar): boolean {
  return cal.workingDays.has(isoWeekday(date)) && !cal.holidays.has(date);
}

/** BR-CUT-01: the Nth kitchen working day strictly before `delivery` (or `delivery` if N = 0). */
export function cutoffDate(delivery: CalendarDate, n: number, cal: KitchenCalendar): CalendarDate {
  let date = delivery;
  let counted = 0;
  let guard = 0;
  while (counted < n) {
    date = addDays(date, -1);
    if (isKitchenWorkingDay(date, cal)) counted++;
    if (++guard > 366) throw new CalendarError('No kitchen working day found within a year.');
  }
  return date;
}

/** BR-CUT-01/02: the instant ordering for `delivery` closes. The company calendar plays no part. */
export function cutoffAt(delivery: CalendarDate, s: CutoffSettings, cal: KitchenCalendar): Date {
  return toInstant(cutoffDate(delivery, s.cutoffWorkingDays, cal), s.cutoffTimeMinutes, s.timeZone);
}

/** BR-CUT-03: locked from the cut-off instant on, whether or not processing has run. */
export function isLocked(
  delivery: CalendarDate,
  now: Date,
  s: CutoffSettings,
  cal: KitchenCalendar,
): boolean {
  return now.getTime() >= cutoffAt(delivery, s, cal).getTime();
}

export type UndeliverableReason =
  | 'PAST'
  | 'COMPANY_NON_WORKING_DAY'
  | 'COMPANY_HOLIDAY'
  | 'KITCHEN_NON_WORKING_DAY'
  | 'KITCHEN_HOLIDAY';

/** BR-CAL-01: both calendars, and not in the past (kitchen time zone). Null = deliverable. */
export function undeliverableReason(
  date: CalendarDate,
  today: CalendarDate,
  kitchen: KitchenCalendar,
  company: CompanyCalendar,
): UndeliverableReason | null {
  if (compareDates(date, today) < 0) return 'PAST';
  const weekday = isoWeekday(date);
  if (!company.workingDays.has(weekday)) return 'COMPANY_NON_WORKING_DAY';
  if (company.holidays.has(date)) return 'COMPANY_HOLIDAY';
  if (!kitchen.workingDays.has(weekday)) return 'KITCHEN_NON_WORKING_DAY';
  if (kitchen.holidays.has(date)) return 'KITCHEN_HOLIDAY';
  return null;
}

export const UNDELIVERABLE_MESSAGE: Record<UndeliverableReason, string> = {
  PAST: 'That date is in the past.',
  COMPANY_NON_WORKING_DAY: "The company doesn't take deliveries on that weekday.",
  COMPANY_HOLIDAY: 'That date is a company holiday.',
  KITCHEN_NON_WORKING_DAY: "The kitchen doesn't cook on that weekday.",
  KITCHEN_HOLIDAY: 'That date is a kitchen holiday.',
};

export interface DeliveryDateOption {
  date: CalendarDate;
  cutoffAt: Date;
  locked: boolean;
}

/** The next `days` calendar days that are deliverable, each with its cut-off (TRD /orders/context). */
export function deliverableDates(
  now: Date,
  days: number,
  s: CutoffSettings,
  kitchen: KitchenCalendar,
  company: CompanyCalendar,
): DeliveryDateOption[] {
  const today = toLocalDate(now, s.timeZone);
  const result: DeliveryDateOption[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    if (undeliverableReason(date, today, kitchen, company)) continue;
    const at = cutoffAt(date, s, kitchen);
    result.push({ date, cutoffAt: at, locked: now.getTime() >= at.getTime() });
  }
  return result;
}

/** BR-PLN-01/02 (TRD §8.5): when the order must leave the kitchen, and be cooked by. */
export function planTimes(
  deliveryAt: Date,
  dispatchLeadMinutes: number,
  kitchenBufferMinutes: number,
) {
  const plannedDispatchReadyAt = new Date(deliveryAt.getTime() - dispatchLeadMinutes * 60_000);
  return {
    plannedDispatchReadyAt,
    plannedKitchenReadyAt: new Date(
      plannedDispatchReadyAt.getTime() - kitchenBufferMinutes * 60_000,
    ),
  };
}

export type Timeliness = 'DONE' | 'LATE' | 'AT_RISK' | 'ON_TRACK';

/** BR-PLN-04: late after the plan; at risk inside the window before it. */
export function timeliness(
  planned: Date,
  doneAt: Date | null,
  now: Date,
  windowMinutes: number,
): Timeliness {
  if (doneAt) return 'DONE';
  if (now.getTime() > planned.getTime()) return 'LATE';
  return now.getTime() >= planned.getTime() - windowMinutes * 60_000 ? 'AT_RISK' : 'ON_TRACK';
}

/** BR-ORD-04: a chosen time must sit inside the delivery window on a slot boundary. */
export function isValidDeliveryTime(
  minutes: number,
  windowStart: number,
  windowEnd: number,
  slot: number,
): boolean {
  return (
    Number.isInteger(minutes) &&
    minutes >= windowStart &&
    minutes <= windowEnd &&
    (minutes - windowStart) % slot === 0
  );
}
