import { randomUUID } from 'node:crypto';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  addDays,
  type CalendarDate,
  calendarDate,
  compareDates,
  fromDbDate,
  isoWeekday,
  type LineInput,
  type MenuDishView,
  normaliseOrder,
  type NormalisedLine,
  orderableDishes,
  planTimes,
  toDbDate,
  toInstant,
} from '@fernleaf/shared';
import type { CurrentUserInfo } from '../authz/current-user';
import { BillingService } from '../billing/billing.service';
import { ClockService } from '../clock/clock.service';
import type { Prisma } from '../generated/prisma/client';
import {
  type EmployeeMenuContext,
  type MenuCatalogue,
  MenuInputService,
} from '../menu/menu-input.service';
import { JobsService } from '../orders/jobs.service';
import { type Planning, PlanningService } from '../orders/planning.service';
import { PrismaService } from '../prisma/prisma.service';

const SEED_VERSION = 1;
const WINDOW_PAST = 14;
const WINDOW_FUTURE = 7;
const AUTOPILOT = 'Demo autopilot';
const CUTOFF_ACTOR = 'System (cut-off)';

type Stage =
  'QUEUED' | 'IN_PREP' | 'KITCHEN_READY' | 'DISPATCH_READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
const RANK: Record<Stage, number> = {
  QUEUED: 0,
  IN_PREP: 1,
  KITCHEN_READY: 2,
  DISPATCH_READY: 3,
  OUT_FOR_DELIVERY: 4,
  DELIVERED: 5,
};
const MIN = 60_000;

