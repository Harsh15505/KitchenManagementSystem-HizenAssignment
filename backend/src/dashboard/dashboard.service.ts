import { Injectable } from '@nestjs/common';
import {
  type AdminDashboardDto,
  addDays,
  type CalendarDate,
  isoWeekday,
  isKitchenWorkingDay,
  resolvePrice,
  toDbDate,
} from '@fernleaf/shared';
import { BillingService } from '../billing/billing.service';
import { ClockService } from '../clock/clock.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { KitchenService } from '../kitchen/kitchen.service';
import { CutoffService } from '../orders/cutoff.service';
import { PlanningService } from '../orders/planning.service';
import { PricingService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.service';

const ACTIVE = ['CONFIRMED', 'DELIVERED'] as const;
const DAY = 24 * 60 * 60_000;

/** PRD §8.2. Each figure follows its written definition, so a reviewer can recompute it. */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly planning: PlanningService,
    private readonly cutoff: CutoffService,
    private readonly kitchen: KitchenService,
    private readonly dispatch: DispatchService,
    private readonly billing: BillingService,
    private readonly pricing: PricingService,
  ) {}

  async admin(): Promise<AdminDashboardDto> {
    const now = this.clock.now();
    const today = this.clock.today();
    const from = addDays(today, -14);
    const until = addDays(today, 7);
    const [planning, kitchen, dispatch, overview, billing, mealsToday] = await Promise.all([
      this.planning.load(),
      this.kitchen.board({}),
      this.dispatch.board({}),
      this.cutoff.overview(),
      this.billing.summary(),
      this.prisma.orderLine.aggregate({
        where: { order: { deliveryDate: toDbDate(today), status: { in: [...ACTIVE] } } },
        _sum: { quantity: true },
      }),
    ]);

    const [ordersToday, perDay, meals, deliveredDrops, openInvoices, oldest, paid, gaps] =
      await Promise.all([
        this.prisma.order.count({
          where: { deliveryDate: toDbDate(today), status: { in: [...ACTIVE] } },
        }),
        // Orders and money per date and status across the window.
        this.prisma.order.groupBy({
          by: ['deliveryDate', 'status'],
          where: {
            deliveryDate: { gte: toDbDate(from), lte: toDbDate(until) },
            status: { in: ['DRAFT', 'PLACED', 'CONFIRMED', 'DELIVERED'] },
          },
          _count: { _all: true },
          _sum: { totalCents: true },
        }),
        // Meals (Σ line quantities) per date and status.
        this.prisma.$queryRaw<Array<{ date: Date; status: string; meals: bigint }>>`
        SELECT o."deliveryDate" AS date, o.status::text AS status, SUM(l.quantity) AS meals
        FROM "Order" o JOIN "OrderLine" l ON l."orderId" = o.id
        WHERE o."deliveryDate" BETWEEN ${toDbDate(from)} AND ${toDbDate(until)}
        GROUP BY o."deliveryDate", o.status`,
        this.prisma.drop.findMany({
          where: {
            deliveredAt: { not: null },
            deliveryDate: { gte: toDbDate(addDays(today, -6)), lte: toDbDate(today) },
          },
          select: { deliveryDate: true, deliveredOnTime: true },
        }),
        this.prisma.invoice.aggregate({
          where: { status: 'ISSUED' },
          _count: { _all: true },
          _sum: { totalCents: true },
        }),
        this.prisma.invoice.findFirst({
          where: { status: 'ISSUED' },
          orderBy: { issuedAt: 'asc' },
          select: { issuedAt: true },
        }),
        this.prisma.invoice.aggregate({
          where: { paidAt: { gte: new Date(now.getTime() - 30 * DAY) } },
          _sum: { totalCents: true },
        }),
        this.setupGaps(),
      ]);

    const key = (d: Date) => d.toISOString().slice(0, 10);
    const group = (date: string, status: string) =>
      perDay.find((r) => key(r.deliveryDate) === date && r.status === status);
    const mealsOf = (date: string, status: string) =>
      Number(meals.find((r) => key(r.date) === date && r.status === status)?.meals ?? 0);
    const ordersOf = (date: string, status: string) => group(date, status)?._count._all ?? 0;
    const centsOf = (date: string, status: string) => group(date, status)?._sum.totalCents ?? 0;

    const onTime: AdminDashboardDto['onTime'] = [];
    for (let i = 6; i >= 0; i--) {
      const date = addDays(today, -i);
      const rows = deliveredDrops.filter((d) => key(d.deliveryDate) === date);
      const ok = rows.filter((d) => d.deliveredOnTime).length;
      onTime.push({
        date,
        delivered: rows.length,
        onTime: ok,
        rate: rows.length === 0 ? null : ok / rows.length,
      });
    }

    const pipeline: AdminDashboardDto['pipeline'] = [];
    for (let i = 1; i <= 7; i++) {
      const date = addDays(today, i);
      pipeline.push({
        date,
        kitchenHoliday: !isKitchenWorkingDay(date, planning.kitchen),
        confirmed: ordersOf(date, 'CONFIRMED'),
        placed: ordersOf(date, 'PLACED'),
        draft: ordersOf(date, 'DRAFT'),
        meals: mealsOf(date, 'CONFIRMED') + mealsOf(date, 'PLACED') + mealsOf(date, 'DRAFT'),
      });
    }

    const days: AdminDashboardDto['revenue']['days'] = [];
    for (let i = -14; i <= 7; i++) {
      const date = addDays(today, i);
      const future = i > 0;
      const cents = centsOf(date, 'CONFIRMED') + (future ? 0 : centsOf(date, 'DELIVERED'));
      days.push({ date, cents, future });
    }
    const monday = addDays(today, 1 - isoWeekday(today));
    const weekSum = (start: CalendarDate) =>
      days
        .filter((d) => d.date >= start && d.date <= addDays(start, 6) && d.date <= today)
        .reduce((s, d) => s + d.cents, 0);
    // Like-for-like: this week so far vs the same weekdays last week.
    const lastWeekStart = addDays(monday, -7);
    const lastWeekSoFar = days
      .filter((d) => d.date >= lastWeekStart && d.date <= addDays(today, -7))
      .reduce((s, d) => s + d.cents, 0);

    const next = overview.nextCutoff;
    const nextCounts = overview.pending.find((p) => p.deliveryDate === next?.deliveryDate);
    const uninvoicedRows = billing
      .map((r) => ({
        companyId: r.company.id,
        companyName: r.company.name,
        cents: r.uninvoicedOrdersCents + r.uninvoicedAdjustmentsCents,
      }))
      .sort((a, b) => b.cents - a.cents);

    return {
      date: today,
      now: now.toISOString(),
      today: {
        orders: ordersToday,
        meals: mealsToday._sum.quantity ?? 0,
        drops: dispatch.summary.drops,
        dropsDelivered: dispatch.summary.DELIVERED,
        lateUnits: kitchen.summary.late,
        lateDrops: dispatch.summary.late,
      },
      onTime,
      nextCutoff: next
        ? {
            deliveryDate: next.deliveryDate,
            cutoffAt: next.cutoffAt,
            drafts: nextCounts?.drafts ?? 0,
            placed: nextCounts?.placed ?? 0,
          }
        : null,
      pendingProcessing: overview.pending.filter((p) => p.due).map(({ due: _due, ...p }) => p),
      pipeline,
      revenue: { days, thisWeekCents: weekSum(monday), lastWeekCents: lastWeekSoFar },
      uninvoiced: {
        cents: uninvoicedRows.reduce((s, r) => s + r.cents, 0),
        top: uninvoicedRows.filter((r) => r.cents !== 0).slice(0, 5),
      },
      openInvoices: {
        count: openInvoices._count._all,
        cents: openInvoices._sum.totalCents ?? 0,
        oldestIssuedAt: oldest?.issuedAt.toISOString() ?? null,
      },
      paidLast30DaysCents: paid._sum.totalCents ?? 0,
      setupGaps: gaps,
    };
  }

  /** PRD §8.2 setup gaps: unpriced dishes on tiers in use, companies with no driver, dishes with no station. */
  private async setupGaps(): Promise<AdminDashboardDto['setupGaps']> {
    const [pricing, companies, menuDishes, noStation] = await Promise.all([
      this.pricing.loadContext(),
      this.prisma.company.findMany({
        where: { isActive: true },
        select: { id: true, name: true, priceTierId: true, defaultDriverId: true },
      }),
      this.prisma.dish.findMany({
        where: {
          isActive: true,
          menuItems: { some: { isActive: true, category: { isActive: true } } },
        },
        select: { id: true, name: true, costPriceCents: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.dish.findMany({
        where: { isActive: true, kitchenStationId: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    const tiers = new Set<string>([
      pricing.defaultTierId,
      ...companies.map((c) => c.priceTierId).filter((t): t is string => Boolean(t)),
    ]);
    const unpricedDishes: AdminDashboardDto['setupGaps']['unpricedDishes'] = [];
    for (const dish of menuDishes)
      for (const tierId of tiers) {
        const price = resolvePrice(
          { kind: 'DISH', id: dish.id, costCents: dish.costPriceCents },
          tierId,
          pricing.ctx,
        );
        if (price.source === 'MISSING')
          unpricedDishes.push({
            dishId: dish.id,
            dishName: dish.name,
            tierName: pricing.tierNames.get(tierId) ?? 'Tier',
          });
      }
    return {
      unpricedDishes,
      companiesWithoutDriver: companies
        .filter((c) => !c.defaultDriverId)
        .map((c) => ({ id: c.id, name: c.name })),
      dishesWithoutStation: noStation,
    };
  }
}
