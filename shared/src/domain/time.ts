import { TZDate } from '@date-fns/tz';

/**
 * Time model (ADR-006):
 * - A business date (delivery date, holiday) is a kitchen-local calendar date: 'YYYY-MM-DD'.
 * - A moment in time (cut-off, delivery, "started at") is a Date instant (UTC on the wire).
 * - A time of day is minutes after local midnight (750 = 12:30).
 * Nothing here reads the process or browser time zone; the zone is always passed in.
 */

declare const calendarDateBrand: unique symbol;
export type CalendarDate = string & { readonly [calendarDateBrand]: true };

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const KITCHEN_TIMEZONE = 'Asia/Kolkata';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isCalendarDate(value: string): value is CalendarDate {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const utc = new Date(Date.UTC(y, mo - 1, d));
  return utc.getUTCFullYear() === y && utc.getUTCMonth() === mo - 1 && utc.getUTCDate() === d;
}

export function calendarDate(value: string): CalendarDate {
  if (!isCalendarDate(value)) throw new RangeError(`Not a valid calendar date: "${value}"`);
  return value;
}

function parts(date: CalendarDate): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return [y, m, d];
}

function fromUtcDate(utc: Date): CalendarDate {
  return utc.toISOString().slice(0, 10) as CalendarDate;
}

/** Pure calendar arithmetic (no time zones, no DST). */
export function addDays(date: CalendarDate, days: number): CalendarDate {
  const [y, m, d] = parts(date);
  return fromUtcDate(new Date(Date.UTC(y, m - 1, d + days)));
}

export function isoWeekday(date: CalendarDate): IsoWeekday {
  const [y, m, d] = parts(date);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return (day === 0 ? 7 : day) as IsoWeekday;
}

/** Negative if a < b, 0 if equal, positive if a > b ('YYYY-MM-DD' sorts lexically). */
export function compareDates(a: CalendarDate, b: CalendarDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The instant at which `date` reaches `minutes` past local midnight in `timeZone`. */
export function toInstant(date: CalendarDate, minutes: number, timeZone: string): Date {
  assertMinutesOfDay(minutes);
  const [y, m, d] = parts(date);
  return new Date(
    new TZDate(y, m - 1, d, Math.floor(minutes / 60), minutes % 60, 0, timeZone).getTime(),
  );
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();
function dateFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

/** The local calendar date of an instant in `timeZone` ("today" = toLocalDate(now, kitchenTz)). */
export function toLocalDate(instant: Date, timeZone: string): CalendarDate {
  const p = Object.fromEntries(
    dateFormatter(timeZone)
      .formatToParts(instant)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}` as CalendarDate;
}

export function assertMinutesOfDay(minutes: number): void {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1439) {
    throw new RangeError(`Minutes of day must be an integer 0..1439, got ${minutes}`);
  }
}

/** 750 → "12:30" */
export function minutesToHHmm(minutes: number): string {
  assertMinutesOfDay(minutes);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** "12:30" → 750 */
export function hhmmToMinutes(value: string): number {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!m) throw new RangeError(`Not a valid HH:mm time: "${value}"`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Prisma `@db.Date` columns are JS Dates at UTC midnight. Only cross that boundary here. */
export function toDbDate(date: CalendarDate): Date {
  const [y, m, d] = parts(date);
  return new Date(Date.UTC(y, m - 1, d));
}

export function fromDbDate(value: Date): CalendarDate {
  return fromUtcDate(value);
}