/** Deterministic PRNG (mulberry32) seeded from a string, so a day regenerates identically. */
function rngFor(seed: string): () => number {
  let h = 1779033703;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(rnd: () => number, items: readonly T[]): T =>
  items[Math.floor(rnd() * items.length)]!;

/** TRD §12: the stage a demo order "should" be at, by its own plan. Same schedule for a whole drop. */
function schedule(
  plannedKitchenReadyAt: Date,
  plannedDispatchReadyAt: Date,
  deliveryAt: Date,
  late: boolean,
) {
  return {
    start: new Date(plannedKitchenReadyAt.getTime() - 45 * MIN),
    done: new Date(plannedKitchenReadyAt.getTime() - 5 * MIN),
    ready: new Date(plannedDispatchReadyAt.getTime() - 10 * MIN),
    out: plannedDispatchReadyAt,
    delivered: new Date(deliveryAt.getTime() + (late ? 12 : -4) * MIN),
  };
}
function stageAt(s: ReturnType<typeof schedule>, now: Date): Stage {
  const t = now.getTime();
  if (t >= s.delivered.getTime()) return 'DELIVERED';
  if (t >= s.out.getTime()) return 'OUT_FOR_DELIVERY';
  if (t >= s.ready.getTime()) return 'DISPATCH_READY';
  if (t >= s.done.getTime()) return 'KITCHEN_READY';
  if (t >= s.start.getTime()) return 'IN_PREP';
  return 'QUEUED';
}
/** Caps for live days: ~40 % delivered, 15 % out, 15 % packed, 15 % cooked, 15 % left to humans. */
function capFor(key: string): Stage | null {
  const r = rngFor(`cap:${key}`)();
  if (r < 0.4) return 'DELIVERED';
  if (r < 0.55) return 'OUT_FOR_DELIVERY';
  if (r < 0.7) return 'DISPATCH_READY';
  if (r < 0.85) return 'KITCHEN_READY';
  return null;
}
const lateFor = (key: string) => rngFor(`late:${key}`)() < 0.15;

interface CompanyRow {
  id: string;
  name: string;
  workingDays: number[];
  holidays: Set<string>;
  defaultAddressId: string;
  defaultDeliveryTimeMinutes: number;
  defaultPackagingTypeId: string;
  dispatchLeadMinutes: number;
  defaultDriver: { id: string; name: string } | null;
  addresses: Array<{
    id: string;
    label: string;
    line1: string;
    line2: string;
    city: string;
    postalCode: string;
    accessNotes: string;
  }>;
  employees: Array<{
    id: string;
    canChooseAddress: boolean;
    canChangeDeliveryTime: boolean;
    canChangePackaging: boolean;
  }>;
}

/**
 * Keeps realistic data on every review day (FR-DAT-01..04, TRD §12): a rolling window of
 * generated orders built with the same menu, combination and pricing functions as real ones,
 * plus an autopilot that moves today's orders along their plans so every role has live work.
 */
@Injectable()
export class DemoService implements OnModuleInit {
  private readonly logger = new Logger(DemoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly planning: PlanningService,
    private readonly menuInput: MenuInputService,
    private readonly jobs: JobsService,
    private readonly billing: BillingService,
  ) {}

  onModuleInit(): void {
    this.jobs.addTask('demo', () => this.tick());
  }

  /** Called by the jobs runner (startup, timer, request catch-up). */
  async tick(): Promise<void> {
    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: 1 },
      select: { demoAutopilotEnabled: true },
    });
    if (!settings?.demoAutopilotEnabled) return;
    const last = addDays(this.clock.today(), WINDOW_FUTURE);
    if (
      !(await this.prisma.demoDay.findUnique({
        where: { date: toDbDate(last) },
        select: { date: true },
      }))
    )
      await this.ensureWindow();
    await this.autopilot();
    await this.ensureInvoices();
  }

  /**
   * TRD §12: weekly invoices per company for delivered demo orders older than 7 days; earlier
   * weeks are paid, the latest stays issued, and the last 7 days stay uninvoiced.
   */
  async ensureInvoices(): Promise<number> {
    const cutoff = addDays(this.clock.today(), -7);
    const orders = await this.prisma.order.findMany({
      where: {
        source: 'DEMO',
        status: 'DELIVERED',
        invoiceLine: { is: null },
        deliveryDate: { lt: toDbDate(cutoff) },
      },
      select: { id: true, companyId: true, deliveryDate: true },
    });
    if (orders.length === 0) return 0;
    const admin = await this.prisma.user.findUnique({
      where: { email: 'admin@test.com' },
      select: { id: true },
    });
    if (!admin) return 0;
    const actor = { id: admin.id, name: 'Weekly billing run' } as CurrentUserInfo;
    const weeks = new Map<string, { companyId: string; ids: string[] }>();
    for (const o of orders) {
      const date = fromDbDate(o.deliveryDate);
      const monday = addDays(date, 1 - isoWeekday(date));
      const key = `${o.companyId}|${monday}`;
      const week = weeks.get(key) ?? { companyId: o.companyId, ids: [] };
      week.ids.push(o.id);
      weeks.set(key, week);
    }
    let created = 0;
    for (const [key, week] of [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const invoice = await this.billing.createInvoice(
        {
          companyId: week.companyId,
          orderIds: week.ids,
          adjustmentIds: [],
          notes: `Weekly invoice, week of ${key.split('|')[1]} (demo)`,
        },
        actor,
      );
      // Issued the Monday after the week, mid-morning IST, like a real weekly run.
      const monday = calendarDate(key.split('|')[1]!);
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { issuedAt: toInstant(addDays(monday, 7), 10 * 60, this.clock.timeZone) },
      });
      created++;
    }
    // Every demo invoice except each company's latest is paid.
    const issued = await this.prisma.invoice.findMany({
      where: { status: 'ISSUED', notes: { endsWith: '(demo)' } },
      orderBy: { number: 'desc' },
      select: { id: true, companyId: true, issuedAt: true },
    });
    const latest = new Set<string>();
    for (const inv of issued) {
      if (!latest.has(inv.companyId)) {
        latest.add(inv.companyId);
        continue;
      }
      await this.prisma.invoice.update({
        where: { id: inv.id },
        data: { status: 'PAID', paidAt: new Date(inv.issuedAt.getTime() + 3 * 24 * 60 * MIN) },
      });
    }
    if (created > 0) this.logger.log(`Demo billing: ${created} weekly invoices`);
    return created;
  }

  /** Settings → Demo data: what the generator has produced so far. */
  async status() {
    const [days, orders, settings] = await Promise.all([
      this.prisma.demoDay.findMany({
        orderBy: { date: 'asc' },
        select: { date: true, generatedAt: true },
      }),
      this.prisma.order.count({ where: { source: 'DEMO' } }),
      this.prisma.platformSettings.findUnique({
        where: { id: 1 },
        select: { demoAutopilotEnabled: true },
      }),
    ]);
    const last = days.reduce<Date | null>(
      (m, d) => (!m || d.generatedAt > m ? d.generatedAt : m),
      null,
    );
    return {
      autopilotEnabled: settings?.demoAutopilotEnabled ?? false,
      orders,
      days: days.length,
      firstDate: days[0] ? fromDbDate(days[0].date) : null,
      lastDate: days.at(-1) ? fromDbDate(days.at(-1)!.date) : null,
      lastGeneratedAt: last?.toISOString() ?? null,
    };
  }

  /** FR-DAT-04: drop all generated data (never staff-created orders) and build the window again. */
  async regenerate(): Promise<{ orders: number }> {
    await this.prisma.$transaction(async (tx) => {
      const demo = { source: 'DEMO' as const };
      const dropIds = (
        await tx.order.findMany({
          where: { ...demo, dropId: { not: null } },
          select: { dropId: true },
          distinct: ['dropId'],
        })
      )
        .map((o) => o.dropId)
        .filter((id): id is string => Boolean(id));
      // Invoices holding any generated order go too (their lines point at those orders).
      await tx.invoice.deleteMany({
        where: { OR: [{ notes: { endsWith: '(demo)' } }, { lines: { some: { order: demo } } }] },
      });
      await tx.orderAdjustment.deleteMany({ where: { order: demo } });
      await tx.order.deleteMany({ where: demo });
      await tx.drop.deleteMany({ where: { id: { in: dropIds }, orders: { none: {} } } });
      await tx.demoDay.deleteMany({});
    });
    return { orders: await this.ensureWindow() };
  }

  async ensureWindow(): Promise<number> {
    const today = this.clock.today();
    const [planning, catalogue, companies, existing] = await Promise.all([
      this.planning.load(),
      this.menuInput.loadCatalogue(),
      this.loadCompanies(),
      this.prisma.demoDay.findMany({ select: { date: true } }),
    ]);
    const done = new Set(existing.map((d) => fromDbDate(d.date)));
    const contexts = new Map<string, EmployeeMenuContext>();
    let created = 0;
    for (let offset = -WINDOW_PAST; offset <= WINDOW_FUTURE; offset++) {
      const date = addDays(today, offset);
      if (done.has(date)) continue;
      // Claim the day first: a second process racing us gets a unique-key error and skips it.
      try {
        await this.prisma.demoDay.create({
          data: { date: toDbDate(date), ordersCreated: 0, seedVersion: SEED_VERSION },
        });
      } catch {
        continue;
      }
      const count = await this.generateDay(date, today, planning, catalogue, companies, contexts);
      await this.prisma.demoDay.update({
        where: { date: toDbDate(date) },
        data: { ordersCreated: count },
      });
      created += count;
    }
    if (created > 0) this.logger.log(`Demo window: ${created} orders generated`);
    return created;
  }

  private async generateDay(
    date: CalendarDate,
    today: CalendarDate,
    planning: Planning,
    catalogue: MenuCatalogue,
    companies: CompanyRow[],
    contexts: Map<string, EmployeeMenuContext>,
  ): Promise<number> {
    const now = this.clock.now();
    const relative = compareDates(date, today);
    const cutoffAt = planning.cutoffAt(date);
    const cutoffPassed = now.getTime() >= cutoffAt.getTime();
    if (!planning.kitchen.workingDays.has(isoWeekday(date)) || planning.kitchen.holidays.has(date))
      return 0;

    const orders: Prisma.OrderCreateManyInput[] = [];
    const lines: Prisma.OrderLineCreateManyInput[] = [];
    const combos: Prisma.OrderCombinationCreateManyInput[] = [];
    const choices: Prisma.OrderCombinationChoiceCreateManyInput[] = [];
    const events: Prisma.OrderEventCreateManyInput[] = [];
    const drops = new Map<string, Prisma.DropCreateManyInput>();
    const sizeNames = new Map(
      (await this.prisma.portionSize.findMany({ select: { id: true, name: true } })).map((s) => [
        s.id,
        s.name,
      ]),
    );
    const packaging = await this.prisma.packagingType.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });
    const packagingName = new Map(packaging.map((p) => [p.id, p.name]));

    for (const company of companies) {
      if (!company.workingDays.includes(isoWeekday(date)) || company.holidays.has(date)) continue;
      const rnd = rngFor(`${date}:${company.id}:${SEED_VERSION}`);
      const weekend = isoWeekday(date) >= 6;
      const target = Math.min(
        company.employees.length,
        (weekend ? 3 : 7) + Math.floor(rnd() * (weekend ? 4 : 6)),
      );
      const people = [...company.employees].sort(() => rnd() - 0.5).slice(0, target);

      for (const person of people) {
        let ctx = contexts.get(person.id);
        if (!ctx) {
          ctx = await this.menuInput.forEmployee(person.id, catalogue);
          contexts.set(person.id, ctx);
        }
        const menu = [...orderableDishes(ctx.input).values()];
        const safe = menu.filter((d) => d.allergenConflicts.length === 0);
        const built = buildLines(rnd, safe.length >= 3 ? safe : menu);
        const result = normaliseOrder(built, orderableDishes(ctx.input));
        if (!result.ok || result.lines.length === 0) continue;

        // Delivery details: company defaults, varied where the employee's flags allow it.
        let time = company.defaultDeliveryTimeMinutes;
        if (person.canChangeDeliveryTime && rnd() < 0.5) {
          const shifted = time + pick(rnd, [-60, -30, 30, 60]);
          if (
            shifted >= planning.settings.deliveryWindowStartMin &&
            shifted <= planning.settings.deliveryWindowEndMin
          )
            time = shifted;
        }
        const address =
          person.canChooseAddress && company.addresses.length > 1 && rnd() < 0.5
            ? pick(rnd, company.addresses)
            : company.addresses.find((a) => a.id === company.defaultAddressId)!;
        const packagingId =
          person.canChangePackaging && rnd() < 0.3
            ? pick(rnd, packaging).id
            : company.defaultPackagingTypeId;
        const deliveryAt = toInstant(date, time, planning.cutoff.timeZone);
        const plans = planTimes(
          deliveryAt,
          company.dispatchLeadMinutes,
          planning.settings.kitchenBufferMinutes,
        );
        const dropKey = `${company.id}|${address.id}|${deliveryAt.toISOString()}`;
        const sched = schedule(
          plans.plannedKitchenReadyAt,
          plans.plannedDispatchReadyAt,
          deliveryAt,
          lateFor(dropKey),
        );

        // Status by relative date (TRD §12).
        const r = rnd();
        let status: 'DRAFT' | 'PLACED' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED' | 'REJECTED';
        if (relative < 0) status = r < 0.92 ? 'DELIVERED' : r < 0.97 ? 'CANCELLED' : 'REJECTED';
        else if (cutoffPassed) status = r < 0.96 ? 'CONFIRMED' : 'REJECTED';
        else status = r < 0.75 ? 'PLACED' : r < 0.95 ? 'DRAFT' : 'CANCELLED';

        const orderId = randomUUID();
        const placedAt = new Date(
          Math.min(
            cutoffAt.getTime() - (2 + rnd() * 50) * 60 * MIN,
            now.getTime() - (1 + rnd() * 20) * 60 * MIN,
          ),
        );
        const createdAt = new Date(placedAt.getTime() - rnd() * 90 * MIN);
        const confirmed = status === 'CONFIRMED' || status === 'DELIVERED';
        const live = relative >= 0 && (status === 'CONFIRMED' || status === 'PLACED');
        const cap = live ? capFor(dropKey) : null;

        let dropId: string | null = null;
        if (confirmed) {
          let drop = drops.get(dropKey);
          if (!drop) {
            const delivered = status === 'DELIVERED';
            drop = {
              id: randomUUID(),
              companyId: company.id,
              addressId: address.id,
              deliveryDate: toDbDate(date),
              deliveryTimeMinutes: time,
              deliveryAt,
              driverId: company.defaultDriver?.id ?? null,
              ...(delivered
                ? {
                    dispatchReadyAt: sched.ready,
                    outForDeliveryAt: sched.out,
                    deliveredAt: sched.delivered,
                    deliveredById: company.defaultDriver?.id ?? null,
                    deliveredOnTime:
                      sched.delivered.getTime() <=
                      deliveryAt.getTime() + planning.settings.onTimeGraceMinutes * MIN,
                  }
                : {}),
            };
            drops.set(dropKey, drop);
          }
          dropId = drop.id!;
        }

        const delivered = status === 'DELIVERED';
        const warnings = result.warnings.length > 0;
        orders.push({
          id: orderId,
          status,
          source: 'DEMO',
          employeeId: person.id,
          companyId: company.id,
          deliveryDate: toDbDate(date),
          deliveryTimeMinutes: time,
          deliveryAt,
          ...plans,
          addressId: address.id,
          addressSnapshot: {
            label: address.label,
            line1: address.line1,
            line2: address.line2,
            city: address.city,
            postalCode: address.postalCode,
            accessNotes: address.accessNotes,
          },
          packagingTypeId: packagingId,
          packagingName: packagingName.get(packagingId) ?? 'Packaging',
          priceTierId: ctx.tier.id,
          priceTierName: ctx.tier.name,
          totalCents: result.totalCents,
          allergenAcknowledged: warnings,
          placedAt: status === 'DRAFT' ? null : placedAt,
          confirmedAt: confirmed ? cutoffAt : null,
          cancelledAt: status === 'CANCELLED' ? new Date(placedAt.getTime() + 3 * 60 * MIN) : null,
          rejectedAt:
            status === 'REJECTED'
              ? new Date(Math.min(cutoffAt.getTime() + 60 * MIN, now.getTime()))
              : null,
          statusReason:
            status === 'CANCELLED'
              ? pick(rnd, [
                  'Employee on leave',
                  'Meeting moved to another day',
                  'Ordered twice by mistake',
                ])
              : status === 'REJECTED'
                ? pick(rnd, ['Ingredient shortage', 'Kitchen at capacity for that slot'])
                : null,
          kitchenStartedAt: delivered ? sched.start : null,
          kitchenReadyAt: delivered ? sched.done : null,
          deliveredAt: delivered ? sched.delivered : null,
          dropId,
          demoAutopilotUntil: cap,
          createdAt,
        });
        this.pushLines(
          orderId,
          result.lines,
          sizeNames,
          delivered ? sched : null,
          lines,
          combos,
          choices,
        );

        const ev = (
          type: Prisma.OrderEventCreateManyInput['type'],
          at: Date,
          actorLabel: string,
          data?: Prisma.InputJsonValue,
        ) => events.push({ id: randomUUID(), orderId, type, at, actorLabel, data });
        ev('CREATED', createdAt, 'Asha Rao', { status: status === 'DRAFT' ? 'DRAFT' : 'PLACED' });
        if (status !== 'DRAFT') ev('PLACED', placedAt, 'Asha Rao');
        if (status === 'CANCELLED')
          ev('CANCELLED', new Date(placedAt.getTime() + 3 * 60 * MIN), 'Asha Rao', {
            reason: 'Demo cancellation',
          });
        if (confirmed) {
          ev('CONFIRMED', cutoffAt, CUTOFF_ACTOR);
          ev('DROP_ASSIGNED', cutoffAt, CUTOFF_ACTOR, { dropId });
        }
        if (status === 'REJECTED')
          ev(
            'REJECTED',
            new Date(Math.min(cutoffAt.getTime() + 60 * MIN, now.getTime())),
            'Asha Rao',
          );
        if (delivered) {
          ev('KITCHEN_STARTED', sched.start, 'Vikram Nair');
          ev('KITCHEN_READY', sched.done, 'Vikram Nair');
          ev('DISPATCH_READY', sched.ready, 'Neha Kapoor');
          ev('OUT_FOR_DELIVERY', sched.out, 'Neha Kapoor');
          ev('DELIVERED', sched.delivered, company.defaultDriver?.name ?? 'Driver');
        }
      }
    }

    if (orders.length === 0) return 0;
    await this.prisma.$transaction(
      async (tx) => {
        if (drops.size > 0)
          await tx.drop.createMany({ data: [...drops.values()], skipDuplicates: true });
        await tx.order.createMany({ data: orders });
        await tx.orderLine.createMany({ data: lines });
        await tx.orderCombination.createMany({ data: combos });
        await tx.orderCombinationChoice.createMany({ data: choices });
        await tx.orderEvent.createMany({ data: events });
      },
      { timeout: 60_000 },
    );
    return orders.length;
  }

  private pushLines(
    orderId: string,
    normalised: NormalisedLine[],
    sizeNames: Map<string, string>,
    sched: ReturnType<typeof schedule> | null,
    lines: Prisma.OrderLineCreateManyInput[],
    combos: Prisma.OrderCombinationCreateManyInput[],
    choices: Prisma.OrderCombinationChoiceCreateManyInput[],
  ): void {
    normalised.forEach((line, i) => {
      const lineId = randomUUID();
      lines.push({
        id: lineId,
        orderId,
        dishId: line.dishId,
        dishName: line.dishName,
        dishSku: line.dishSku ?? '',
        quantity: line.quantity,
        dishPriceCents: line.dishPriceCents,
        totalCents: line.totalCents,
        sortOrder: i,
      });
      for (const c of line.combinations) {
        const comboId = randomUUID();
        combos.push({
          id: comboId,
          lineId,
          signature: c.signature,
          quantity: c.quantity,
          unitPriceCents: c.unitPriceCents,
          totalCents: c.totalCents,
          prepStartedAt: sched?.start ?? null,
          prepDoneAt: sched?.done ?? null,
        });
        for (const ch of c.choices)
          choices.push({
            id: randomUUID(),
            combinationId: comboId,
            optionGroupId: ch.groupId,
            optionGroupName: ch.groupName,
            optionId: ch.optionId,
            optionName: ch.optionName,
            portionSizeId: ch.portionSizeId,
            portionSizeName: ch.portionSizeId ? (sizeNames.get(ch.portionSizeId) ?? null) : null,
            priceCents: ch.priceCents,
            sortOrder: ch.sortOrder,
          });
      }
    });
  }

  /**
   * TRD §12 autopilot: move demo orders on today and earlier up to their cap, along their own
   * plan, with the scheduled timestamps. A human action on an order clears its cap.
   */
  async autopilot(): Promise<number> {
    const now = this.clock.now();
    const today = this.clock.today();
    const planning = await this.planning.load();
    const orders = await this.prisma.order.findMany({
      where: {
        source: 'DEMO',
        status: 'CONFIRMED',
        demoAutopilotUntil: { not: null },
        deliveryDate: { lte: toDbDate(today) },
      },
      select: {
        id: true,
        deliveryDate: true,
        deliveryAt: true,
        plannedKitchenReadyAt: true,
        plannedDispatchReadyAt: true,
        kitchenStartedAt: true,
        kitchenReadyAt: true,
        demoAutopilotUntil: true,
        dropId: true,
        lines: {
          select: { combinations: { select: { id: true, prepStartedAt: true, prepDoneAt: true } } },
        },
        drop: {
          select: {
            id: true,
            companyId: true,
            addressId: true,
            dispatchReadyAt: true,
            outForDeliveryAt: true,
            deliveredAt: true,
            driver: { select: { id: true, name: true } },
            orders: {
              where: { status: 'CONFIRMED' },
              select: { id: true, kitchenReadyAt: true, demoAutopilotUntil: true },
            },
          },
        },
      },
    });
    let moved = 0;
    const touchedDrops = new Set<string>();
    for (const o of orders) {
      const key = o.drop
        ? `${o.drop.companyId}|${o.drop.addressId}|${o.deliveryAt.toISOString()}`
        : o.id;
      const sched = schedule(
        o.plannedKitchenReadyAt,
        o.plannedDispatchReadyAt,
        o.deliveryAt,
        lateFor(key),
      );
      // Past days close completely (history ends clean); today stops at the cap.
      const past = compareDates(fromDbDate(o.deliveryDate), today) < 0;
      const cap = past ? RANK.DELIVERED : RANK[o.demoAutopilotUntil as Stage];
      const target = Math.min(cap, RANK[stageAt(sched, now)]);
      const ops: Prisma.PrismaPromise<unknown>[] = [];
      const ev = (
        type: Prisma.OrderEventCreateManyInput['type'],
        at: Date,
        actorLabel = AUTOPILOT,
      ) =>
        ops.push(this.prisma.orderEvent.create({ data: { orderId: o.id, type, at, actorLabel } }));

      if (target >= RANK.IN_PREP && !o.kitchenStartedAt) {
        ops.push(
          this.prisma.orderCombination.updateMany({
            where: { line: { orderId: o.id }, prepStartedAt: null },
            data: { prepStartedAt: sched.start },
          }),
        );
        ops.push(
          this.prisma.order.update({
            where: { id: o.id },
            data: { kitchenStartedAt: sched.start },
          }),
        );
        ev('KITCHEN_STARTED', sched.start);
      }
      if (target >= RANK.KITCHEN_READY && !o.kitchenReadyAt) {
        ops.push(
          this.prisma.orderCombination.updateMany({
            where: { line: { orderId: o.id }, prepDoneAt: null },
            data: { prepDoneAt: sched.done },
          }),
        );
        ops.push(
          this.prisma.order.update({
            where: { id: o.id },
            data: {
              kitchenReadyAt: sched.done,
              kitchenStartedAt: o.kitchenStartedAt ?? sched.start,
            },
          }),
        );
        ev('KITCHEN_READY', sched.done);
      }
      if (ops.length > 0) {
        await this.prisma.$transaction(ops);
        moved++;
      }

      // Drop steps once every active order in the drop is cooked (staff orders may share it).
      const drop = o.drop;
      if (!drop || touchedDrops.has(drop.id) || target < RANK.DISPATCH_READY) continue;
      touchedDrops.add(drop.id);
      const fresh = await this.prisma.order.findMany({
        where: { dropId: drop.id, status: 'CONFIRMED' },
        select: { id: true, kitchenReadyAt: true },
      });
      if (fresh.some((x) => !x.kitchenReadyAt)) continue;
      const ids = fresh.map((x) => x.id);
      const dropOps: Prisma.PrismaPromise<unknown>[] = [];
      const dropEv = (
        type: Prisma.OrderEventCreateManyInput['type'],
        at: Date,
        actorLabel = AUTOPILOT,
      ) =>
        dropOps.push(
          this.prisma.orderEvent.createMany({
            data: ids.map((orderId) => ({ orderId, type, at, actorLabel })),
          }),
        );
      if (!drop.dispatchReadyAt) {
        dropOps.push(
          this.prisma.drop.update({
            where: { id: drop.id },
            data: { dispatchReadyAt: sched.ready },
          }),
        );
        dropEv('DISPATCH_READY', sched.ready);
      }
      if (target >= RANK.OUT_FOR_DELIVERY && !drop.outForDeliveryAt && drop.driver) {
        dropOps.push(
          this.prisma.drop.update({
            where: { id: drop.id },
            data: { outForDeliveryAt: sched.out },
          }),
        );
        dropEv('OUT_FOR_DELIVERY', sched.out);
      }
      if (target >= RANK.DELIVERED && !drop.deliveredAt && drop.driver) {
        const onTime =
          sched.delivered.getTime() <=
          o.deliveryAt.getTime() + planning.settings.onTimeGraceMinutes * MIN;
        dropOps.push(
          this.prisma.drop.update({
            where: { id: drop.id },
            data: {
              deliveredAt: sched.delivered,
              deliveredById: drop.driver.id,
              deliveredOnTime: onTime,
              outForDeliveryAt: drop.outForDeliveryAt ?? sched.out,
            },
          }),
        );
        dropOps.push(
          this.prisma.order.updateMany({
            where: { id: { in: ids } },
            data: { status: 'DELIVERED', deliveredAt: sched.delivered },
          }),
        );
        dropEv('DELIVERED', sched.delivered, drop.driver.name);
      }
      if (dropOps.length > 0) {
        await this.prisma.$transaction(dropOps);
        moved++;
      }
    }
    return moved;
  }

  private async loadCompanies(): Promise<CompanyRow[]> {
    const rows = await this.prisma.company.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        workingDays: true,
        defaultAddressId: true,
        defaultDeliveryTimeMinutes: true,
        defaultPackagingTypeId: true,
        dispatchLeadMinutes: true,
        defaultDriver: { select: { id: true, name: true } },
        holidays: { select: { date: true } },
        addresses: { where: { isActive: true }, orderBy: { label: 'asc' } },
        employees: {
          where: { isActive: true },
          orderBy: { email: 'asc' },
          select: {
            id: true,
            canChooseAddress: true,
            canChangeDeliveryTime: true,
            canChangePackaging: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    return rows
      .filter((c) => c.defaultAddressId && c.employees.length > 0)
      .map((c) => ({
        ...c,
        defaultAddressId: c.defaultAddressId!,
        holidays: new Set(c.holidays.map((h) => fromDbDate(h.date))),
      }));
  }
}

/** 1–3 dishes; 70 % of lines a single combination, the rest split across two (BR-CMB demo). */
function buildLines(rnd: () => number, menu: MenuDishView[]): LineInput[] {
  const count = Math.min(menu.length, 1 + Math.floor(rnd() * rnd() * 3));
  const dishes = [...menu].sort(() => rnd() - 0.5).slice(0, count);
  return dishes.map((dish) => {
    const quantity = Math.max(dish.minOrderQty ?? 1, rnd() < 0.85 ? 1 : 2 + Math.floor(rnd() * 3));
    const split = quantity > 1 && dish.groups.some((g) => g.options.length > 1) && rnd() < 0.3;
    const first = split ? Math.ceil(quantity / 2) : quantity;
    const combinations = [{ quantity: first, choices: chooseFor(rnd, dish) }];
    if (split) combinations.push({ quantity: quantity - first, choices: chooseFor(rnd, dish) });
    return { dishId: dish.dishId, quantity, combinations };
  });
}

function chooseFor(rnd: () => number, dish: MenuDishView) {
  return dish.groups.flatMap((g) => {
    if (g.options.length === 0 || (!g.isRequired && rnd() < 0.6)) return [];
    const n = g.isRequired ? 1 : Math.min(g.maxSelections, 1 + Math.floor(rnd() * g.maxSelections));
    return [...g.options]
      .sort(() => rnd() - 0.5)
      .slice(0, n)
      .map((o) => ({
        groupId: g.id,
        optionId: o.optionId,
        portionSizeId: g.usesPortions
          ? ((rnd() < 0.7 ? g.portionSizeIds[0] : g.portionSizeIds.at(-1)) ?? null)
          : null,
      }));
  });
}
