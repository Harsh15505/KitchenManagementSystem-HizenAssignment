import { z } from 'zod';
import type { AllergenWarning, NormalisedLine } from '../domain/combinations';
import type { MenuCategoryView } from '../domain/menu';
import { paginationQuerySchema } from './pagination';
import { calendarDateString } from './settings';

const choiceSchema = z.object({
  groupId: z.uuid(),
  optionId: z.uuid(),
  portionSizeId: z.uuid().nullable().optional(),
});
const combinationSchema = z.object({
  quantity: z.number().int(),
  choices: z.array(choiceSchema).max(30),
});
export const orderLineSchema = z.object({
  dishId: z.uuid(),
  quantity: z.number().int(),
  combinations: z.array(combinationSchema).max(50),
});
export type OrderLineInput = z.infer<typeof orderLineSchema>;

/**
 * FR-ORD-02: what the builder sends. Delivery fields left null take the company default; set
 * values are only accepted when the employee's flag allows them (BR-ORD-04).
 */
const orderBodyShape = {
  deliveryDate: calendarDateString,
  deliveryTimeMinutes: z.number().int().min(0).max(1439).nullable(),
  addressId: z.uuid().nullable(),
  packagingTypeId: z.uuid().nullable(),
  notes: z.string().trim().max(500),
  lines: z.array(orderLineSchema).min(1, 'Add at least one dish').max(40),
  /** FR-ORD-10: confirms the staff member saw the allergen warnings. */
  allergenAcknowledged: z.boolean(),
};

export const createOrderSchema = z.object({
  ...orderBodyShape,
  employeeId: z.uuid(),
  /** false = save as Draft, true = Place (late admin orders are always Confirmed). */
  place: z.boolean(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const updateOrderSchema = z.object({ ...orderBodyShape, version: z.number().int().min(0) });
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;

export const quoteOrderSchema = createOrderSchema.extend({ orderId: z.uuid().optional() });
export type QuoteOrderInput = z.infer<typeof quoteOrderSchema>;

export const orderVersionSchema = z.object({ version: z.number().int().min(0) });
export const orderReasonSchema = z.object({
  reason: z.string().trim().min(3, 'Give a reason').max(300),
  version: z.number().int().min(0),
});
export type OrderReasonInput = z.infer<typeof orderReasonSchema>;

/** FR-ORD-08: admin override after confirmation. */
export const deliveryOverrideSchema = z
  .object({
    deliveryTimeMinutes: z.number().int().min(0).max(1439),
    addressId: z.uuid(),
    packagingTypeId: z.uuid(),
    version: z.number().int().min(0),
  })
  .partial({ deliveryTimeMinutes: true, addressId: true, packagingTypeId: true })
  .refine(
    (v) =>
      v.deliveryTimeMinutes !== undefined ||
      v.addressId !== undefined ||
      v.packagingTypeId !== undefined,
    'Change at least one delivery detail',
  );
export type DeliveryOverrideInput = z.infer<typeof deliveryOverrideSchema>;

export const ORDER_STATUSES = [
  'DRAFT',
  'PLACED',
  'CONFIRMED',
  'DELIVERED',
  'CANCELLED',
  'REJECTED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_SORTS = [
  'deliveryDate',
  '-deliveryDate',
  'number',
  '-number',
  'total',
  '-total',
] as const;

export const orderListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  dateFrom: calendarDateString.optional(),
  dateTo: calendarDateString.optional(),
  /** Comma-separated statuses. */
  status: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : []))
    .pipe(z.array(z.enum(ORDER_STATUSES))),
  companyId: z.uuid().optional(),
  invoiced: z.enum(['true', 'false']).optional(),
  sort: z.enum(ORDER_SORTS).default('-deliveryDate'),
});
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;

export const cutoffRunSchema = z.object({ deliveryDate: calendarDateString });

/** GET /orders/open-on: FR-CMP-05 holiday warning. Without companyId it covers every company (kitchen holiday). */
export const openOrdersOnQuerySchema = z.object({
  date: calendarDateString,
  companyId: z.uuid().optional(),
});
export type OpenOrdersOnQuery = z.infer<typeof openOrdersOnQuerySchema>;

export interface OpenOrdersOnDto {
  date: string;
  /** All matching orders; `orders` holds at most the first 50. */
  total: number;
  orders: Array<{
    id: string;
    number: number;
    status: OrderStatus;
    deliveryTimeMinutes: number;
    employeeName: string;
    companyName: string;
  }>;
}

export type FulfilmentStage =
  'QUEUED' | 'IN_PREP' | 'KITCHEN_READY' | 'DISPATCH_READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED';

export const formatOrderNumber = (n: number) => `FL-${String(n).padStart(6, '0')}`;

export interface DeliveryDateDto {
  date: string;
  cutoffAt: string;
  locked: boolean;
}

