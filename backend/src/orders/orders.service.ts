import { Injectable } from '@nestjs/common';
import {
  type CalendarDate,
  type CapturedCombination,
  type CreateOrderInput,
  calendarDate,
  cancellationCredit,
  capturedKey,
  type DeliveryOverrideInput,
  deliverableDates,
  type FieldErrors,
  isValidDeliveryTime,
  type LineInput,
  minutesToHHmm,
  type NormalisedLine,
  normaliseOrder,
  type OrderContextDto,
  type OrderQuoteDto,
  type OrderReasonInput,
  type OrderStatus,
  orderableDishes,
  planTimes,
  type QuoteOrderInput,
  resolveEmployeeMenu,
  toDbDate,
  toInstant,
  UNDELIVERABLE_MESSAGE,
  undeliverableReason,
  type UpdateOrderInput,
} from '@fernleaf/shared';
import type { CurrentUserInfo } from '../authz/current-user';
import { ClockService } from '../clock/clock.service';
import { DomainError } from '../common/domain-error';
import type { Prisma } from '../generated/prisma/client';
import { type EmployeeMenuContext, MenuInputService } from '../menu/menu-input.service';
import { PrismaService } from '../prisma/prisma.service';
import { assignDrop, removeDropIfEmpty } from './drops';
import { type Planning, PlanningService } from './planning.service';

type Tx = Prisma.TransactionClient;

interface DeliveryFields {
  deliveryDate: string;
  deliveryTimeMinutes: number | null;
  addressId: string | null;
  packagingTypeId: string | null;
}

interface Prepared {
  ctx: EmployeeMenuContext;
  planning: Planning;
  date: CalendarDate;
  locked: boolean;
  cutoffAt: Date;
  delivery: {
    timeMinutes: number;
    deliveryAt: Date;
    address: { id: string; label: string; snapshot: Prisma.InputJsonValue };
    packaging: { id: string; name: string };
    plannedDispatchReadyAt: Date;
    plannedKitchenReadyAt: Date;
  };
  lines: NormalisedLine[];
  totalCents: number;
  warnings: OrderQuoteDto['warnings'];
}

const ACTIVE_UNTIL_LOCK: OrderStatus[] = ['DRAFT', 'PLACED'];

