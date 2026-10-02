import { describe, expect, it } from 'vitest';
import { ClockService } from '../src/clock/clock.service';

class FixedClock extends ClockService {
  constructor(private readonly fixed: Date) {
    super();
  }
  override now(): Date {
    return this.fixed;
  }
}

describe('ClockService: "today" is the kitchen date, not the server date', () => {
  it('00:15 IST on 5 Oct is still 4 Oct in UTC, but today is 5 Oct', () => {
    const clock = new FixedClock(new Date('2026-10-04T18:45:00.000Z'));
    expect(clock.today()).toBe('2026-10-05');
  });

  it('23:59 IST on 4 Oct stays 4 Oct', () => {
    const clock = new FixedClock(new Date('2026-10-04T18:29:00.000Z'));
    expect(clock.today()).toBe('2026-10-04');
  });
});
