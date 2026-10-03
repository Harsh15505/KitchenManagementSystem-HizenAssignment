import { Injectable, Logger } from '@nestjs/common';
import {
  BILLABLE_STATUSES,
  type BillingSummaryRow,
  calendarDate,
  type CreateInvoiceInput,
  formatInvoiceNumber,
  formatOrderNumber,
  fromDbDate,
  type InvoiceDetail,
  type InvoiceListItem,
  type InvoiceListQuery,
  invoiceTotal,
  type Paginated,
  paginated,
  type ShortageInput,
  shortageCredit,
  toDbDate,
  type UninvoicedDto,
} from '@fernleaf/shared';
import type { CurrentUserInfo } from '../authz/current-user';
import { ClockService } from '../clock/clock.service';
import { DomainError } from '../common/domain-error';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const billable = {
  status: { in: [...BILLABLE_STATUSES] },
  invoiceLine: { is: null },
} satisfies Prisma.OrderWhereInput;

/** FR-BIL-01..05, BR-BIL-01..09 (TRD §8.9). */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  async summary(): Promise<BillingSummaryRow[]> {
    const [companies, orders, adjustments, outstanding] = await Promise.all([
      this.prisma.company.findMany({
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          invoices: {
            orderBy: { number: 'desc' },
            take: 1,
            select: { id: true, number: true, issuedAt: true, status: true },
          },
        },
      }),
      this.prisma.order.groupBy({
        by: ['companyId'],
        where: billable,
        _count: { _all: true },
        _sum: { totalCents: true },
      }),
      this.prisma.orderAdjustment.groupBy({
        by: ['companyId'],
        where: { invoiceLine: { is: null } },
        _count: { _all: true },
        _sum: { amountCents: true },
      }),
      this.prisma.invoice.groupBy({
        by: ['companyId'],
        where: { status: 'ISSUED' },
        _sum: { totalCents: true },
      }),
    ]);
    return companies.map((c) => {
      const o = orders.find((x) => x.companyId === c.id);
      const a = adjustments.find((x) => x.companyId === c.id);
      const last = c.invoices[0];
      return {
        company: { id: c.id, name: c.name },
        uninvoicedOrders: o?._count._all ?? 0,
        uninvoicedOrdersCents: o?._sum.totalCents ?? 0,
        uninvoicedAdjustments: a?._count._all ?? 0,
        uninvoicedAdjustmentsCents: a?._sum.amountCents ?? 0,
        outstandingCents: outstanding.find((x) => x.companyId === c.id)?._sum.totalCents ?? 0,
        lastInvoice: last
          ? {
              id: last.id,
              number: last.number,
              issuedAt: last.issuedAt.toISOString(),
              status: last.status,
            }
          : null,
      };
    });
  }

  /** FR-BIL-02 / BR-BIL-09: what the company owes that isn't on an invoice yet. */
  async uninvoiced(companyId: string, upTo?: string): Promise<UninvoicedDto> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, billingEmail: true },
    });
    if (!company) throw new DomainError('NOT_FOUND', 'Company not found.');
    const [orders, adjustments] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          ...billable,
          companyId,
          ...(upTo ? { deliveryDate: { lte: toDbDate(calendarDate(upTo)) } } : {}),
        },
        orderBy: [{ deliveryDate: 'asc' }, { number: 'asc' }],
        select: {
          id: true,
          number: true,
          deliveryDate: true,
          status: true,
          totalCents: true,
          employee: { select: { name: true } },
        },
      }),
      this.prisma.orderAdjustment.findMany({
        where: { companyId, invoiceLine: { is: null } },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          orderId: true,
          kind: true,
          amountCents: true,
          reason: true,
          createdAt: true,
          order: { select: { number: true } },
        },
      }),
    ]);
    return {
      company,
      orders: orders.map((o) => ({
        id: o.id,
        number: o.number,
        deliveryDate: fromDbDate(o.deliveryDate),
        status: o.status as 'CONFIRMED' | 'DELIVERED',
        employeeName: o.employee.name,
        totalCents: o.totalCents,
      })),
      adjustments: adjustments.map((a) => ({
        id: a.id,
        orderId: a.orderId,
        orderNumber: a.order.number,
        kind: a.kind,
        amountCents: a.amountCents,
        reason: a.reason,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  /** BR-BIL-02/03: one company, uninvoiced billable rows only; the unique keys stop double billing. */
  async createInvoice(
    input: CreateInvoiceInput,
    actor: CurrentUserInfo,
  ): Promise<{ id: string; number: number }> {
    try {
      const invoice = await this.prisma.$transaction(async (tx) => {
        const orders = await tx.order.findMany({
          where: { ...billable, companyId: input.companyId, id: { in: input.orderIds } },
          select: {
            id: true,
            number: true,
            totalCents: true,
            deliveryDate: true,
            employee: { select: { name: true } },
          },
        });
        const adjustments = await tx.orderAdjustment.findMany({
          where: {
            companyId: input.companyId,
            invoiceLine: { is: null },
            id: { in: input.adjustmentIds },
          },
          select: {
            id: true,
            amountCents: true,
            reason: true,
            kind: true,
            order: { select: { number: true, deliveryDate: true } },
          },
        });
        if (
          orders.length !== new Set(input.orderIds).size ||
          adjustments.length !== new Set(input.adjustmentIds).size
        )
          throw new DomainError(
            'ALREADY_INVOICED',
            'Some of the selected items are already invoiced, not billable, or belong to another company. Reload the list.',
          );
        const lines = [
          ...orders.map((o) => ({
            kind: 'ORDER' as const,
            orderId: o.id,
            description: `${formatOrderNumber(o.number)} · ${fromDbDate(o.deliveryDate)} · ${o.employee.name}`,
            amountCents: o.totalCents,
          })),
          ...adjustments.map((a) => ({
            kind: 'ADJUSTMENT' as const,
            adjustmentId: a.id,
            description: `${a.kind === 'CANCELLATION_CREDIT' ? 'Cancellation credit' : a.kind === 'SHORT_DELIVERY_CREDIT' ? 'Short delivery credit' : 'Adjustment'} · ${formatOrderNumber(a.order.number)} · ${a.reason}`,
            amountCents: a.amountCents,
          })),
        ];
        const dates = [
          ...orders.map((o) => o.deliveryDate),
          ...adjustments.map((a) => a.order.deliveryDate),
        ].sort((a, b) => a.getTime() - b.getTime());
        const total = invoiceTotal(lines);
        const created = await tx.invoice.create({
          data: {
            companyId: input.companyId,
            periodStart: dates[0]!,
            periodEnd: dates.at(-1)!,
            totalCents: total,
            notes: input.notes ?? '',
            createdById: actor.id,
            lines: { create: lines },
          },
          select: { id: true, number: true, lines: { select: { amountCents: true } } },
        });
        // BR-MNY-03: the stored total must equal the stored lines.
        if (invoiceTotal(created.lines) !== total)
          throw new DomainError('INVARIANT_VIOLATION', 'Invoice total mismatch.');
        await tx.orderEvent.createMany({
          data: orders.map((o) => ({
            orderId: o.id,
            type: 'INVOICED' as const,
            actorId: actor.id,
            actorLabel: actor.name,
            data: { invoice: formatInvoiceNumber(created.number) },
          })),
        });
        return created;
      });
      this.logger.log(
        `[email-simulated] invoice ${formatInvoiceNumber(invoice.number)} issued for company ${input.companyId}`,
      );
      return { id: invoice.id, number: invoice.number };
    } catch (error) {
      // BR-BIL-03: a concurrent invoice took the same order first (unique InvoiceLine.orderId).
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new DomainError(
          'ALREADY_INVOICED',
          'Another invoice took some of these orders a moment ago. Reload the list.',
        );
      throw error;
    }
  }

  async list(query: InvoiceListQuery): Promise<Paginated<InvoiceListItem>> {
    const where: Prisma.InvoiceWhereInput = {
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        orderBy: { number: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          company: { select: { id: true, name: true } },
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return paginated(
      rows.map((r) => this.toListItem(r)),
      total,
      query,
    );
  }

  async get(id: string): Promise<InvoiceDetail> {
    const r = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            billingContactName: true,
            billingEmail: true,
            billingPhone: true,
            billingAddress: true,
          },
        },
        _count: { select: { lines: true } },
        lines: {
          orderBy: [{ kind: 'asc' }, { description: 'asc' }],
          include: { order: { select: { id: true, number: true, deliveryDate: true } } },
        },
      },
    });
    if (!r) throw new DomainError('NOT_FOUND', 'Invoice not found.');
    return {
      ...this.toListItem(r),
      notes: r.notes,
      billing: {
        name: r.company.billingContactName,
        email: r.company.billingEmail,
        phone: r.company.billingPhone,
        address: r.company.billingAddress,
      },
      lines: r.lines.map((l) => ({
        id: l.id,
        kind: l.kind,
        description: l.description,
        amountCents: l.amountCents,
        orderId: l.order?.id ?? null,
        orderNumber: l.order?.number ?? null,
        deliveryDate: l.order ? fromDbDate(l.order.deliveryDate) : null,
      })),
    };
  }

  /** BR-BIL-04: the only change an invoice ever gets is Issued → Paid. */
  async markPaid(id: string): Promise<{ id: string }> {
    const updated = await this.prisma.invoice.updateMany({
      where: { id, status: 'ISSUED' },
      data: { status: 'PAID', paidAt: this.clock.now() },
    });
    if (updated.count === 0) {
      const exists = await this.prisma.invoice.findUnique({ where: { id }, select: { id: true } });
      throw exists
        ? new DomainError('INVALID_TRANSITION', 'The invoice is already paid.')
        : new DomainError('NOT_FOUND', 'Invoice not found.');
    }
    return { id };
  }

  /** FR-BIL-05 / BR-BIL-07: record a short delivery as a credit adjustment. */
  async shortage(
    orderId: string,
    input: ShortageInput,
    actor: CurrentUserInfo,
  ): Promise<{ id: string; amountCents: number }> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ status: string }>
      >`SELECT status::text AS status FROM "Order" WHERE id = ${orderId}::uuid FOR UPDATE`;
      if (rows.length === 0) throw new DomainError('NOT_FOUND', 'Order not found.');
      if (rows[0]!.status !== 'DELIVERED')
        throw new DomainError(
          'INVALID_TRANSITION',
          'Shortages can only be recorded on delivered orders.',
        );
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        select: {
          companyId: true,
          totalCents: true,
          lines: {
            select: {
              dishName: true,
              combinations: { select: { id: true, quantity: true, unitPriceCents: true } },
            },
          },
          adjustments: { select: { kind: true, amountCents: true, details: true } },
        },
      });
      const alreadyShort = new Map<string, number>();
      for (const a of order.adjustments) {
        if (a.kind !== 'SHORT_DELIVERY_CREDIT') continue;
        const items =
          (a.details as { items?: Array<{ combinationId: string; shortQty: number }> } | null)
            ?.items ?? [];
        for (const item of items)
          alreadyShort.set(
            item.combinationId,
            (alreadyShort.get(item.combinationId) ?? 0) + item.shortQty,
          );
      }
      const combinations = order.lines.flatMap((l) =>
        l.combinations.map((c) => ({
          combinationId: c.id,
          quantity: c.quantity,
          unitPriceCents: c.unitPriceCents,
          alreadyShort: alreadyShort.get(c.id) ?? 0,
        })),
      );
      const existing = order.adjustments.reduce((s, a) => s + Math.min(a.amountCents, 0), 0);
      const result = shortageCredit(input.items, combinations, order.totalCents, existing);
      if (!result.ok) {
        const p = result.problem;
        throw new DomainError(
          'BUSINESS_RULE_VIOLATION',
          p.code === 'EMPTY'
            ? 'Enter at least one short quantity.'
            : p.code === 'TOO_MANY'
              ? `Only ${p.remaining} of that item can still be marked short.`
              : p.code === 'OVER_TOTAL'
                ? 'Credits on this order would exceed its total.'
                : 'That item isn’t on this order.',
        );
      }
      const items = input.items.filter((i) => i.shortQty > 0);
      const adjustment = await tx.orderAdjustment.create({
        data: {
          orderId,
          companyId: order.companyId,
          kind: 'SHORT_DELIVERY_CREDIT',
          amountCents: result.creditCents,
          reason: input.reason,
          details: { items },
          createdById: actor.id,
        },
        select: { id: true, amountCents: true },
      });
      await tx.orderEvent.create({
        data: {
          orderId,
          type: 'ADJUSTMENT_ADDED',
          actorId: actor.id,
          actorLabel: actor.name,
          data: { reason: input.reason, amountCents: result.creditCents },
        },
      });
      return adjustment;
    });
  }

  private toListItem(r: {
    id: string;
    number: number;
    status: 'ISSUED' | 'PAID';
    issuedAt: Date;
    paidAt: Date | null;
    periodStart: Date;
    periodEnd: Date;
    totalCents: number;
    company: { id: string; name: string };
    _count: { lines: number };
  }): InvoiceListItem {
    return {
      id: r.id,
      number: r.number,
      company: { id: r.company.id, name: r.company.name },
      status: r.status,
      issuedAt: r.issuedAt.toISOString(),
      paidAt: r.paidAt?.toISOString() ?? null,
      periodStart: fromDbDate(r.periodStart),
      periodEnd: fromDbDate(r.periodEnd),
      totalCents: r.totalCents,
      lineCount: r._count.lines,
    };
  }
}
