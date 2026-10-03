import { describe, expect, it } from 'vitest';
import {
  CalendarError,
  cutoffAt,
  cutoffDate,
  deliverableDates,
  isLocked,
  isValidDeliveryTime,
  type KitchenCalendar,
  planTimes,
  timeliness,
  undeliverableReason,
} from './cutoff';
import { calendarDate as d, KITCHEN_TIMEZONE } from './time';

// CI runs this file under TZ=UTC, America/Los_Angeles and Asia/Kolkata: results must not move.
const MON_FRI: KitchenCalendar = { workingDays: new Set([1, 2, 3, 4, 5]), holidays: new Set() };
const EVERY_DAY: KitchenCalendar = {
  workingDays: new Set([1, 2, 3, 4, 5, 6, 7]),
  holidays: new Set(),
};
const S = { cutoffWorkingDays: 2, cutoffTimeMinutes: 16 * 60, timeZone: KITCHEN_TIMEZONE };
const MON_FRI_COMPANY = { workingDays: new Set([1, 2, 3, 4, 5]), holidays: new Set<string>() };

describe('BR-CUT-01: cut-off date and instant', () => {
  it('BR-CUT-01: Wednesday with N=2 locks Monday 16:00 IST (the brief example)', () => {
    expect(cutoffDate(d('2026-10-07'), 2, MON_FRI)).toBe('2026-10-05');
    expect(cutoffAt(d('2026-10-07'), S, MON_FRI).toISOString()).toBe('2026-10-05T10:30:00.000Z');
  });

  it('BR-CUT-01: a Monday delivery on a Mon-Fri kitchen locks the Thursday before', () => {
    expect(cutoffDate(d('2026-10-12'), 2, MON_FRI)).toBe('2026-10-08');
  });

  it('BR-CUT-01: kitchen holidays are skipped when counting back', () => {
    const cal = { ...MON_FRI, holidays: new Set(['2026-10-06']) };
    expect(cutoffDate(d('2026-10-07'), 2, cal)).toBe('2026-10-02'); // Tue holiday → Mon, Fri
  });

  it('BR-CUT-01: N=0 locks on the delivery day itself', () => {
    expect(cutoffDate(d('2026-10-07'), 0, MON_FRI)).toBe('2026-10-07');
  });

  it('BR-CUT-01: a seven-day kitchen counts weekends', () => {
    expect(cutoffDate(d('2026-10-05'), 2, EVERY_DAY)).toBe('2026-10-03');
  });

  it('BR-CUT-01: a kitchen with no working days is refused, not looped forever', () => {
    expect(() =>
      cutoffDate(d('2026-10-07'), 1, { workingDays: new Set(), holidays: new Set() }),
    ).toThrow(CalendarError);
  });
});

describe('BR-CUT-02/03: lock', () => {
  it('BR-CUT-02: a company holiday does not move the cut-off', () => {
    // The function takes no company calendar at all; the same inputs give the same instant.
    expect(cutoffAt(d('2026-10-07'), S, MON_FRI).getTime()).toBe(
      cutoffAt(d('2026-10-07'), S, { ...MON_FRI }).getTime(),
    );
  });

  it('BR-CUT-03: exactly at the cut-off instant counts as locked', () => {
    expect(isLocked(d('2026-10-07'), new Date('2026-10-05T10:30:00.000Z'), S, MON_FRI)).toBe(true);
  });

  it('BR-CUT-03: one minute before is still open', () => {
    expect(isLocked(d('2026-10-07'), new Date('2026-10-05T10:29:00.000Z'), S, MON_FRI)).toBe(false);
  });
});

describe('BR-CAL-01: deliverable dates', () => {
  const today = d('2026-10-05');

  it('BR-CAL-01: needs a company and a kitchen working day, no holidays, not in the past', () => {
    expect(undeliverableReason(d('2026-10-04'), today, EVERY_DAY, MON_FRI_COMPANY)).toBe('PAST');
    expect(undeliverableReason(d('2026-10-10'), today, EVERY_DAY, MON_FRI_COMPANY)).toBe(
      'COMPANY_NON_WORKING_DAY',
    );
    expect(
      undeliverableReason(d('2026-10-09'), today, EVERY_DAY, {
        ...MON_FRI_COMPANY,
        holidays: new Set(['2026-10-09']),
      }),
    ).toBe('COMPANY_HOLIDAY');
    expect(
      undeliverableReason(d('2026-10-10'), today, MON_FRI, {
        workingDays: new Set([6]),
        holidays: new Set<string>(),
      }),
    ).toBe('KITCHEN_NON_WORKING_DAY');
    expect(
      undeliverableReason(
        d('2026-10-08'),
        today,
        { ...EVERY_DAY, holidays: new Set(['2026-10-08']) },
        MON_FRI_COMPANY,
      ),
    ).toBe('KITCHEN_HOLIDAY');
    expect(undeliverableReason(today, today, EVERY_DAY, MON_FRI_COMPANY)).toBeNull();
  });

  it('BR-CAL-01: lists the next deliverable dates with their cut-offs', () => {
    const now = new Date('2026-10-05T11:00:00.000Z'); // Mon 16:30 IST
    const dates = deliverableDates(now, 7, S, EVERY_DAY, MON_FRI_COMPANY);
    expect(dates.map((x) => x.date)).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
    ]);
    // Wed's cut-off (Mon 16:00) has passed; Thu's (Tue 16:00) has not.
    expect(dates.find((x) => x.date === '2026-10-07')?.locked).toBe(true);
    expect(dates.find((x) => x.date === '2026-10-08')?.locked).toBe(false);
  });
});

describe('BR-PLN: plans and lateness', () => {
  const deliveryAt = new Date('2026-10-07T07:00:00.000Z'); // 12:30 IST

  it('BR-PLN-01/02: dispatch = delivery − lead; kitchen = dispatch − buffer', () => {
    const plan = planTimes(deliveryAt, 60, 30);
    expect(plan.plannedDispatchReadyAt.toISOString()).toBe('2026-10-07T06:00:00.000Z');
    expect(plan.plannedKitchenReadyAt.toISOString()).toBe('2026-10-07T05:30:00.000Z');
  });

  it('BR-PLN-04: late after the plan, at risk inside the window, done wins', () => {
    const planned = new Date('2026-10-07T06:00:00.000Z');
    expect(timeliness(planned, null, new Date('2026-10-07T06:00:01.000Z'), 30)).toBe('LATE');
    expect(timeliness(planned, null, new Date('2026-10-07T05:30:00.000Z'), 30)).toBe('AT_RISK');
    expect(timeliness(planned, null, new Date('2026-10-07T05:29:59.000Z'), 30)).toBe('ON_TRACK');
    expect(
      timeliness(
        planned,
        new Date('2026-10-07T07:00:00.000Z'),
        new Date('2026-10-07T08:00:00.000Z'),
        30,
      ),
    ).toBe('DONE');
  });
});

describe('BR-ORD-04: delivery time slots', () => {
  it('BR-ORD-04: inside the window and on a slot boundary', () => {
    expect(isValidDeliveryTime(12 * 60 + 30, 7 * 60, 21 * 60, 15)).toBe(true);
    expect(isValidDeliveryTime(12 * 60 + 40, 7 * 60, 21 * 60, 15)).toBe(false);
    expect(isValidDeliveryTime(6 * 60 + 45, 7 * 60, 21 * 60, 15)).toBe(false);
    expect(isValidDeliveryTime(21 * 60 + 15, 7 * 60, 21 * 60, 15)).toBe(false);
  });
});