/** FR-ORD-02..05/08/09: the order lifecycle, every rule checked here (FR-ORD-03). */
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly menuInput: MenuInputService,
    private readonly planning: PlanningService,
  ) {}

  /** T-504: everything the builder needs for one employee. */
  async context(employeeId: string, actor: CurrentUserInfo): Promise<OrderContextDto> {
    const ctx = await this.menuInput.forEmployee(employeeId);
    const [planning, calendar, company, packaging] = await Promise.all([
      this.planning.load(),
      this.planning.companyCalendar(ctx.employee.company.id),
      this.companyDefaults(ctx.employee.company.id),
      this.prisma.packagingType.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true },
      }),
    ]);
    const flags = await this.prisma.employee.findUniqueOrThrow({
      where: { id: employeeId },
      select: { canChooseAddress: true, canChangeDeliveryTime: true, canChangePackaging: true },
    });
    const dates = deliverableDates(
      this.clock.now(),
      21,
      planning.cutoff,
      planning.kitchen,
      calendar,
    );
    return {
      employee: {
        id: ctx.employee.id,
        name: ctx.employee.name,
        email: ctx.employee.email,
        allergenIds: ctx.employee.allergenIds,
        dietaryTagIds: ctx.employee.dietaryTagIds,
        ...flags,
      },
      company: { id: ctx.employee.company.id, name: ctx.employee.company.name },
      tier: { id: ctx.tier.id, name: ctx.tier.name },
      defaults: {
        addressId: company.defaultAddressId,
        deliveryTimeMinutes: company.defaultDeliveryTimeMinutes,
        packagingTypeId: company.defaultPackagingTypeId,
      },
      addresses: company.addresses.map((a) => ({
        id: a.id,
        label: a.label,
        isDefault: a.id === company.defaultAddressId,
      })),
      packagingTypes: packaging,
      window: {
        startMinutes: planning.settings.deliveryWindowStartMin,
        endMinutes: planning.settings.deliveryWindowEndMin,
        slotMinutes: planning.settings.deliverySlotMinutes,
      },
      dates: dates.map((d) => ({
        date: d.date,
        cutoffAt: d.cutoffAt.toISOString(),
        locked: d.locked,
      })),
      canOverride: actor.ability.can('override', 'Order'),
      menu: resolveEmployeeMenu(ctx.input),
    };
  }

  /** T-505: full validation and pricing, nothing saved. */
  async quote(input: QuoteOrderInput, actor: CurrentUserInfo): Promise<OrderQuoteDto> {
    let captured = new Map<string, CapturedCombination>();
    if (input.orderId) {
      const existing = await this.loadForEdit(input.orderId);
      if (existing.employeeId !== input.employeeId)
        throw new DomainError(
          'VALIDATION_FAILED',
          'An order keeps its employee; create a new order instead.',
        );
      captured = capturedFrom(existing);
    }
    const p = await this.prepare(input.employeeId, input, input.lines, captured);
    return this.toQuote(p, this.resultingStatus(p, input.place, actor, Boolean(input.orderId)));
  }

  /** T-506: Draft or Placed before the cut-off; a late admin order is created Confirmed. */
  async create(input: CreateOrderInput, actor: CurrentUserInfo): Promise<{ id: string }> {
    const p = await this.prepare(input.employeeId, input, input.lines, new Map());
    const status = this.resultingStatus(p, input.place, actor, false);
    this.assertAllergenAck(p, status, input.allergenAcknowledged);
    const now = this.clock.now();

    const id = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          status,
          employeeId: p.ctx.employee.id,
          companyId: p.ctx.employee.company.id,
          ...this.deliveryData(p),
          priceTierId: p.ctx.tier.id,
          priceTierName: p.ctx.tier.name,
          totalCents: p.totalCents,
          notes: input.notes,
          allergenAcknowledged: input.allergenAcknowledged,
          placedAt: status === 'DRAFT' ? null : now,
          confirmedAt: status === 'CONFIRMED' ? now : null,
          createdById: actor.id,
        },
        select: { id: true },
      });
      await this.writeLines(tx, order.id, p.lines);
      const events: Prisma.OrderEventCreateManyInput[] = [
        {
          orderId: order.id,
          type: 'CREATED',
          actorId: actor.id,
          actorLabel: actor.name,
          data: { status },
        },
      ];
      if (status === 'PLACED')
        events.push({
          orderId: order.id,
          type: 'PLACED',
          actorId: actor.id,
          actorLabel: actor.name,
        });
      if (status === 'CONFIRMED')
        events.push({
          orderId: order.id,
          type: 'LATE_ORDER_CONFIRMED',
          actorId: actor.id,
          actorLabel: actor.name,
          data: { cutoffAt: p.cutoffAt.toISOString() },
        });
      await tx.orderEvent.createMany({ data: events });
      if (status === 'CONFIRMED') await this.attachDrop(tx, order.id, p, true, actor);
      return order.id;
    });
    return { id };
  }

  /** T-508: edit a Draft or Placed order before the cut-off (optimistic concurrency). */
  async update(
    id: string,
    input: UpdateOrderInput,
    actor: CurrentUserInfo,
  ): Promise<{ id: string }> {
    const existing = await this.loadForEdit(id);
    this.assertVersion(existing.version, input.version);
    if (!ACTIVE_UNTIL_LOCK.includes(existing.status))
      throw new DomainError(
        'INVALID_TRANSITION',
        `A ${existing.status.toLowerCase()} order can't be edited (A-19).`,
      );
    const p = await this.prepare(existing.employeeId, input, input.lines, capturedFrom(existing));
    if (p.ctx.employee.company.id !== existing.companyId)
      throw new DomainError(
        'BUSINESS_RULE_VIOLATION',
        'The employee has moved company since this order was created. Cancel it and create a new one.',
      );
    // The lock is checked for the order's current date AND the new one.
    if (p.locked || p.planning.isLocked(calendarDate(fromDb(existing.deliveryDate))))
      throw new DomainError(
        'ORDER_LOCKED',
        'Ordering for that date has closed; the order can no longer be edited.',
      );
    this.assertAllergenAck(p, existing.status, input.allergenAcknowledged);

    await this.prisma.$transaction(async (tx) => {
      await this.bumpVersion(tx, id, input.version);
      await tx.orderLine.deleteMany({ where: { orderId: id } });
      await this.writeLines(tx, id, p.lines);
      await tx.order.update({
        where: { id },
        data: {
          ...this.deliveryData(p),
          totalCents: p.totalCents,
          notes: input.notes,
          allergenAcknowledged: input.allergenAcknowledged,
        },
      });
      await tx.orderEvent.create({
        data: {
          orderId: id,
          type: 'UPDATED',
          actorId: actor.id,
          actorLabel: actor.name,
          data: { totalCents: p.totalCents },
        },
      });
    });
    return { id };
  }

  async place(id: string, version: number, actor: CurrentUserInfo): Promise<{ id: string }> {
    const existing = await this.loadForEdit(id);
    this.assertVersion(existing.version, version);
    if (existing.status !== 'DRAFT')
      throw new DomainError('INVALID_TRANSITION', 'Only a draft can be placed.');
    const date = calendarDate(fromDb(existing.deliveryDate));
    // Re-validate against today's menu (captured prices stay), so a stale draft can't slip through.
    const p = await this.prepare(
      existing.employeeId,
      {
        deliveryDate: date,
        deliveryTimeMinutes: existing.deliveryTimeMinutes,
        addressId: existing.addressId,
        packagingTypeId: existing.packagingTypeId,
      },
      linesFrom(existing),
      capturedFrom(existing),
      { keepDelivery: true },
    );
    if (p.locked)
      throw new DomainError(
        'ORDER_LOCKED',
        'Ordering for that date has closed; the draft can no longer be placed.',
      );
    this.assertAllergenAck(p, 'PLACED', existing.allergenAcknowledged);
    await this.prisma.$transaction(async (tx) => {
      await this.bumpVersion(tx, id, version);
      await tx.order.update({
        where: { id },
        data: { status: 'PLACED', placedAt: this.clock.now() },
      });
      await tx.orderEvent.create({
        data: { orderId: id, type: 'PLACED', actorId: actor.id, actorLabel: actor.name },
      });
    });
    return { id };
  }

  /** BR-ORD-02/03/06: staff cancel before the cut-off; after it (or once confirmed) only admins. */
  async cancel(
    id: string,
    input: OrderReasonInput,
    actor: CurrentUserInfo,
  ): Promise<{ id: string }> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: { status: true, version: true, deliveryDate: true, dropId: true },
    });
    if (!order) throw new DomainError('NOT_FOUND', 'Order not found.');
    this.assertVersion(order.version, input.version);
    if (order.status === 'DELIVERED')
      throw new DomainError(
        'INVALID_TRANSITION',
        'A delivered order can’t be cancelled; record a shortage instead.',
      );
    if (order.status === 'CANCELLED' || order.status === 'REJECTED')
      throw new DomainError(
        'INVALID_TRANSITION',
        `The order is already ${order.status.toLowerCase()}.`,
      );
    const planning = await this.planning.load();
    const locked = planning.isLocked(calendarDate(fromDb(order.deliveryDate)));
    if ((locked || order.status === 'CONFIRMED') && !actor.ability.can('override', 'Order'))
      throw new DomainError(
        'ORDER_LOCKED',
        'Ordering for that date has closed; only an admin can cancel it now.',
      );
    await this.finish(id, input.version, 'CANCELLED', input.reason, order.dropId, actor);
    return { id };
  }

  /** FR-ORD-09 / A-20: the business refuses a Placed or Confirmed order it can't fulfil. */
  async reject(
    id: string,
    input: OrderReasonInput,
    actor: CurrentUserInfo,
  ): Promise<{ id: string }> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: { status: true, version: true, dropId: true },
    });
    if (!order) throw new DomainError('NOT_FOUND', 'Order not found.');
    this.assertVersion(order.version, input.version);
    if (order.status !== 'PLACED' && order.status !== 'CONFIRMED')
      throw new DomainError(
        'INVALID_TRANSITION',
        'Only placed or confirmed orders can be rejected.',
      );
    await this.finish(id, input.version, 'REJECTED', input.reason, order.dropId, actor);
    return { id };
  }

  /** FR-ORD-08 / BR-ORD-05: admin changes delivery details until the drop leaves. Flags don't apply. */
  async overrideDelivery(
    id: string,
    input: DeliveryOverrideInput,
    actor: CurrentUserInfo,
  ): Promise<{ id: string }> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: {
        status: true,
        version: true,
        companyId: true,
        deliveryDate: true,
        deliveryTimeMinutes: true,
        addressId: true,
        packagingTypeId: true,
        packagingName: true,
        kitchenReadyAt: true,
        address: { select: { label: true } },
        drop: { select: { outForDeliveryAt: true } },
        company: { select: { dispatchLeadMinutes: true } },
      },
    });
    if (!order) throw new DomainError('NOT_FOUND', 'Order not found.');
    this.assertVersion(order.version, input.version);
    if (order.status !== 'CONFIRMED')
      throw new DomainError('INVALID_TRANSITION', 'Only confirmed orders take delivery overrides.');
    if (order.drop?.outForDeliveryAt)
      throw new DomainError('DROP_ALREADY_DISPATCHED', 'The order is already out for delivery.');

    const planning = await this.planning.load();
    const time = input.deliveryTimeMinutes ?? order.deliveryTimeMinutes;
    this.assertTime(time, planning);
    const address = input.addressId
      ? await this.activeAddress(order.companyId, input.addressId)
      : null;
    const packaging = input.packagingTypeId
      ? await this.activePackaging(input.packagingTypeId)
      : null;
    const date = calendarDate(fromDb(order.deliveryDate));
    const deliveryAt = toInstant(date, time, planning.cutoff.timeZone);
    const plans = planTimes(
      deliveryAt,
      order.company.dispatchLeadMinutes,
      planning.settings.kitchenBufferMinutes,
    );

    await this.prisma.$transaction(async (tx) => {
      await this.bumpVersion(tx, id, input.version);
      await tx.order.update({
        where: { id },
        data: {
          deliveryTimeMinutes: time,
          deliveryAt,
          ...plans,
          ...(address ? { addressId: address.id, addressSnapshot: address.snapshot } : {}),
          ...(packaging ? { packagingTypeId: packaging.id, packagingName: packaging.name } : {}),
        },
      });
      await assignDrop(
        tx,
        {
          orderId: id,
          companyId: order.companyId,
          addressId: address?.id ?? order.addressId,
          deliveryDate: order.deliveryDate,
          deliveryTimeMinutes: time,
          deliveryAt,
          kitchenReady: order.kitchenReadyAt !== null,
        },
        { strict: true, actorId: actor.id, actorLabel: actor.name },
      );
      await tx.orderEvent.create({
        data: {
          orderId: id,
          type: 'DELIVERY_OVERRIDDEN',
          actorId: actor.id,
          actorLabel: actor.name,
          data: {
            before: {
              time: minutesToHHmm(order.deliveryTimeMinutes),
              address: order.address.label,
              packaging: order.packagingName,
            },
            after: {
              time: minutesToHHmm(time),
              address: address?.label ?? order.address.label,
              packaging: packaging?.name ?? order.packagingName,
            },
          },
        },
      });
    });
    return { id };
  }

  // ---------------------------------------------------------------------------------------------

  private async prepare(
    employeeId: string,
    fields: DeliveryFields,
    lines: readonly LineInput[],
    captured: ReadonlyMap<string, CapturedCombination>,
    options: { keepDelivery?: boolean } = {},
  ): Promise<Prepared> {
    const ctx = await this.menuInput.forEmployee(employeeId);
    // BR-ORD-01: active employees of active companies only.
    if (!ctx.employee.isActive)
      throw new DomainError('BUSINESS_RULE_VIOLATION', `${ctx.employee.name} is inactive.`);
    if (!ctx.employee.company.isActive)
      throw new DomainError('BUSINESS_RULE_VIOLATION', `${ctx.employee.company.name} is inactive.`);

    const [planning, calendar, company, flags] = await Promise.all([
      this.planning.load(),
      this.planning.companyCalendar(ctx.employee.company.id),
      this.companyDefaults(ctx.employee.company.id),
      this.prisma.employee.findUniqueOrThrow({
        where: { id: employeeId },
        select: { canChooseAddress: true, canChangeDeliveryTime: true, canChangePackaging: true },
      }),
    ]);

    const date = calendarDate(fields.deliveryDate);
    const reason = undeliverableReason(date, this.clock.today(), planning.kitchen, calendar);
    if (reason)
      throw new DomainError('DATE_NOT_DELIVERABLE', UNDELIVERABLE_MESSAGE[reason], {
        fieldErrors: { deliveryDate: [UNDELIVERABLE_MESSAGE[reason]] },
      });

    // BR-ORD-04: flags decide whether a chosen value is allowed; otherwise the company default.
    const errors: FieldErrors = {};
    const pick = <T>(
      chosen: T | null,
      fallback: T,
      allowed: boolean,
      field: string,
      label: string,
    ): T => {
      if (chosen === null || chosen === fallback) return fallback;
      if (allowed || options.keepDelivery) return chosen;
      errors[field] = [
        `${ctx.employee.name} may not change the ${label}; the company default applies.`,
      ];
      return fallback;
    };
    const time = pick(
      fields.deliveryTimeMinutes,
      company.defaultDeliveryTimeMinutes,
      flags.canChangeDeliveryTime,
      'deliveryTimeMinutes',
      'delivery time',
    );
    const addressId = pick(
      fields.addressId,
      company.defaultAddressId,
      flags.canChooseAddress,
      'addressId',
      'delivery address',
    );
    const packagingId = pick(
      fields.packagingTypeId,
      company.defaultPackagingTypeId,
      flags.canChangePackaging,
      'packagingTypeId',
      'packaging',
    );
    if (Object.keys(errors).length > 0)
      throw new DomainError('FLAG_NOT_ALLOWED', Object.values(errors)[0]![0]!, {
        fieldErrors: errors,
      });
    if (time !== company.defaultDeliveryTimeMinutes) this.assertTime(time, planning);
    const address = await this.activeAddress(company.id, addressId);
    const packaging = await this.activePackaging(packagingId);

    const result = normaliseOrder(lines, orderableDishes(ctx.input), captured);
    if (!result.ok) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.issues) (fieldErrors[issue.path] ??= []).push(issue.message);
      const first = result.issues[0]!;
      throw new DomainError(
        first.code,
        result.issues.length === 1
          ? first.message
          : `${first.message} (${result.issues.length} problems in total)`,
        { fieldErrors },
      );
    }

    const skus = new Map(
      (
        await this.prisma.dish.findMany({
          where: { id: { in: result.lines.map((l) => l.dishId) } },
          select: { id: true, sku: true },
        })
      ).map((d) => [d.id, d.sku]),
    );
    const deliveryAt = toInstant(date, time, planning.cutoff.timeZone);
    const plans = planTimes(
      deliveryAt,
      company.dispatchLeadMinutes,
      planning.settings.kitchenBufferMinutes,
    );
    const cutoffAt = planning.cutoffAt(date);
    return {
      ctx,
      planning,
      date,
      locked: planning.isLocked(date),
      cutoffAt,
      delivery: { timeMinutes: time, deliveryAt, address, packaging, ...plans },
      lines: result.lines.map((l) => ({ ...l, dishSku: l.dishSku ?? skus.get(l.dishId) ?? '' })),
      totalCents: result.totalCents,
      warnings: result.warnings,
    };
  }

  /** BR-ORD-02/03 + A-18: what a save would produce right now. */
  private resultingStatus(
    p: Prepared,
    place: boolean,
    actor: CurrentUserInfo,
    isEdit: boolean,
  ): OrderStatus {
    if (!p.locked) return place ? 'PLACED' : 'DRAFT';
    if (isEdit)
      throw new DomainError(
        'ORDER_LOCKED',
        'Ordering for that date has closed; the order can no longer be edited.',
      );
    if (!actor.ability.can('override', 'Order'))
      throw new DomainError(
        'ORDER_LOCKED',
        `Ordering for ${p.date} closed at the cut-off. Only an admin can add a late order.`,
        {
          fieldErrors: { deliveryDate: ['Cut-off has passed'] },
        },
      );
    if (!place)
      throw new DomainError(
        'ORDER_LOCKED',
        "A draft can't be saved for a date whose cut-off has passed. Place it as a late order instead.",
      );
    return 'CONFIRMED';
  }

  /** FR-ORD-10: placing with allergen clashes needs an explicit acknowledgement. Drafts don't. */
  private assertAllergenAck(p: Prepared, status: OrderStatus, acknowledged: boolean): void {
    if (status !== 'DRAFT' && p.warnings.length > 0 && !acknowledged)
      throw new DomainError(
        'ALLERGEN_ACK_REQUIRED',
        `${p.warnings.map((w) => w.dishName).join(', ')} contain${p.warnings.length === 1 ? 's' : ''} something ${p.ctx.employee.name} is allergic to. Confirm the warning to place the order.`,
        { fieldErrors: { allergenAcknowledged: ['Confirm the allergen warning'] } },
      );
  }

  private toQuote(p: Prepared, status: OrderStatus): OrderQuoteDto {
    return {
      lines: p.lines,
      totalCents: p.totalCents,
      warnings: p.warnings,
      delivery: {
        date: p.date,
        timeMinutes: p.delivery.timeMinutes,
        deliveryAt: p.delivery.deliveryAt.toISOString(),
        address: { id: p.delivery.address.id, label: p.delivery.address.label },
        packaging: p.delivery.packaging,
        plannedDispatchReadyAt: p.delivery.plannedDispatchReadyAt.toISOString(),
        plannedKitchenReadyAt: p.delivery.plannedKitchenReadyAt.toISOString(),
      },
      cutoffAt: p.cutoffAt.toISOString(),
      locked: p.locked,
      resultingStatus: status,
    };
  }

  private deliveryData(p: Prepared) {
    return {
      deliveryDate: toDbDate(p.date),
      deliveryTimeMinutes: p.delivery.timeMinutes,
      deliveryAt: p.delivery.deliveryAt,
      plannedDispatchReadyAt: p.delivery.plannedDispatchReadyAt,
      plannedKitchenReadyAt: p.delivery.plannedKitchenReadyAt,
      addressId: p.delivery.address.id,
      addressSnapshot: p.delivery.address.snapshot,
      packagingTypeId: p.delivery.packaging.id,
      packagingName: p.delivery.packaging.name,
    };
  }

  private async writeLines(tx: Tx, orderId: string, lines: NormalisedLine[]): Promise<void> {
    const sizeIds = [
      ...new Set(
        lines.flatMap((l) =>
          l.combinations.flatMap((c) => c.choices.map((ch) => ch.portionSizeId)).filter(Boolean),
        ),
      ),
    ] as string[];
    const sizeNames = new Map(
      (
        await tx.portionSize.findMany({
          where: { id: { in: sizeIds } },
          select: { id: true, name: true },
        })
      ).map((s) => [s.id, s.name]),
    );
    for (const [i, line] of lines.entries()) {
      await tx.orderLine.create({
        data: {
          orderId,
          dishId: line.dishId,
          dishName: line.dishName,
          dishSku: line.dishSku ?? '',
          quantity: line.quantity,
          dishPriceCents: line.dishPriceCents,
          totalCents: line.totalCents,
          sortOrder: i,
          combinations: {
            create: line.combinations.map((c) => ({
              signature: c.signature,
              quantity: c.quantity,
              unitPriceCents: c.unitPriceCents,
              totalCents: c.totalCents,
              choices: {
                create: c.choices.map((ch) => ({
                  optionGroupId: ch.groupId,
                  optionGroupName: ch.groupName,
                  optionId: ch.optionId,
                  optionName: ch.optionName,
                  portionSizeId: ch.portionSizeId,
                  portionSizeName: ch.portionSizeId
                    ? (sizeNames.get(ch.portionSizeId) ?? null)
                    : null,
                  priceCents: ch.priceCents,
                  sortOrder: ch.sortOrder,
                })),
              },
            })),
          },
        },
      });
    }
  }

  private async attachDrop(
    tx: Tx,
    orderId: string,
    p: Prepared,
    strict: boolean,
    actor: CurrentUserInfo,
  ) {
    await assignDrop(
      tx,
      {
        orderId,
        companyId: p.ctx.employee.company.id,
        addressId: p.delivery.address.id,
        deliveryDate: toDbDate(p.date),
        deliveryTimeMinutes: p.delivery.timeMinutes,
        deliveryAt: p.delivery.deliveryAt,
        kitchenReady: false,
      },
      { strict, actorId: actor.id, actorLabel: actor.name },
    );
  }

  private async finish(
    id: string,
    version: number,
    status: 'CANCELLED' | 'REJECTED',
    reason: string,
    dropId: string | null,
    actor: CurrentUserInfo,
  ): Promise<void> {
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      await this.bumpVersion(tx, id, version);
      await tx.order.update({
        where: { id },
        data: {
          status,
          statusReason: reason,
          ...(status === 'CANCELLED' ? { cancelledAt: now } : { rejectedAt: now }),
        },
      });
      await tx.orderEvent.create({
        data: {
          orderId: id,
          type: status,
          actorId: actor.id,
          actorLabel: actor.name,
          data: { reason },
        },
      });
      // BR-BIL-06: an invoiced order can't be un-billed; it gets a credit on the next invoice.
      const billed = await tx.order.findUniqueOrThrow({
        where: { id },
        select: { companyId: true, totalCents: true, invoiceLine: { select: { id: true } } },
      });
      if (billed.invoiceLine && billed.totalCents > 0) {
        await tx.orderAdjustment.create({
          data: {
            orderId: id,
            companyId: billed.companyId,
            kind: 'CANCELLATION_CREDIT',
            amountCents: cancellationCredit(billed.totalCents),
            reason: `${status === 'CANCELLED' ? 'Cancelled' : 'Rejected'} after invoicing: ${reason}`,
            createdById: actor.id,
          },
        });
        await tx.orderEvent.create({
          data: {
            orderId: id,
            type: 'ADJUSTMENT_ADDED',
            actorId: actor.id,
            actorLabel: actor.name,
            data: { amountCents: -billed.totalCents },
          },
        });
      }
      if (dropId) await removeDropIfEmpty(tx, dropId);
    });
  }

  /** Optimistic concurrency: the write only lands if nobody saved in between. */
  private async bumpVersion(tx: Tx, id: string, version: number): Promise<void> {
    const updated = await tx.order.updateMany({
      where: { id, version },
      data: { version: { increment: 1 } },
    });
    if (updated.count === 0)
      throw new DomainError(
        'ORDER_VERSION_CONFLICT',
        'Someone else changed this order. Reload to see their changes.',
      );
  }

  private assertVersion(current: number, sent: number): void {
    if (current !== sent)
      throw new DomainError(
        'ORDER_VERSION_CONFLICT',
        'Someone else changed this order. Reload to see their changes.',
      );
  }

  private assertTime(minutes: number, planning: Planning): void {
    const s = planning.settings;
    if (
      !isValidDeliveryTime(
        minutes,
        s.deliveryWindowStartMin,
        s.deliveryWindowEndMin,
        s.deliverySlotMinutes,
      )
    )
      throw new DomainError(
        'VALIDATION_FAILED',
        `Deliveries run ${minutesToHHmm(s.deliveryWindowStartMin)}–${minutesToHHmm(s.deliveryWindowEndMin)} in ${s.deliverySlotMinutes}-minute slots.`,
        { fieldErrors: { deliveryTimeMinutes: ['Outside the delivery window or off a slot'] } },
      );
  }

  private async companyDefaults(companyId: string) {
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: {
        id: true,
        defaultAddressId: true,
        defaultDeliveryTimeMinutes: true,
        defaultPackagingTypeId: true,
        dispatchLeadMinutes: true,
        addresses: {
          where: { isActive: true },
          orderBy: { label: 'asc' },
          select: { id: true, label: true },
        },
      },
    });
    if (!company.defaultAddressId)
      throw new DomainError('INVARIANT_VIOLATION', 'The company has no default address.');
    return { ...company, defaultAddressId: company.defaultAddressId };
  }

  private async activeAddress(companyId: string, addressId: string) {
    const a = await this.prisma.companyAddress.findFirst({
      where: { id: addressId, companyId, isActive: true },
    });
    if (!a)
      throw new DomainError('VALIDATION_FAILED', 'Choose one of the company’s active addresses.', {
        fieldErrors: { addressId: ['Not an active address of this company'] },
      });
    return {
      id: a.id,
      label: a.label,
      snapshot: {
        label: a.label,
        line1: a.line1,
        line2: a.line2,
        city: a.city,
        postalCode: a.postalCode,
        accessNotes: a.accessNotes,
      },
    };
  }

  private async activePackaging(id: string) {
    const p = await this.prisma.packagingType.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true },
    });
    if (!p?.isActive)
      throw new DomainError('VALIDATION_FAILED', 'Choose an active packaging type.', {
        fieldErrors: { packagingTypeId: ['Not an active packaging type'] },
      });
    return { id: p.id, name: p.name };
  }

  private async loadForEdit(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        version: true,
        employeeId: true,
        companyId: true,
        deliveryDate: true,
        deliveryTimeMinutes: true,
        addressId: true,
        packagingTypeId: true,
        allergenAcknowledged: true,
        lines: {
          orderBy: { sortOrder: 'asc' },
          select: {
            dishId: true,
            dishName: true,
            dishSku: true,
            dishPriceCents: true,
            quantity: true,
            combinations: {
              select: {
                signature: true,
                quantity: true,
                unitPriceCents: true,
                choices: { orderBy: { sortOrder: 'asc' } },
              },
            },
          },
        },
      },
    });
    if (!order) throw new DomainError('NOT_FOUND', 'Order not found.');
    return order;
  }
}

