import { Injectable } from '@nestjs/common';
import {
  type CalendarDate,
  type CompanyCalendar,
  type CutoffSettings,
  cutoffAt,
  fromDbDate,
  isLocked,
  type KitchenCalendar,
} from '@fernleaf/shared';
import { ClockService } from '../clock/clock.service';
import { DomainError } from '../common/domain-error';
import { PrismaService } from '../prisma/prisma.service';

export interface Planning {
  settings: {
    kitchenBufferMinutes: number;
    atRiskWindowMinutes: number;
    onTimeGraceMinutes: number;
    deliveryWindowStartMin: number;
    deliveryWindowEndMin: number;
    deliverySlotMinutes: number;
    autoCutoffEnabled: boolean;
  };
  cutoff: CutoffSettings;
  kitchen: KitchenCalendar;
  cutoffAt(date: CalendarDate): Date;
  isLocked(date: CalendarDate, now?: Date): boolean;
}

/** Loads the kitchen calendar and the cut-off/planning settings (BR-CUT, BR-PLN). */
@Injectable()
export class PlanningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  async load(): Promise<Planning> {
    const [s, holidays] = await Promise.all([
      this.prisma.platformSettings.findUnique({ where: { id: 1 } }),
      this.prisma.kitchenHoliday.findMany({ select: { date: true } }),
    ]);
    if (!s) throw new DomainError('INTERNAL', 'Platform settings are missing. Run the seed.');
    const cutoff: CutoffSettings = {
      cutoffWorkingDays: s.cutoffWorkingDays,
      cutoffTimeMinutes: s.cutoffTimeMinutes,
      timeZone: this.clock.timeZone,
    };
    const kitchen: KitchenCalendar = {
      workingDays: new Set(s.kitchenWorkingDays),
      holidays: new Set(holidays.map((h) => fromDbDate(h.date))),
    };
    return {
      settings: {
        kitchenBufferMinutes: s.kitchenBufferMinutes,
        atRiskWindowMinutes: s.atRiskWindowMinutes,
        onTimeGraceMinutes: s.onTimeGraceMinutes,
        deliveryWindowStartMin: s.deliveryWindowStartMin,
        deliveryWindowEndMin: s.deliveryWindowEndMin,
        deliverySlotMinutes: s.deliverySlotMinutes,
        autoCutoffEnabled: s.autoCutoffEnabled,
      },
      cutoff,
      kitchen,
      cutoffAt: (date) => cutoffAt(date, cutoff, kitchen),
      isLocked: (date, now = this.clock.now()) => isLocked(date, now, cutoff, kitchen),
    };
  }

  async companyCalendar(companyId: string): Promise<CompanyCalendar> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { workingDays: true, holidays: { select: { date: true } } },
    });
    if (!company) throw new DomainError('NOT_FOUND', 'Company not found.');
    return {
      workingDays: new Set(company.workingDays),
      holidays: new Set(company.holidays.map((h) => fromDbDate(h.date))),
    };
  }
}
