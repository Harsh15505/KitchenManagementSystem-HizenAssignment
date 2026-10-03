import { Injectable } from '@nestjs/common';
import {
  calendarDate,
  type FulfilmentStage,
  fromDbDate,
  type OrderDetail,
  type OrderListItem,
  type OrderListQuery,
  type Paginated,
  paginated,
  toDbDate,
} from '@fernleaf/shared';
import type { CurrentUserInfo } from '../authz/current-user';
import { DomainError } from '../common/domain-error';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { type Planning, PlanningService } from './planning.service';

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** TRD §8.6: the stage a confirmed order has reached, derived from its own and its drop's times. */
export function stageOf(order: {
  status: string;
  kitchenStartedAt: Date | null;
  kitchenReadyAt: Date | null;
  drop: { dispatchReadyAt: Date | null; outForDeliveryAt: Date | null } | null;
}): FulfilmentStage | null {
  if (order.status === 'DELIVERED') return 'DELIVERED';
  if (order.status !== 'CONFIRMED') return null;
  if (order.drop?.outForDeliveryAt) return 'OUT_FOR_DELIVERY';
  if (order.drop?.dispatchReadyAt) return 'DISPATCH_READY';
  if (order.kitchenReadyAt) return 'KITCHEN_READY';
  if (order.kitchenStartedAt) return 'IN_PREP';
  return 'QUEUED';
}

const listSelect = {
  id: true,
  number: true,
  status: true,
  deliveryDate: true,
  deliveryTimeMinutes: true,
  totalCents: true,
  kitchenStartedAt: true,
  kitchenReadyAt: true,
  employee: { select: { id: true, name: true } },
  company: { select: { id: true, name: true } },
  drop: { select: { dispatchReadyAt: true, outForDeliveryAt: true } },
  invoiceLine: { select: { id: true } },
  lines: { select: { quantity: true } },
} satisfies Prisma.OrderSelect;