function fromDb(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** BR-PRC-07: what the order captured, keyed by dish and canonical signature. */
function capturedFrom(order: {
  lines: Array<{
    dishId: string;
    dishName: string;
    dishSku: string;
    dishPriceCents: number;
    combinations: Array<{
      signature: string;
      unitPriceCents: number;
      choices: Array<{
        optionGroupId: string | null;
        optionGroupName: string;
        optionId: string;
        optionName: string;
        portionSizeId: string | null;
        priceCents: number;
        sortOrder: number;
      }>;
    }>;
  }>;
}): Map<string, CapturedCombination> {
  const map = new Map<string, CapturedCombination>();
  for (const line of order.lines)
    for (const c of line.combinations)
      map.set(capturedKey(line.dishId, c.signature), {
        dishName: line.dishName,
        dishSku: line.dishSku,
        dishPriceCents: line.dishPriceCents,
        unitPriceCents: c.unitPriceCents,
        choices: c.choices.map((ch) => ({
          groupId: ch.optionGroupId ?? '',
          groupName: ch.optionGroupName,
          optionId: ch.optionId,
          optionName: ch.optionName,
          portionSizeId: ch.portionSizeId,
          priceCents: ch.priceCents,
          sortOrder: ch.sortOrder,
        })),
      });
  return map;
}

/** Stored lines back into builder input (used when placing a draft). */
function linesFrom(order: {
  lines: Array<{
    dishId: string;
    quantity: number;
    combinations: Array<{
      quantity: number;
      choices: Array<{
        optionGroupId: string | null;
        optionId: string;
        portionSizeId: string | null;
      }>;
    }>;
  }>;
}): LineInput[] {
  return order.lines.map((l) => ({
    dishId: l.dishId,
    quantity: l.quantity,
    combinations: l.combinations.map((c) => ({
      quantity: c.quantity,
      choices: c.choices.map((ch) => ({
        groupId: ch.optionGroupId ?? '',
        optionId: ch.optionId,
        portionSizeId: ch.portionSizeId,
      })),
    })),
  }));
}
