import type { FulfilmentStage, OrderStatus } from '@fernleaf/shared';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  DRAFT: 'Draft',
  PLACED: 'Placed',
  CONFIRMED: 'Confirmed',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
};

export const STATUS_VARIANT: Record<
  OrderStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  DRAFT: 'outline',
  PLACED: 'secondary',
  CONFIRMED: 'default',
  DELIVERED: 'secondary',
  CANCELLED: 'outline',
  REJECTED: 'destructive',
};

export const STAGE_LABEL: Record<FulfilmentStage, string> = {
  QUEUED: 'Queued',
  IN_PREP: 'In prep',
  KITCHEN_READY: 'Kitchen ready',
  DISPATCH_READY: 'Packed',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
};

/** "Mon 5 Oct" for a YYYY-MM-DD kitchen date (no time-zone shift: it is a calendar date). */
export function formatKitchenDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/** An instant shown in kitchen time. */
export function formatIst(iso: string, withDate = false): string {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    ...(withDate ? { weekday: 'short', day: 'numeric', month: 'short' } : {}),
  });
}