/** GET /orders/context?employeeId: everything the builder needs for one employee. */
export interface OrderContextDto {
  employee: {
    id: string;
    name: string;
    email: string;
    allergenIds: string[];
    dietaryTagIds: string[];
    canChooseAddress: boolean;
    canChangeDeliveryTime: boolean;
    canChangePackaging: boolean;
  };
  company: { id: string; name: string };
  tier: { id: string; name: string };
  defaults: { addressId: string; deliveryTimeMinutes: number; packagingTypeId: string };
  addresses: Array<{ id: string; label: string; isDefault: boolean }>;
  packagingTypes: Array<{ id: string; name: string }>;
  window: { startMinutes: number; endMinutes: number; slotMinutes: number };
  dates: DeliveryDateDto[];
  /** True when the user may create late (Confirmed) orders on locked dates. */
  canOverride: boolean;
  menu: MenuCategoryView[];
}

export interface OrderQuoteDto {
  lines: NormalisedLine[];
  totalCents: number;
  warnings: AllergenWarning[];
  delivery: {
    date: string;
    timeMinutes: number;
    deliveryAt: string;
    address: { id: string; label: string };
    packaging: { id: string; name: string };
    plannedDispatchReadyAt: string;
    plannedKitchenReadyAt: string;
  };
  cutoffAt: string;
  locked: boolean;
  /** Status the order will get when saved with `place`. */
  resultingStatus: OrderStatus;
}

export interface OrderListItem {
  id: string;
  number: number;
  status: OrderStatus;
  stage: FulfilmentStage | null;
  deliveryDate: string;
  deliveryTimeMinutes: number;
  employee: { id: string; name: string };
  company: { id: string; name: string };
  totalCents: number;
  itemCount: number;
  invoiced: boolean;
  locked: boolean;
}

export interface OrderEventDto {
  id: string;
  type: string;
  at: string;
  actorLabel: string;
  data: unknown;
}

export interface OrderDetail extends OrderListItem {
  version: number;
  source: 'STAFF' | 'DEMO';
  employee: { id: string; name: string; email: string };
  deliveryAt: string;
  cutoffAt: string;
  plannedDispatchReadyAt: string;
  plannedKitchenReadyAt: string;
  address: {
    id: string;
    label: string;
    line1: string;
    line2: string;
    city: string;
    postalCode: string;
    accessNotes: string;
  };
  packaging: { id: string; name: string };
  tier: { id: string; name: string };
  notes: string;
  statusReason: string | null;
  allergenAcknowledged: boolean;
  placedAt: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  rejectedAt: string | null;
  deliveredAt: string | null;
  kitchenStartedAt: string | null;
  kitchenReadyAt: string | null;
  drop: {
    id: string;
    driver: { id: string; name: string } | null;
    dispatchReadyAt: string | null;
    outForDeliveryAt: string | null;
    deliveredAt: string | null;
  } | null;
  invoice: { id: string; number: string } | null;
  lines: Array<{
    id: string;
    dishId: string;
    dishName: string;
    dishSku: string;
    quantity: number;
    dishPriceCents: number;
    totalCents: number;
    combinations: Array<{
      id: string;
      signature: string;
      quantity: number;
      unitPriceCents: number;
      totalCents: number;
      prepStartedAt: string | null;
      prepDoneAt: string | null;
      /** Already recorded short on delivery (FR-BIL-05). */
      shortQuantity: number;
      choices: Array<{
        groupId: string | null;
        groupName: string;
        optionId: string;
        optionName: string;
        portionSizeId: string | null;
        portionSizeName: string | null;
        priceCents: number;
      }>;
    }>;
  }>;
  events: OrderEventDto[];
  adjustments: Array<{
    id: string;
    kind: 'CANCELLATION_CREDIT' | 'SHORT_DELIVERY_CREDIT' | 'MANUAL';
    amountCents: number;
    reason: string;
    createdAt: string;
    invoiced: boolean;
  }>;
  /** What the current user may do right now (the server re-checks every action). */
  actions: {
    edit: boolean;
    place: boolean;
    cancel: boolean;
    reject: boolean;
    overrideDelivery: boolean;
    recordShortage: boolean;
  };
}

export interface CutoffRunDto {
  id: string;
  deliveryDate: string;
  cutoffAt: string;
  trigger: 'SCHEDULED' | 'CATCH_UP' | 'MANUAL';
  triggeredBy: string | null;
  startedAt: string;
  finishedAt: string | null;
  draftsCancelled: number;
  ordersConfirmed: number;
}

export interface CutoffOverviewDto {
  autoCutoffEnabled: boolean;
  nextCutoff: { deliveryDate: string; cutoffAt: string } | null;
  /** Dates with Draft/Placed orders, with their cut-off and whether it has passed. */
  pending: Array<{
    deliveryDate: string;
    cutoffAt: string;
    due: boolean;
    drafts: number;
    placed: number;
  }>;
  upcoming: Array<{ deliveryDate: string; cutoffAt: string }>;
  runs: CutoffRunDto[];
}
