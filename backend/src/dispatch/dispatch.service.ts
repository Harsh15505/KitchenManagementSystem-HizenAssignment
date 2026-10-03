import { Injectable } from '@nestjs/common';
import {
  type CalendarDate,
  calendarDate,
  type DeliverDropInput,
  type DispatchBoardDto,
  type DispatchBoardQuery,
  type DropDto,
  type DropStage,
  fromDbDate,
  PHOTO_MAX_BYTES,
  timeliness,
  toDbDate,
} from '@fernleaf/shared';
import type { CurrentUserInfo } from '../authz/current-user';
import { ClockService } from '../clock/clock.service';
import { DomainError } from '../common/domain-error';
import { assertDriver, listDrivers } from '../companies/drivers';
import type { Prisma } from '../generated/prisma/client';
import { PlanningService } from '../orders/planning.service';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;
type EventType = Prisma.OrderEventCreateManyInput['type'];

const dropSelect = {
  id: true,
  deliveryDate: true,
  deliveryTimeMinutes: true,
  deliveryAt: true,
  dispatchReadyAt: true,
  outForDeliveryAt: true,
  deliveredAt: true,
  deliveredOnTime: true,
  deliveryNote: true,
  driver: { select: { id: true, name: true } },
  company: { select: { id: true, name: true, driverInstructions: true } },
  address: {
    select: {
      label: true,
      line1: true,
      line2: true,
      city: true,
      postalCode: true,
      accessNotes: true,
    },
  },
  photo: { select: { id: true } },
  orders: {
    where: { status: { in: ['CONFIRMED', 'DELIVERED'] } },
    orderBy: { number: 'asc' },
    select: {
      id: true,
      number: true,
      kitchenReadyAt: true,
      plannedDispatchReadyAt: true,
      packagingName: true,
      employee: { select: { name: true } },
      lines: { select: { quantity: true } },
    },
  },
} satisfies Prisma.DropSelect;

type DropRow = Prisma.DropGetPayload<{ select: typeof dropSelect }>;

