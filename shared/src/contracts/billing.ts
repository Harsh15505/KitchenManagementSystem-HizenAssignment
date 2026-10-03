import { z } from 'zod';
import { paginationQuerySchema } from './pagination';
import { calendarDateString } from './settings';

export const uninvoicedQuerySchema = z.object({ upTo: calendarDateString.optional() });

export const createInvoiceSchema = z
  .object({
    companyId: z.uuid(),
    orderIds: z.array(z.uuid()).max(2000),
    adjustmentIds: z.array(z.uuid()).max(500),
    notes: z.string().trim().max(500).optional(),
  })
  .refine(
    (v) => v.orderIds.length + v.adjustmentIds.length > 0,
    'Select at least one order or adjustment',
  );
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const invoiceListQuerySchema = paginationQuerySchema.extend({
  companyId: z.uuid().optional(),
  status: z.enum(['ISSUED', 'PAID']).optional(),
});
export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>;

/** FR-BIL-05: short quantities per combination of a delivered order. */
export const shortageSchema = z.object({
  items: z
    .array(z.object({ combinationId: z.uuid(), shortQty: z.number().int().min(0) }))
    .min(1)
    .max(100),
  reason: z.string().trim().min(3, 'Say what was short').max(300),
});
export type ShortageInput = z.infer<typeof shortageSchema>;

export const formatInvoiceNumber = (n: number) => `INV-${String(n).padStart(4, '0')}`;

export interface BillingSummaryRow {
  company: { id: string; name: string };
  uninvoicedOrders: number;
  uninvoicedOrdersCents: number;
  uninvoicedAdjustments: number;
  uninvoicedAdjustmentsCents: number;
  /** Issued but not yet paid. */
  outstandingCents: number;
  lastInvoice: { id: string; number: number; issuedAt: string; status: 'ISSUED' | 'PAID' } | null;
}

export interface UninvoicedDto {
  company: { id: string; name: string; billingEmail: string };
  orders: Array<{
    id: string;
    number: number;
    deliveryDate: string;
    status: 'CONFIRMED' | 'DELIVERED';
    employeeName: string;
    totalCents: number;
  }>;
  adjustments: Array<{
    id: string;
    orderId: string;
    orderNumber: number;
    kind: 'CANCELLATION_CREDIT' | 'SHORT_DELIVERY_CREDIT' | 'MANUAL';
    amountCents: number;
    reason: string;
    createdAt: string;
  }>;
}

export interface InvoiceListItem {
  id: string;
  number: number;
  company: { id: string; name: string };
  status: 'ISSUED' | 'PAID';
  issuedAt: string;
  paidAt: string | null;
  periodStart: string;
  periodEnd: string;
  totalCents: number;
  lineCount: number;
}

export interface InvoiceDetail extends InvoiceListItem {
  notes: string;
  billing: { name: string; email: string; phone: string | null; address: string };
  lines: Array<{
    id: string;
    kind: 'ORDER' | 'ADJUSTMENT';
    description: string;
    amountCents: number;
    orderId: string | null;
    orderNumber: number | null;
    deliveryDate: string | null;
  }>;
}