/** FR-ORD-06/07: the order list and the order detail. */
@Injectable()
export class OrdersQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planning: PlanningService,
  ) {}

  async list(query: OrderListQuery): Promise<Paginated<OrderListItem>> {
    const and: Prisma.OrderWhereInput[] = [];
    if (query.dateFrom) and.push({ deliveryDate: { gte: toDbDate(calendarDate(query.dateFrom)) } });
    if (query.dateTo) and.push({ deliveryDate: { lte: toDbDate(calendarDate(query.dateTo)) } });
    if (query.status.length > 0) and.push({ status: { in: query.status } });
    if (query.companyId) and.push({ companyId: query.companyId });
    if (query.invoiced)
      and.push({ invoiceLine: query.invoiced === 'true' ? { isNot: null } : { is: null } });
    if (query.q) {
      const number = /^(?:fl-?)?0*(\d{1,9})$/i.exec(query.q)?.[1];
      and.push({
        OR: [
          ...(number ? [{ number: Number(number) }] : []),
          { employee: { name: { contains: query.q, mode: 'insensitive' } } },
          { employee: { email: { contains: query.q.toLowerCase() } } },
          { company: { name: { contains: query.q, mode: 'insensitive' } } },
        ],
      });
    }
    const where: Prisma.OrderWhereInput = { AND: and };
    const desc = query.sort.startsWith('-');
    const dir = desc ? 'desc' : 'asc';
    const key = query.sort.replace('-', '');
    const orderBy: Prisma.OrderOrderByWithRelationInput[] =
      key === 'number'
        ? [{ number: dir }]
        : key === 'total'
          ? [{ totalCents: dir }, { number: 'desc' }]
          : [{ deliveryDate: dir }, { deliveryTimeMinutes: dir }, { number: 'desc' }];

    const [rows, total, planning] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy,
        select: listSelect,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.order.count({ where }),
      this.planning.load(),
    ]);
    return paginated(
      rows.map((r) => this.toListItem(r, planning)),
      total,
      query,
    );
  }

  async get(id: string, actor: CurrentUserInfo): Promise<OrderDetail> {
    const [o, planning] = await Promise.all([
      this.prisma.order.findUnique({
        where: { id },
        include: {
          employee: { select: { id: true, name: true, email: true } },
          company: { select: { id: true, name: true } },
          drop: {
            select: {
              id: true,
              dispatchReadyAt: true,
              outForDeliveryAt: true,
              deliveredAt: true,
              driver: { select: { id: true, name: true } },
            },
          },
          invoiceLine: { select: { invoice: { select: { id: true, number: true } } } },
          lines: {
            orderBy: { sortOrder: 'asc' },
            include: { combinations: { include: { choices: { orderBy: { sortOrder: 'asc' } } } } },
          },
          events: { orderBy: { at: 'asc' } },
          adjustments: {
            orderBy: { createdAt: 'asc' },
            include: { invoiceLine: { select: { id: true } } },
          },
        },
      }),
      this.planning.load(),
    ]);
    if (!o) throw new DomainError('NOT_FOUND', 'Order not found.');
    const date = fromDbDate(o.deliveryDate);
    const locked = planning.isLocked(date);
    const short = new Map<string, number>();
    for (const adj of o.adjustments) {
      if (adj.kind !== 'SHORT_DELIVERY_CREDIT') continue;
      const items =
        (adj.details as { items?: Array<{ combinationId: string; shortQty: number }> } | null)
          ?.items ?? [];
      for (const item of items)
        short.set(item.combinationId, (short.get(item.combinationId) ?? 0) + item.shortQty);
    }
    const address = o.addressSnapshot as OrderDetail['address'];
    const open = o.status === 'DRAFT' || o.status === 'PLACED';
    const override = actor.ability.can('override', 'Order');
    return {
      ...this.toListItem(
        { ...o, lines: o.lines, invoiceLine: o.invoiceLine ? { id: '' } : null },
        planning,
      ),
      version: o.version,
      source: o.source,
      employee: o.employee,
      deliveryAt: o.deliveryAt.toISOString(),
      cutoffAt: planning.cutoffAt(date).toISOString(),
      plannedDispatchReadyAt: o.plannedDispatchReadyAt.toISOString(),
      plannedKitchenReadyAt: o.plannedKitchenReadyAt.toISOString(),
      address: { ...address, id: o.addressId },
      packaging: { id: o.packagingTypeId, name: o.packagingName },
      tier: { id: o.priceTierId, name: o.priceTierName },
      notes: o.notes,
      statusReason: o.statusReason,
      allergenAcknowledged: o.allergenAcknowledged,
      placedAt: iso(o.placedAt),
      confirmedAt: iso(o.confirmedAt),
      cancelledAt: iso(o.cancelledAt),
      rejectedAt: iso(o.rejectedAt),
      deliveredAt: iso(o.deliveredAt),
      kitchenStartedAt: iso(o.kitchenStartedAt),
      kitchenReadyAt: iso(o.kitchenReadyAt),
      drop: o.drop
        ? {
            id: o.drop.id,
            driver: o.drop.driver,
            dispatchReadyAt: iso(o.drop.dispatchReadyAt),
            outForDeliveryAt: iso(o.drop.outForDeliveryAt),
            deliveredAt: iso(o.drop.deliveredAt),
          }
        : null,
      invoice: o.invoiceLine
        ? {
            id: o.invoiceLine.invoice.id,
            number: `INV-${String(o.invoiceLine.invoice.number).padStart(4, '0')}`,
          }
        : null,
      lines: o.lines.map((l) => ({
        id: l.id,
        dishId: l.dishId,
        dishName: l.dishName,
        dishSku: l.dishSku,
        quantity: l.quantity,
        dishPriceCents: l.dishPriceCents,
        totalCents: l.totalCents,
        combinations: l.combinations.map((c) => ({
          id: c.id,
          signature: c.signature,
          quantity: c.quantity,
          unitPriceCents: c.unitPriceCents,
          totalCents: c.totalCents,
          prepStartedAt: iso(c.prepStartedAt),
          prepDoneAt: iso(c.prepDoneAt),
          shortQuantity: short.get(c.id) ?? 0,
          choices: c.choices.map((ch) => ({
            groupId: ch.optionGroupId,
            groupName: ch.optionGroupName,
            optionId: ch.optionId,
            optionName: ch.optionName,
            portionSizeId: ch.portionSizeId,
            portionSizeName: ch.portionSizeName,
            priceCents: ch.priceCents,
          })),
        })),
      })),
      adjustments: o.adjustments.map((adj) => ({
        id: adj.id,
        kind: adj.kind,
        amountCents: adj.amountCents,
        reason: adj.reason,
        createdAt: adj.createdAt.toISOString(),
        invoiced: adj.invoiceLine !== null,
      })),
      events: o.events.map((e) => ({
        id: e.id,
        type: e.type,
        at: e.at.toISOString(),
        actorLabel: e.actorLabel,
        data: e.data,
      })),
      actions: {
        edit: open && !locked && actor.ability.can('update', 'Order'),
        place: o.status === 'DRAFT' && !locked && actor.ability.can('create', 'Order'),
        cancel:
          (open && !locked && actor.ability.can('cancel', 'Order')) ||
          ((open || o.status === 'CONFIRMED') && override),
        reject:
          (o.status === 'PLACED' || o.status === 'CONFIRMED') &&
          actor.ability.can('reject', 'Order'),
        overrideDelivery: o.status === 'CONFIRMED' && !o.drop?.outForDeliveryAt && override,
        recordShortage: o.status === 'DELIVERED' && actor.ability.can('manage', 'Invoice'),
      },
    };
  }

  private toListItem(
    r: {
      id: string;
      number: number;
      status: OrderListItem['status'];
      deliveryDate: Date;
      deliveryTimeMinutes: number;
      totalCents: number;
      kitchenStartedAt: Date | null;
      kitchenReadyAt: Date | null;
      employee: { id: string; name: string };
      company: { id: string; name: string };
      drop: { dispatchReadyAt: Date | null; outForDeliveryAt: Date | null } | null;
      invoiceLine: { id: string } | null;
      lines: Array<{ quantity: number }>;
    },
    planning: Planning,
  ): OrderListItem {
    const date = fromDbDate(r.deliveryDate);
    return {
      id: r.id,
      number: r.number,
      status: r.status,
      stage: stageOf(r),
      deliveryDate: date,
      deliveryTimeMinutes: r.deliveryTimeMinutes,
      employee: { id: r.employee.id, name: r.employee.name },
      company: r.company,
      totalCents: r.totalCents,
      itemCount: r.lines.reduce((s, l) => s + l.quantity, 0),
      invoiced: r.invoiceLine !== null,
      locked: planning.isLocked(date),
    };
  }
}
