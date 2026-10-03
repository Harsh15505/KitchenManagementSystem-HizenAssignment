import { Injectable, Logger } from '@nestjs/common';
import {
  addDays,
  type CalendarDate,
  calendarDate,
  type CutoffOverviewDto,
  type CutoffRunDto,
  fromDbDate,
  isKitchenWorkingDay,
  planTimes,
  toDbDate,
} from '@fernleaf/shared';
import { ClockService } from '../clock/clock.service';
import { DomainError } from '../common/domain-error';
import { PrismaService } from '../prisma/prisma.service';
import { assignDrop } from './drops';
import { PlanningService } from './planning.service';

type Trigger = 'SCHEDULED' | 'CATCH_UP' | 'MANUAL';
interface Actor {
  id: string;
  name: string;
}

/**
 * BR-CUT-04 (TRD §8.7): processing a delivery date cancels its drafts and confirms its placed
 * orders (plans recomputed, drop assigned). Serialised per date with an advisory lock and
 * idempotent: a second run finds nothing left to change.
 */
@Injectable()
export class CutoffService {
  private readonly logger = new Logger(CutoffService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly planning: PlanningService,
  ) {}

  async process(date: CalendarDate, trigger: Trigger, actor: Actor | null): Promise<CutoffRunDto> {
    const planning = await this.planning.load();
    const now = this.clock.now();
    const at = planning.cutoffAt(date);
    if (now.getTime() < at.getTime())
      throw new DomainError(
        'CUTOFF_NOT_REACHED',
        `Ordering for ${date} closes at ${at.toISOString()}; it can't be processed yet.`,
      );
    const label = actor?.name ?? 'System (cut-off)';

    const run = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`cutoff:${date}`}))`;
        const where = { deliveryDate: toDbDate(date) };
        const cancelled = await tx.order.updateManyAndReturn({
          where: { ...where, status: 'DRAFT' },
          data: {
            status: 'CANCELLED',
            cancelledAt: now,
            statusReason: 'Draft not placed before the cut-off',
            version: { increment: 1 },
          },
          select: { id: true },
        });
        const confirmed = await tx.order.updateManyAndReturn({
          where: { ...where, status: 'PLACED' },
          data: { status: 'CONFIRMED', confirmedAt: now, version: { increment: 1 } },
          select: {
            id: true,
            companyId: true,
            addressId: true,
            deliveryDate: true,
            deliveryTimeMinutes: true,
            deliveryAt: true,
            kitchenReadyAt: true,
            company: { select: { dispatchLeadMinutes: true } },
          },
        });
        for (const order of confirmed) {
          // BR-PLN-03: plans again at confirmation (the company's lead time may have changed).
          await tx.order.update({
            where: { id: order.id },
            data: planTimes(
              order.deliveryAt,
              order.company.dispatchLeadMinutes,
              planning.settings.kitchenBufferMinutes,
            ),
          });
          await assignDrop(
            tx,
            {
              orderId: order.id,
              companyId: order.companyId,
              addressId: order.addressId,
              deliveryDate: order.deliveryDate,
              deliveryTimeMinutes: order.deliveryTimeMinutes,
              deliveryAt: order.deliveryAt,
              kitchenReady: order.kitchenReadyAt !== null,
            },
            { strict: false, actorId: actor?.id ?? null, actorLabel: label },
          );
        }
        await tx.orderEvent.createMany({
          data: [
            ...cancelled.map((o) => ({
              orderId: o.id,
              type: 'CANCELLED' as const,
              actorId: actor?.id ?? null,
              actorLabel: label,
              data: { reason: 'Draft not placed before the cut-off' },
            })),
            ...confirmed.map((o) => ({
              orderId: o.id,
              type: 'CONFIRMED' as const,
              actorId: actor?.id ?? null,
              actorLabel: label,
            })),
          ],
        });
        return tx.cutoffRun.create({
          data: {
            deliveryDate: toDbDate(date),
            cutoffAt: at,
            trigger,
            triggeredById: actor?.id ?? null,
            startedAt: now,
            finishedAt: new Date(),
            draftsCancelled: cancelled.length,
            ordersConfirmed: confirmed.length,
          },
        });
      },
      { timeout: 30_000 },
    );
    if (run.draftsCancelled + run.ordersConfirmed > 0)
      this.logger.log(
        `Cut-off ${date} (${trigger}): ${run.ordersConfirmed} confirmed, ${run.draftsCancelled} drafts cancelled`,
      );
    return this.toRunDto(run, actor?.name ?? null);
  }

  /** BR-CUT-05: process every date that still has open orders and whose cut-off has passed. */
  async catchUp(trigger: Trigger = 'CATCH_UP'): Promise<number> {
    const planning = await this.planning.load();
    const now = this.clock.now();
    const dates = await this.prisma.order.findMany({
      where: { status: { in: ['DRAFT', 'PLACED'] } },
      distinct: ['deliveryDate'],
      select: { deliveryDate: true },
    });
    let processed = 0;
    for (const { deliveryDate } of dates) {
      const date = fromDbDate(deliveryDate);
      if (planning.cutoffAt(date).getTime() > now.getTime()) continue;
      await this.process(date, trigger, null);
      processed++;
    }
    return processed;
  }

  /** The next cut-off instant over the coming weeks (for the timer). */
  async nextCutoff(): Promise<{ date: CalendarDate; at: Date } | null> {
    const planning = await this.planning.load();
    const now = this.clock.now();
    const today = this.clock.today();
    let best: { date: CalendarDate; at: Date } | null = null;
    for (let i = 0; i < 30; i++) {
      const date = addDays(today, i);
      if (!isKitchenWorkingDay(date, planning.kitchen)) continue;
      const at = planning.cutoffAt(date);
      if (at.getTime() > now.getTime() && (!best || at.getTime() < best.at.getTime()))
        best = { date, at };
    }
    return best;
  }

  async overview(): Promise<CutoffOverviewDto> {
    const planning = await this.planning.load();
    const now = this.clock.now();
    const [open, runs, next] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['deliveryDate', 'status'],
        where: { status: { in: ['DRAFT', 'PLACED'] } },
        _count: { _all: true },
        orderBy: { deliveryDate: 'asc' },
      }),
      this.prisma.cutoffRun.findMany({ orderBy: { startedAt: 'desc' }, take: 25 }),
      this.nextCutoff(),
    ]);
    const users = new Map(
      (
        await this.prisma.user.findMany({
          where: {
            id: { in: runs.map((r) => r.triggeredById).filter((v): v is string => Boolean(v)) },
          },
          select: { id: true, name: true },
        })
      ).map((u) => [u.id, u.name]),
    );
    const pending = new Map<string, { drafts: number; placed: number }>();
    for (const row of open) {
      const key = fromDbDate(row.deliveryDate);
      const entry = pending.get(key) ?? { drafts: 0, placed: 0 };
      if (row.status === 'DRAFT') entry.drafts += row._count._all;
      else entry.placed += row._count._all;
      pending.set(key, entry);
    }
    const today = this.clock.today();
    const upcoming: CutoffOverviewDto['upcoming'] = [];
    for (let i = 0; upcoming.length < 7 && i < 30; i++) {
      const date = addDays(today, i);
      if (!isKitchenWorkingDay(date, planning.kitchen)) continue;
      upcoming.push({ deliveryDate: date, cutoffAt: planning.cutoffAt(date).toISOString() });
    }
    return {
      autoCutoffEnabled: planning.settings.autoCutoffEnabled,
      nextCutoff: next ? { deliveryDate: next.date, cutoffAt: next.at.toISOString() } : null,
      pending: [...pending.entries()].map(([date, counts]) => {
        const at = planning.cutoffAt(calendarDate(date));
        return {
          deliveryDate: date,
          cutoffAt: at.toISOString(),
          due: at.getTime() <= now.getTime(),
          ...counts,
        };
      }),
      upcoming,
      runs: runs.map((r) =>
        this.toRunDto(r, r.triggeredById ? (users.get(r.triggeredById) ?? 'Staff') : null),
      ),
    };
  }

  private toRunDto(
    r: {
      id: string;
      deliveryDate: Date;
      cutoffAt: Date;
      trigger: Trigger;
      startedAt: Date;
      finishedAt: Date | null;
      draftsCancelled: number;
      ordersConfirmed: number;
    },
    by: string | null,
  ): CutoffRunDto {
    return {
      id: r.id,
      deliveryDate: fromDbDate(r.deliveryDate),
      cutoffAt: r.cutoffAt.toISOString(),
      trigger: r.trigger,
      triggeredBy: by,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
      draftsCancelled: r.draftsCancelled,
      ordersConfirmed: r.ordersConfirmed,
    };
  }
}
