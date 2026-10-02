import { Injectable } from '@nestjs/common';
import { type CalendarDate, KITCHEN_TIMEZONE, toLocalDate } from '@fernleaf/shared';

/**
 * The only place the API reads the wall clock. Domain functions receive `now` as a parameter,
 * and tests swap this service for a fixed clock (TRD §5.8).
 */
@Injectable()
export class ClockService {
  /** Kitchen time zone. Fixed at setup (ADR-006); PlatformSettings mirrors it read-only. */
  readonly timeZone = KITCHEN_TIMEZONE;

  now(): Date {
    return new Date();
  }

  /** "Today" in the kitchen's time zone, regardless of the server's TZ (production runs TZ=UTC). */
  today(): CalendarDate {
    return toLocalDate(this.now(), this.timeZone);
  }
}
