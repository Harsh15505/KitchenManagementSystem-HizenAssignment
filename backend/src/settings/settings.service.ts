import { Injectable } from '@nestjs/common';
import {
  type CreateKitchenHolidayInput,
  fromDbDate,
  type KitchenHolidayDto,
  type PlatformSettingsDto,
  toDbDate,
  calendarDate,
  type UpdateSettingsInput,
} from '@fernleaf/shared';
import { DomainError } from '../common/domain-error';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<PlatformSettingsDto> {
    const s = await this.prisma.platformSettings.findUnique({
      where: { id: 1 },
      include: { defaultPriceTier: { select: { id: true, name: true } } },
    });
    if (!s) throw new DomainError('INTERNAL', 'Platform settings are missing. Run the seed.');
    const { id: _id, defaultPriceTierId: _tier, ...rest } = s;
    return { ...rest, updatedAt: s.updatedAt.toISOString() };
  }

  async update(input: UpdateSettingsInput): Promise<PlatformSettingsDto> {
    const current = await this.get();
    // A partial update may change one end of the window only: check against the stored value.
    const start = input.deliveryWindowStartMin ?? current.deliveryWindowStartMin;
    const end = input.deliveryWindowEndMin ?? current.deliveryWindowEndMin;
    if (start >= end) {
      throw new DomainError('VALIDATION_FAILED', 'The delivery window must start before it ends.', {
        fieldErrors: { deliveryWindowEndMin: ['Must be later than the window start'] },
      });
    }
    const data = {
      ...input,
      ...(input.kitchenWorkingDays
        ? { kitchenWorkingDays: [...input.kitchenWorkingDays].sort() }
        : {}),
    };
    await this.prisma.platformSettings.update({ where: { id: 1 }, data });
    return this.get();
  }

  async holidays(from?: string, to?: string): Promise<KitchenHolidayDto[]> {
    const rows = await this.prisma.kitchenHoliday.findMany({
      where: {
        date: {
          ...(from ? { gte: toDbDate(calendarDate(from)) } : {}),
          ...(to ? { lte: toDbDate(calendarDate(to)) } : {}),
        },
      },
      orderBy: { date: 'asc' },
    });
    return rows.map((r) => ({ id: r.id, name: r.name, date: fromDbDate(r.date) }));
  }

  async addHoliday(input: CreateKitchenHolidayInput): Promise<KitchenHolidayDto> {
    const date = toDbDate(calendarDate(input.date));
    if (await this.prisma.kitchenHoliday.findUnique({ where: { date } })) {
      throw new DomainError(
        'UNIQUE_VIOLATION',
        'There is already a kitchen holiday on that date.',
        {
          fieldErrors: { date: ['Already a holiday'] },
        },
      );
    }
    const row = await this.prisma.kitchenHoliday.create({ data: { date, name: input.name } });
    return { id: row.id, name: row.name, date: fromDbDate(row.date) };
  }

  async removeHoliday(id: string): Promise<void> {
    await this.prisma.kitchenHoliday.delete({ where: { id } });
  }

  async publicDomains(): Promise<string[]> {
    const rows = await this.prisma.publicEmailDomain.findMany({ orderBy: { domain: 'asc' } });
    return rows.map((r) => r.domain);
  }

  async addPublicDomain(domain: string): Promise<string[]> {
    await this.prisma.publicEmailDomain.upsert({
      where: { domain },
      update: {},
      create: { domain },
    });
    return this.publicDomains();
  }

  async removePublicDomain(domain: string): Promise<string[]> {
    await this.prisma.publicEmailDomain.deleteMany({ where: { domain } });
    return this.publicDomains();
  }
}
