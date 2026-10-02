import { describe, expect, it } from 'vitest';
import {
  addDays,
  calendarDate,
  compareDates,
  fromDbDate,
  hhmmToMinutes,
  isCalendarDate,
  isoWeekday,
  KITCHEN_TIMEZONE,
  minutesToHHmm,
  toDbDate,
  toInstant,
  toLocalDate,
} from './time';

// CI runs this file under TZ=UTC, America/Los_Angeles and Asia/Kolkata. Every expectation
// below must hold in all three, which is the point: the host time zone must not matter.
const d = calendarDate;

describe('calendar dates', () => {
  it('validates real dates only', () => {
    expect(isCalendarDate('2026-10-05')).toBe(true);
    expect(isCalendarDate('2026-02-29')).toBe(false); // 2026 is not a leap year
    expect(isCalendarDate('2026-13-01')).toBe(false);
    expect(isCalendarDate('5/10/2026')).toBe(false);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays(d('2026-10-31'), 1)).toBe('2026-11-01');
    expect(addDays(d('2026-12-31'), 1)).toBe('2027-01-01');
    expect(addDays(d('2026-10-05'), -5)).toBe('2026-09-30');
  });

  it('computes ISO weekdays (1 = Monday … 7 = Sunday)', () => {
    expect(isoWeekday(d('2026-10-03'))).toBe(6); // Saturday
    expect(isoWeekday(d('2026-10-04'))).toBe(7); // Sunday
    expect(isoWeekday(d('2026-10-05'))).toBe(1); // Monday
  });

  it('compares dates', () => {
    expect(compareDates(d('2026-10-05'), d('2026-10-06'))).toBeLessThan(0);
    expect(compareDates(d('2026-10-06'), d('2026-10-06'))).toBe(0);
  });
});

describe('NFR-02: kitchen time (Asia/Kolkata) independent of the host time zone', () => {
  it('16:00 IST on 5 Oct is 10:30 UTC', () => {
    expect(toInstant(d('2026-10-05'), 960, KITCHEN_TIMEZONE).toISOString()).toBe(
      '2026-10-05T10:30:00.000Z',
    );
  });

  it('00:15 IST belongs to the IST date even though it is the previous day in UTC', () => {
    const instant = new Date('2026-10-04T18:45:00.000Z'); // 00:15 IST on 5 Oct
    expect(toLocalDate(instant, KITCHEN_TIMEZONE)).toBe('2026-10-05');
    expect(toLocalDate(instant, 'UTC')).toBe('2026-10-04');
  });

  it('round-trips a delivery time through an instant', () => {
    const instant = toInstant(d('2026-10-07'), hhmmToMinutes('12:30'), KITCHEN_TIMEZONE);
    expect(toLocalDate(instant, KITCHEN_TIMEZONE)).toBe('2026-10-07');
  });

  it('handles DST zones correctly too (the zone is a setting, ADR-006)', () => {
    // 2026-03-08 is the US spring-forward day: 09:00 New York is EDT (UTC-4).
    expect(toInstant(d('2026-03-08'), 540, 'America/New_York').toISOString()).toBe(
      '2026-03-08T13:00:00.000Z',
    );
    expect(toInstant(d('2026-03-07'), 540, 'America/New_York').toISOString()).toBe(
      '2026-03-07T14:00:00.000Z',
    );
  });
});

describe('times of day and DB dates', () => {
  it('converts HH:mm and minutes', () => {
    expect(hhmmToMinutes('12:30')).toBe(750);
    expect(minutesToHHmm(960)).toBe('16:00');
    expect(minutesToHHmm(0)).toBe('00:00');
    expect(() => hhmmToMinutes('24:00')).toThrow(RangeError);
    expect(() => minutesToHHmm(1440)).toThrow(RangeError);
  });

  it('maps Prisma @db.Date values at UTC midnight both ways', () => {
    const db = toDbDate(d('2026-10-05'));
    expect(db.toISOString()).toBe('2026-10-05T00:00:00.000Z');
    expect(fromDbDate(db)).toBe('2026-10-05');
  });
});
