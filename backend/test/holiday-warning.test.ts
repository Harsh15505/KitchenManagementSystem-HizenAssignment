import { calendarDate } from '@fernleaf/shared';
import { describe, expect, it } from 'vitest';
import { OrdersQueryService } from '../src/orders/orders-query.service';
import type { PlanningService } from '../src/orders/planning.service';
import type { PrismaService } from '../src/prisma/prisma.service';

const LUMEN = '00000000-0000-4000-8000-0000000000a1';

/** Records the `where` the service sends and answers with two open orders. */
function fakePrisma() {
  const wheres: unknown[] = [];
  const prisma = {
    order: {
      findMany: async ({ where }: { where: unknown }) => {
        wheres.push(where);
        return [
          {
            id: 'o1',
            number: 41,
            status: 'PLACED',
            deliveryTimeMinutes: 750,
            employee: { name: 'Priya Gupta' },
            company: { name: 'Lumen Labs' },
          },
          {
            id: 'o2',
            number: 42,
            status: 'CONFIRMED',
            deliveryTimeMinutes: 780,
            employee: { name: 'Arjun Chopra' },
            company: { name: 'Lumen Labs' },
          },
        ];
      },
      count: async () => 2,
    },
  };
  return { prisma: prisma as unknown as PrismaService, wheres };
}

describe('Holiday warning (FR-CMP-05, A-37)', () => {
  it('A-37 lists only open orders on the date, for one company', async () => {
    const { prisma, wheres } = fakePrisma();
    const service = new OrdersQueryService(prisma, {} as PlanningService);
    const result = await service.openOn({ date: calendarDate('2026-10-09'), companyId: LUMEN });

    expect(wheres[0]).toEqual({
      deliveryDate: new Date('2026-10-09T00:00:00.000Z'),
      status: { in: ['DRAFT', 'PLACED', 'CONFIRMED'] },
      companyId: LUMEN,
    });
    expect(result).toEqual({
      date: '2026-10-09',
      total: 2,
      orders: [
        {
          id: 'o1',
          number: 41,
          status: 'PLACED',
          deliveryTimeMinutes: 750,
          employeeName: 'Priya Gupta',
          companyName: 'Lumen Labs',
        },
        {
          id: 'o2',
          number: 42,
          status: 'CONFIRMED',
          deliveryTimeMinutes: 780,
          employeeName: 'Arjun Chopra',
          companyName: 'Lumen Labs',
        },
      ],
    });
  });

  it('A-37 a kitchen holiday (no company) covers every company', async () => {
    const { prisma, wheres } = fakePrisma();
    await new OrdersQueryService(prisma, {} as PlanningService).openOn({
      date: calendarDate('2026-10-20'),
    });
    expect(wheres[0]).not.toHaveProperty('companyId');
  });
});