/** FR-DSP-01..05, BR-DSP-01..07 (TRD §8.6). */
@Injectable()
export class DispatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly planning: PlanningService,
  ) {}

  async board(query: DispatchBoardQuery): Promise<DispatchBoardDto> {
    const date = query.date ? calendarDate(query.date) : this.clock.today();
    const [planning, rows, drivers] = await Promise.all([
      this.planning.load(),
      this.prisma.drop.findMany({
        where: {
          deliveryDate: toDbDate(date),
          orders: { some: { status: { in: ['CONFIRMED', 'DELIVERED'] } } },
        },
        orderBy: [{ deliveryAt: 'asc' }],
        select: dropSelect,
      }),
      listDrivers(this.prisma),
    ]);
    const now = this.clock.now();
    const all = rows.map((r) => this.toDto(r, now, planning.settings.atRiskWindowMinutes));
    const drops = all.filter(
      (d) =>
        (!query.stage || d.stage === query.stage) &&
        (!query.driverId ||
          (query.driverId === 'unassigned' ? d.driver === null : d.driver?.id === query.driverId)),
    );
    const count = (stage: DropStage) => all.filter((d) => d.stage === stage).length;
    return {
      date,
      now: now.toISOString(),
      summary: {
        drops: all.length,
        COOKING: count('COOKING'),
        KITCHEN_READY: count('KITCHEN_READY'),
        DISPATCH_READY: count('DISPATCH_READY'),
        OUT_FOR_DELIVERY: count('OUT_FOR_DELIVERY'),
        DELIVERED: count('DELIVERED'),
        late: all.filter((d) => d.timeliness === 'LATE').length,
        atRisk: all.filter((d) => d.timeliness === 'AT_RISK').length,
        unassigned: all.filter((d) => !d.driver && d.stage !== 'DELIVERED').length,
      },
      drops,
      drivers: drivers.map((d) => ({ id: d.id, name: d.name })),
    };
  }

  /** BR-DSP-07: a driver sees only their own drops, for today. */
  async driverDrops(actor: CurrentUserInfo): Promise<{ date: CalendarDate; drops: DropDto[] }> {
    const date = this.clock.today();
    const [planning, rows] = await Promise.all([
      this.planning.load(),
      this.prisma.drop.findMany({
        where: {
          driverId: actor.id,
          deliveryDate: toDbDate(date),
          orders: { some: { status: { in: ['CONFIRMED', 'DELIVERED'] } } },
        },
        orderBy: [{ deliveryAt: 'asc' }],
        select: dropSelect,
      }),
    ]);
    const now = this.clock.now();
    return {
      date,
      drops: rows.map((r) => this.toDto(r, now, planning.settings.atRiskWindowMinutes)),
    };
  }

  /** FR-DSP-03: assign or reassign (or clear) the driver, until the drop has left. */
  async assignDriver(
    dropId: string,
    driverId: string | null,
    actor: CurrentUserInfo,
  ): Promise<{ id: string }> {
    if (driverId) await assertDriver(this.prisma, driverId);
    await this.prisma.$transaction(async (tx) => {
      const drop = await this.lockDrop(tx, dropId);
      if (drop.outForDeliveryAt)
        throw new DomainError(
          'DROP_ALREADY_DISPATCHED',
          'The drop has already left; the driver can’t change now.',
        );
      await tx.drop.update({ where: { id: dropId }, data: { driverId } });
      const name = driverId
        ? (await tx.user.findUniqueOrThrow({ where: { id: driverId }, select: { name: true } }))
            .name
        : null;
      await this.events(tx, dropId, 'DRIVER_ASSIGNED', actor, { driver: name });
    });
    return { id: dropId };
  }

  /** BR-DSP-02: packed and waiting, once every active order in the drop is cooked. */
  async markReady(dropId: string, actor: CurrentUserInfo): Promise<{ id: string }> {
    await this.prisma.$transaction(async (tx) => {
      const drop = await this.lockDrop(tx, dropId);
      if (drop.dispatchReadyAt)
        throw new DomainError('INVALID_TRANSITION', 'The drop is already marked ready.');
      const waiting = await tx.order.count({
        where: { dropId, status: 'CONFIRMED', kitchenReadyAt: null },
      });
      if (waiting > 0)
        throw new DomainError(
          'DROP_NOT_READY',
          `${waiting} order${waiting === 1 ? ' is' : 's are'} still in the kitchen.`,
        );
      await tx.drop.update({ where: { id: dropId }, data: { dispatchReadyAt: this.clock.now() } });
      await this.events(tx, dropId, 'DISPATCH_READY', actor);
    });
    return { id: dropId };
  }

  /** BR-DSP-03: leaves the kitchen, which needs a ready drop and a driver. */
  async markOut(dropId: string, actor: CurrentUserInfo): Promise<{ id: string }> {
    await this.prisma.$transaction(async (tx) => {
      const drop = await this.lockDrop(tx, dropId);
      if (!drop.dispatchReadyAt)
        throw new DomainError('INVALID_TRANSITION', 'Mark the drop ready before sending it out.');
      if (drop.outForDeliveryAt)
        throw new DomainError('INVALID_TRANSITION', 'The drop is already out for delivery.');
      if (!drop.driverId)
        throw new DomainError('DRIVER_REQUIRED', 'Assign a driver before sending the drop out.');
      await tx.drop.update({ where: { id: dropId }, data: { outForDeliveryAt: this.clock.now() } });
      await this.events(tx, dropId, 'OUT_FOR_DELIVERY', actor);
    });
    return { id: dropId };
  }

  /**
   * BR-DSP-04/05: delivered, by the assigned driver (own drops, today only) or by dispatch.
   * Every active order becomes Delivered; on-time is stored once and never recomputed.
   */
  async deliver(
    dropId: string,
    input: DeliverDropInput,
    actor: CurrentUserInfo,
    asDriver: boolean,
  ): Promise<{ id: string; onTime: boolean }> {
    let photo: { mimeType: string; data: Buffer } | null = null;
    if (input.photo) {
      const data = Buffer.from(input.photo.dataBase64, 'base64');
      if (data.length === 0 || data.length > PHOTO_MAX_BYTES)
        throw new DomainError('VALIDATION_FAILED', 'The photo must be an image under 5 MB.');
      photo = { mimeType: input.photo.mimeType, data };
    }
    const planning = await this.planning.load();
    let onTime = false;
    await this.prisma.$transaction(async (tx) => {
      const drop = await this.lockDrop(tx, dropId);
      if (
        asDriver &&
        (drop.driverId !== actor.id || fromDbDate(drop.deliveryDate) !== this.clock.today())
      )
        throw new DomainError('NOT_FOUND', 'Drop not found.');
      if (!drop.outForDeliveryAt)
        throw new DomainError('INVALID_TRANSITION', 'The drop isn’t out for delivery yet.');
      if (drop.deliveredAt)
        throw new DomainError('INVALID_TRANSITION', 'The drop is already delivered.');
      const now = this.clock.now();
      onTime =
        now.getTime() <= drop.deliveryAt.getTime() + planning.settings.onTimeGraceMinutes * 60_000;
      await tx.drop.update({
        where: { id: dropId },
        data: {
          deliveredAt: now,
          deliveredById: actor.id,
          deliveredOnTime: onTime,
          deliveryNote: input.note?.trim() || null,
        },
      });
      if (photo)
        await tx.deliveryPhoto.create({
          data: {
            dropId,
            mimeType: photo.mimeType,
            sizeBytes: photo.data.length,
            data: new Uint8Array(photo.data),
          },
        });
      await tx.order.updateMany({
        where: { dropId, status: 'CONFIRMED' },
        data: { status: 'DELIVERED', deliveredAt: now },
      });
      await this.events(
        tx,
        dropId,
        'DELIVERED',
        actor,
        { onTime, note: input.note?.trim() || undefined },
        ['DELIVERED'],
      );
    });
    return { id: dropId, onTime };
  }

  /** T-706: the proof-of-delivery photo, for dispatch or the drop's own driver. */
  async photo(dropId: string, actor: CurrentUserInfo): Promise<{ mimeType: string; data: Buffer }> {
    const drop = await this.prisma.drop.findUnique({
      where: { id: dropId },
      select: { driverId: true, photo: { select: { mimeType: true, data: true } } },
    });
    const allowed = actor.ability.can('read', 'DispatchBoard') || drop?.driverId === actor.id;
    if (!drop?.photo || !allowed) throw new DomainError('NOT_FOUND', 'No photo for this drop.');
    return { mimeType: drop.photo.mimeType, data: Buffer.from(drop.photo.data) };
  }

  private toDto(r: DropRow, now: Date, windowMinutes: number): DropDto {
    const ready = r.orders.filter((o) => o.kitchenReadyAt).length;
    const plannedDispatchReadyAt = r.orders.reduce(
      (min, o) => (o.plannedDispatchReadyAt < min ? o.plannedDispatchReadyAt : min),
      r.orders[0]?.plannedDispatchReadyAt ?? r.deliveryAt,
    );
    const stage: DropStage = r.deliveredAt
      ? 'DELIVERED'
      : r.outForDeliveryAt
        ? 'OUT_FOR_DELIVERY'
        : r.dispatchReadyAt
          ? 'DISPATCH_READY'
          : ready === r.orders.length && r.orders.length > 0
            ? 'KITCHEN_READY'
            : 'COOKING';
    return {
      id: r.id,
      company: { id: r.company.id, name: r.company.name },
      address: r.address,
      driverInstructions: r.company.driverInstructions,
      deliveryDate: fromDbDate(r.deliveryDate),
      deliveryTimeMinutes: r.deliveryTimeMinutes,
      deliveryAt: r.deliveryAt.toISOString(),
      plannedDispatchReadyAt: plannedDispatchReadyAt.toISOString(),
      driver: r.driver,
      stage,
      readiness: { ready, total: r.orders.length },
      boxes: r.orders.reduce((s, o) => s + o.lines.reduce((t, l) => t + l.quantity, 0), 0),
      orders: r.orders.map((o) => ({
        id: o.id,
        number: o.number,
        employeeName: o.employee.name,
        itemCount: o.lines.reduce((t, l) => t + l.quantity, 0),
        kitchenReady: o.kitchenReadyAt !== null,
        packaging: o.packagingName,
      })),
      dispatchReadyAt: r.dispatchReadyAt?.toISOString() ?? null,
      outForDeliveryAt: r.outForDeliveryAt?.toISOString() ?? null,
      deliveredAt: r.deliveredAt?.toISOString() ?? null,
      deliveredOnTime: r.deliveredOnTime,
      deliveryNote: r.deliveryNote,
      hasPhoto: r.photo !== null,
      timeliness: timeliness(plannedDispatchReadyAt, r.outForDeliveryAt, now, windowMinutes),
    };
  }

  /** Serialises actions on one drop (and clears the demo autopilot: a person is handling it). */
  private async lockDrop(tx: Tx, dropId: string) {
    const rows = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT id FROM "Drop" WHERE id = ${dropId}::uuid FOR UPDATE`;
    if (rows.length === 0) throw new DomainError('NOT_FOUND', 'Drop not found.');
    await tx.order.updateMany({
      where: { dropId, demoAutopilotUntil: { not: null } },
      data: { demoAutopilotUntil: null },
    });
    return tx.drop.findUniqueOrThrow({
      where: { id: dropId },
      select: {
        driverId: true,
        deliveryDate: true,
        deliveryAt: true,
        dispatchReadyAt: true,
        outForDeliveryAt: true,
        deliveredAt: true,
      },
    });
  }

  /** BR-ORD-07: every order in the drop gets the timeline entry. */
  private async events(
    tx: Tx,
    dropId: string,
    type: EventType,
    actor: CurrentUserInfo,
    data?: Prisma.InputJsonValue,
    statuses: Array<'CONFIRMED' | 'DELIVERED'> = ['CONFIRMED'],
  ): Promise<void> {
    const orders = await tx.order.findMany({
      where: { dropId, status: { in: statuses } },
      select: { id: true },
    });
    await tx.orderEvent.createMany({
      data: orders.map((o) => ({
        orderId: o.id,
        type,
        actorId: actor.id,
        actorLabel: actor.name,
        data,
      })),
    });
  }
}
