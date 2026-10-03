'use client';

import {
  formatOrderNumber,
  minutesToHHmm,
  OPEN_ORDER_STATUSES,
  type OpenOrdersOnDto,
} from '@fernleaf/shared';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, X } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { useAbility } from '@/lib/auth';
import { formatKitchenDate, STATUS_LABEL } from '@/lib/orders';

const SHOWN = 5;

/** FR-CMP-05: open orders already booked on a date. No company = every company (kitchen holiday). */
export function useOpenOrdersOn(date: string, companyId?: string) {
  const canRead = useAbility().can('read', 'Order');
  const params = new URLSearchParams({ date });
  if (companyId) params.set('companyId', companyId);
  return useQuery({
    queryKey: ['open-orders-on', date, companyId ?? 'all'],
    queryFn: () => api<OpenOrdersOnDto>(`/orders/open-on?${params}`),
    enabled: canRead && /^\d{4}-\d{2}-\d{2}$/.test(date),
  });
}

/**
 * The warning shown while a holiday date is picked, and kept after adding until dismissed.
 * It never changes an order (A-37): the admin decides what happens to each one.
 */
export function HolidayConflicts({
  data,
  companyId,
  added,
  onDismiss,
}: {
  data: OpenOrdersOnDto | undefined;
  companyId?: string;
  added: boolean;
  onDismiss: () => void;
}) {
  if (!data || data.total === 0) return null;
  const all = new URLSearchParams({
    dateFrom: data.date,
    dateTo: data.date,
    status: OPEN_ORDER_STATUSES.join(','),
  });
  if (companyId) all.set('companyId', companyId);
  const orders = `${data.total} open order${data.total === 1 ? '' : 's'}`;
  return (
    <div
      role="alert"
      className="animate-rise space-y-2 rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm dark:bg-amber-950/30"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
        <p className="flex-1 font-medium">
          {added
            ? `Holiday added. ${orders} on ${formatKitchenDate(data.date)} still need a decision.`
            : `${orders} already booked for ${formatKitchenDate(data.date)}.`}
        </p>
        {added && (
          <button
            type="button"
            aria-label="Dismiss"
            className="text-muted-foreground hover:text-foreground"
            onClick={onDismiss}
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        A holiday doesn&apos;t cancel or move orders. Open each one to cancel it or re-book it on
        another day.
      </p>
      <ul className="space-y-0.5 text-xs">
        {data.orders.slice(0, SHOWN).map((o) => (
          <li key={o.id}>
            <Link href={`/orders/${o.id}`} className="font-mono font-medium hover:underline">
              {formatOrderNumber(o.number)}
            </Link>{' '}
            · {minutesToHHmm(o.deliveryTimeMinutes)} · {o.employeeName}
            {!companyId && ` (${o.companyName})`} · {STATUS_LABEL[o.status]}
          </li>
        ))}
      </ul>
      {data.total > SHOWN && (
        <Link href={`/orders?${all}`} className="text-xs font-medium underline">
          See all {data.total} in Orders
        </Link>
      )}
    </div>
  );
}
