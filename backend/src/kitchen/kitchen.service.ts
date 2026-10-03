import { Injectable } from '@nestjs/common';
import {
  calendarDate,
  type KitchenBoardDto,
  type KitchenBoardQuery,
  type KitchenUnitDto,
  timeliness,
  toDbDate,
} from '@fernleaf/shared';
import type { CurrentUserInfo } from '../authz/current-user';
import { ClockService } from '../clock/clock.service';
import { DomainError } from '../common/domain-error';
import type { Prisma } from '../generated/prisma/client';
import { PlanningService } from '../orders/planning.service';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;
const UNASSIGNED = 'Unassigned';

/** FR-KIT-01..08, BR-KIT-01..05 (TRD §8.8). */
@Injectable()
export class KitchenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly planning: PlanningService,
  ) {}

  /** T-601: one query for the day, shaped in memory (a 400-order day is ~1,000 units). */
  async board(query: KitchenBoardQuery): Promise<KitchenBoardDto> {
    const date = query.date ? calendarDate(query.date) : this.clock.today();
    const now = this.clock.now();
    const [planning, stations, orders] = await Promise.all([
      this.planning.load(),
      this.prisma.kitchenStation.findMany({
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true },
      }),
      this.prisma.order.findMany({
        where: {
          deliveryDate: toDbDate(date),
          OR: [
            { status: { in: ['CONFIRMED', 'DELIVERED'] } },
            // FR-KIT-08: cancelled after work started stays visible as "do not cook".
            { status: { in: ['CANCELLED', 'REJECTED'] }, kitchenStartedAt: { not: null } },
          ],
        },
        select: {
          id: true,
          number: true,
          status: true,
          notes: true,
          plannedKitchenReadyAt: true,
          plannedDispatchReadyAt: true,
          employee: { select: { name: true, allergies: { select: { allergenId: true } } } },
          company: { select: { name: true } },
          lines: {
            orderBy: { sortOrder: 'asc' },
            select: {
              dishId: true,
              dishName: true,
              dish: {
                select: {
                  kitchenStationId: true,
                  temperature: true,
                  allergens: { select: { allergenId: true } },
                },
              },
              combinations: {
                select: {
                  id: true,
                  quantity: true,
                  prepStartedAt: true,
                  prepDoneAt: true,
                  choices: {
                    orderBy: { sortOrder: 'asc' },
                    select: {
                      optionName: true,
                      portionSizeName: true,
                      option: { select: { allergens: { select: { allergenId: true } } } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);
    // Placed (not yet confirmed) meals for the date, by station: they may still change before the cut-off.
    const cutoffAt = planning.cutoffAt(date);
    const placed = await this.prisma.orderLine.findMany({
      where: { order: { deliveryDate: toDbDate(date), status: 'PLACED' } },
      select: { quantity: true, dish: { select: { kitchenStationId: true } } },
    });
    const stationName = new Map(stations.map((s) => [s.id, s.name]));
    const window = planning.settings.atRiskWindowMinutes;

    const all: KitchenUnitDto[] = [];
    for (const o of orders) {
      const allergies = new Set(o.employee.allergies.map((a) => a.allergenId));
      const doNotCook = o.status === 'CANCELLED' || o.status === 'REJECTED';
      for (const line of o.lines) {
        for (const c of line.combinations) {
          const ids = new Set(line.dish.allergens.map((a) => a.allergenId));
          for (const ch of c.choices) for (const a of ch.option.allergens) ids.add(a.allergenId);
          all.push({
            id: c.id,
            order: {
              id: o.id,
              number: o.number,
              status: o.status,
              notes: o.notes,
              employeeName: o.employee.name,
              companyName: o.company.name,
            },
            dish: { id: line.dishId, name: line.dishName, temperature: line.dish.temperature },
            stationId: line.dish.kitchenStationId,
            quantity: c.quantity,
            choices: c.choices.map((ch) =>
              ch.portionSizeName ? `${ch.optionName} (${ch.portionSizeName})` : ch.optionName,
            ),
            plannedKitchenReadyAt: o.plannedKitchenReadyAt.toISOString(),
            plannedDispatchReadyAt: o.plannedDispatchReadyAt.toISOString(),
            prepStartedAt: c.prepStartedAt?.toISOString() ?? null,
            prepDoneAt: c.prepDoneAt?.toISOString() ?? null,
            timeliness: doNotCook
              ? 'DONE'
              : timeliness(o.plannedKitchenReadyAt, c.prepDoneAt, now, window),
            allergenIds: [...ids].filter((id) => allergies.has(id)),
            containsAllergenIds: [...ids],
            doNotCook,
          });
        }
      }
    }

    // Station chips count every unit; the rest of the board follows the station filter.
    const stationRows = [
      ...stations.map((s) => ({ id: s.id as string | null, name: s.name })),
      { id: null, name: UNASSIGNED },
    ]
      .map((s) => {
        const units = all.filter((u) => u.stationId === s.id && !u.doNotCook);
        return { ...s, total: units.length, remaining: units.filter((u) => !u.prepDoneAt).length };
      })
      .filter((s) => s.total > 0 || s.id !== null);
    const wanted = query.stationId === 'unassigned' ? null : query.stationId;
    const units = query.stationId === undefined ? all : all.filter((u) => u.stationId === wanted);
    const work = units.filter((u) => !u.doNotCook);

    const slots = new Map<string, KitchenUnitDto[]>();
    for (const u of [...units].sort(
      (a, b) =>
        a.plannedKitchenReadyAt.localeCompare(b.plannedKitchenReadyAt) ||
        a.order.number - b.order.number,
    )) {
      const list = slots.get(u.plannedKitchenReadyAt) ?? [];
      list.push(u);
      slots.set(u.plannedKitchenReadyAt, list);
    }

    // FR-KIT-06 prep summary.
    const prep = new Map<
      string,
      {
        stationId: string | null;
        stationName: string;
        dishes: Map<string, { quantity: number; combos: Map<string, number> }>;
      }
    >();
    for (const u of work) {
      const key = u.stationId ?? 'none';
      const station = prep.get(key) ?? {
        stationId: u.stationId,
        stationName: u.stationId ? (stationName.get(u.stationId) ?? 'Station') : UNASSIGNED,
        dishes: new Map(),
      };
      const dish = station.dishes.get(u.dish.name) ?? {
        quantity: 0,
        combos: new Map<string, number>(),
      };
      dish.quantity += u.quantity;
      const label = u.choices.join(', ') || 'As is';
      dish.combos.set(label, (dish.combos.get(label) ?? 0) + u.quantity);
      station.dishes.set(u.dish.name, dish);
      prep.set(key, station);
    }

    const placedByStation = new Map<string, number>();
    for (const l of placed) {
      const name = l.dish.kitchenStationId
        ? (stationName.get(l.dish.kitchenStationId) ?? 'Station')
        : UNASSIGNED;
      placedByStation.set(name, (placedByStation.get(name) ?? 0) + l.quantity);
    }

    return {
      date,
      now: now.toISOString(),
      pending: {
        cutoffAt: cutoffAt.toISOString(),
        cutoffPassed: now.getTime() >= cutoffAt.getTime(),
        placedMealsByStation: [...placedByStation.entries()].map(([stationName, meals]) => ({
          stationName,
          meals,
        })),
      },
      stations: stationRows,
      summary: {
        units: work.length,
        done: work.filter((u) => u.prepDoneAt).length,
        inProgress: work.filter((u) => u.prepStartedAt && !u.prepDoneAt).length,
        queued: work.filter((u) => !u.prepStartedAt).length,
        late: work.filter((u) => u.timeliness === 'LATE').length,
        atRisk: work.filter((u) => u.timeliness === 'AT_RISK').length,
        orders: new Set(work.map((u) => u.order.id)).size,
      },
      slots: [...slots.entries()].map(([plannedKitchenReadyAt, list]) => ({
        plannedKitchenReadyAt,
        units: list,
      })),
      prep: [...prep.values()]
        .sort((a, b) => a.stationName.localeCompare(b.stationName))
        .map((s) => ({
          stationId: s.stationId,
          stationName: s.stationName,
          dishes: [...s.dishes.entries()]
            .sort((a, b) => b[1].quantity - a[1].quantity)
            .map(([dishName, d]) => ({
              dishName,
              quantity: d.quantity,
              combinations: [...d.combos.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([label, quantity]) => ({ label, quantity })),
            })),
        })),
    };
  }

  /** BR-KIT-01/02/05: start a unit that hasn't started, on a confirmed order. */
  async start(unitId: string, actor: CurrentUserInfo): Promise<{ id: string }> {
    await this.prisma.$transaction(async (tx) => {
      const { orderId } = await this.lockUnitOrder(tx, unitId);
      const now = this.clock.now();
      const updated = await tx.orderCombination.updateMany({
        where: { id: unitId, prepStartedAt: null },
        data: { prepStartedAt: now, prepStartedById: actor.id },
      });
      if (updated.count === 0)
        throw new DomainError('UNIT_ALREADY_STARTED', 'Someone already started this item.');
      await this.markOrderStarted(tx, orderId, now, actor);
    });
    return { id: unitId };
  }

  /** BR-KIT-02/03/05: finish a unit (recording the start if it never started). */
  async done(unitId: string, actor: CurrentUserInfo): Promise<{ id: string; orderReady: boolean }> {
    let orderReady = false;
    await this.prisma.$transaction(async (tx) => {
      const { orderId } = await this.lockUnitOrder(tx, unitId);
      const now = this.clock.now();
      const unit = await tx.orderCombination.findUniqueOrThrow({
        where: { id: unitId },
        select: { prepStartedAt: true, prepDoneAt: true },
      });
      if (unit.prepDoneAt)
        throw new DomainError('UNIT_ALREADY_DONE', 'Someone already finished this item.');
      await tx.orderCombination.update({
        where: { id: unitId },
        data: {
          prepDoneAt: now,
          prepDoneById: actor.id,
          ...(unit.prepStartedAt ? {} : { prepStartedAt: now, prepStartedById: actor.id }),
        },
      });
      await this.markOrderStarted(tx, orderId, now, actor);
      orderReady = await this.markReadyIfComplete(tx, orderId, now, actor, 'KITCHEN_READY');
    });
    return { id: unitId, orderReady };
  }

  /** BR-KIT-04 (admin): every remaining unit done now. */
  async forceComplete(orderId: string, actor: CurrentUserInfo): Promise<{ id: string }> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, orderId);
      const now = this.clock.now();
      await tx.orderCombination.updateMany({
        where: { line: { orderId }, prepStartedAt: null },
        data: { prepStartedAt: now, prepStartedById: actor.id },
      });
      const updated = await tx.orderCombination.updateMany({
        where: { line: { orderId }, prepDoneAt: null },
        data: { prepDoneAt: now, prepDoneById: actor.id },
      });
      if (updated.count === 0)
        throw new DomainError('INVALID_TRANSITION', 'Everything on this order is already done.');
      await this.markOrderStarted(tx, orderId, now, actor);
      await this.markReadyIfComplete(tx, orderId, now, actor, 'KITCHEN_FORCE_COMPLETED');
    });
    return { id: orderId };
  }

  /** Locks the unit's order row, so actions on one order are serialised (BR-KIT-05). */
  private async lockUnitOrder(tx: Tx, unitId: string): Promise<{ orderId: string }> {
    const unit = await tx.orderCombination.findUnique({
      where: { id: unitId },
      select: { line: { select: { orderId: true } } },
    });
    if (!unit) throw new DomainError('NOT_FOUND', 'That item no longer exists.');
    await this.lockOrder(tx, unit.line.orderId);
    return { orderId: unit.line.orderId };
  }

  private async lockOrder(tx: Tx, orderId: string): Promise<void> {
    const rows = await tx.$queryRaw<
      Array<{ status: string }>
    >`SELECT status::text AS status FROM "Order" WHERE id = ${orderId}::uuid FOR UPDATE`;
    if (rows.length === 0) throw new DomainError('NOT_FOUND', 'Order not found.');
    if (rows[0]!.status !== 'CONFIRMED')
      throw new DomainError(
        'INVALID_TRANSITION',
        `Only confirmed orders can be cooked; this one is ${rows[0]!.status.toLowerCase()}.`,
      );
    // A person is working this order now: the demo autopilot stops touching it.
    await tx.order.update({ where: { id: orderId }, data: { demoAutopilotUntil: null } });
  }

  private async markOrderStarted(
    tx: Tx,
    orderId: string,
    now: Date,
    actor: CurrentUserInfo,
  ): Promise<void> {
    const updated = await tx.order.updateMany({
      where: { id: orderId, kitchenStartedAt: null },
      data: { kitchenStartedAt: now },
    });
    if (updated.count > 0)
      await tx.orderEvent.create({
        data: {
          orderId,
          type: 'KITCHEN_STARTED',
          at: now,
          actorId: actor.id,
          actorLabel: actor.name,
        },
      });
  }

  /** BR-KIT-03: kitchen-ready only once every unit is done. */
  private async markReadyIfComplete(
    tx: Tx,
    orderId: string,
    now: Date,
    actor: CurrentUserInfo,
    type: 'KITCHEN_READY' | 'KITCHEN_FORCE_COMPLETED',
  ): Promise<boolean> {
    const remaining = await tx.orderCombination.count({
      where: { line: { orderId }, prepDoneAt: null },
    });
    if (remaining > 0) return false;
    const updated = await tx.order.updateMany({
      where: { id: orderId, kitchenReadyAt: null },
      data: { kitchenReadyAt: now },
    });
    if (updated.count > 0)
      await tx.orderEvent.create({
        data: { orderId, type, at: now, actorId: actor.id, actorLabel: actor.name },
      });
    return true;
  }
}
