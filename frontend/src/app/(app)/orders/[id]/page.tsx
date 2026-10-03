'use client';

import {
  formatOrderNumber,
  formatUsd,
  minutesToHHmm,
  hhmmToMinutes,
  type OrderContextDto,
  type OrderDetail,
} from '@fernleaf/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Check } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { RequireAbility } from '@/components/require-ability';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, api } from '@/lib/api-client';
import { useAbility } from '@/lib/auth';
import { cn } from '@/lib/utils';
import {
  formatIst,
  formatKitchenDate,
  STAGE_LABEL,
  STATUS_LABEL,
  STATUS_VARIANT,
} from '@/lib/orders';

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const order = useQuery({
    queryKey: ['order', id],
    queryFn: () => api<OrderDetail>(`/orders/${id}`),
  });
  return (
    <RequireAbility action="read" subject="Order">
      <div className="max-w-5xl space-y-6">
        <Link
          href="/orders"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden /> Orders
        </Link>
        {order.data ? <OrderView order={order.data} /> : <Skeleton className="h-96" />}
      </div>
    </RequireAbility>
  );
}

const EVENT_LABEL: Record<string, string> = {
  CREATED: 'Created',
  UPDATED: 'Edited',
  PLACED: 'Placed',
  CONFIRMED: 'Confirmed at cut-off',
  LATE_ORDER_CONFIRMED: 'Late order confirmed',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
  KITCHEN_STARTED: 'Kitchen started',
  KITCHEN_READY: 'Kitchen ready',
  KITCHEN_FORCE_COMPLETED: 'Kitchen force-completed',
  DROP_ASSIGNED: 'Added to a delivery drop',
  DRIVER_ASSIGNED: 'Driver assigned',
  DISPATCH_READY: 'Packed for dispatch',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  DELIVERY_OVERRIDDEN: 'Delivery details changed',
  INVOICED: 'Invoiced',
  ADJUSTMENT_ADDED: 'Billing adjustment',
};

function OrderView({ order }: { order: OrderDetail }) {
  const queryClient = useQueryClient();
  const canSeeMoney = useAbility().can('read', 'Money');
  const [reasonFor, setReasonFor] = useState<'cancel' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [overriding, setOverriding] = useState(false);
  const [shorting, setShorting] = useState(false);
  const money = (c: number | undefined) => (canSeeMoney && c !== undefined ? formatUsd(c) : '');

  async function act(path: string, body: unknown, ok: string) {
    try {
      await api(`/orders/${order.id}${path}`, { method: 'POST', body: JSON.stringify(body) });
      toast.success(ok);
      setReasonFor(null);
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['order', order.id] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Something went wrong');
    }
  }

  const units = order.lines.flatMap((l) => l.combinations);
  const done = units.filter((u) => u.prepDoneAt).length;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="flex flex-wrap items-center gap-2 page-title">
            <span className="font-mono">{formatOrderNumber(order.number)}</span>
            <Badge variant={STATUS_VARIANT[order.status]}>{STATUS_LABEL[order.status]}</Badge>
            {order.stage && order.stage !== 'DELIVERED' && (
              <Badge variant="outline">{STAGE_LABEL[order.stage]}</Badge>
            )}
            {order.source === 'DEMO' && <Badge variant="outline">Demo data</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground">
            {order.employee.name} ({order.employee.email}) ·{' '}
            <Link href={`/companies/${order.company.id}`} className="hover:underline">
              {order.company.name}
            </Link>{' '}
            · {order.tier.name} tier
          </p>
          {order.statusReason && <p className="text-sm">Reason: {order.statusReason}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {order.actions.edit && (
            <Link
              href={`/orders/${order.id}/edit`}
              className={buttonVariants({ variant: 'outline' })}
            >
              Edit
            </Link>
          )}
          {order.actions.place && (
            <Button onClick={() => void act('/place', { version: order.version }, 'Order placed')}>
              Place
            </Button>
          )}
          {order.actions.overrideDelivery && !overriding && (
            <Button variant="outline" onClick={() => setOverriding(true)}>
              Change delivery
            </Button>
          )}
          {order.actions.cancel && (
            <Button variant="outline" onClick={() => setReasonFor('cancel')}>
              Cancel order
            </Button>
          )}
          {order.actions.reject && (
            <Button variant="outline" onClick={() => setReasonFor('reject')}>
              Reject
            </Button>
          )}
          {order.actions.recordShortage && !shorting && (
            <Button variant="outline" onClick={() => setShorting(true)}>
              Record shortage
            </Button>
          )}
        </div>
      </div>

      <Lifecycle order={order} />

      {reasonFor && (
        <Card>
          <CardContent className="flex flex-wrap items-end gap-2 pt-6">
            <div className="min-w-64 flex-1 space-y-1">
              <Label htmlFor="reason">
                {reasonFor === 'cancel'
                  ? 'Why is it being cancelled?'
                  : 'Why is it being rejected?'}
              </Label>
              <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <Button
              variant="destructive"
              disabled={reason.trim().length < 3}
              onClick={() =>
                void act(
                  `/${reasonFor}`,
                  { reason, version: order.version },
                  reasonFor === 'cancel' ? 'Order cancelled' : 'Order rejected',
                )
              }
            >
              {reasonFor === 'cancel' ? 'Cancel order' : 'Reject order'}
            </Button>
            <Button variant="ghost" onClick={() => setReasonFor(null)}>
              Keep it
            </Button>
          </CardContent>
        </Card>
      )}
      {overriding && <OverrideForm order={order} onDone={() => setOverriding(false)} />}
      {shorting && <ShortageForm order={order} onDone={() => setShorting(false)} />}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Delivery</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">
              {formatKitchenDate(order.deliveryDate)} at {minutesToHHmm(order.deliveryTimeMinutes)}{' '}
              IST
            </p>
            <p>
              {order.address.label}:{' '}
              {[
                order.address.line1,
                order.address.line2,
                `${order.address.city} ${order.address.postalCode}`,
              ]
                .filter(Boolean)
                .join(', ')}
            </p>
            {order.address.accessNotes && (
              <p className="text-muted-foreground">{order.address.accessNotes}</p>
            )}
            <p>Packaging: {order.packaging.name}</p>
            {order.notes && <p>Notes: {order.notes}</p>}
            <p className="pt-2 text-muted-foreground">
              Cut-off {formatIst(order.cutoffAt, true)}
              {order.locked ? ' (passed)' : ''}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Plan and progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row
              label="Kitchen-ready by"
              plan={order.plannedKitchenReadyAt}
              actual={order.kitchenReadyAt}
            />
            <Row
              label="Leaves the kitchen by"
              plan={order.plannedDispatchReadyAt}
              actual={order.drop?.outForDeliveryAt ?? null}
            />
            <Row label="Delivered by" plan={order.deliveryAt} actual={order.deliveredAt} />
            <p className="pt-2">
              Prep units: {done} / {units.length} done
            </p>
            {order.drop ? (
              <p>
                Drop driver: {order.drop.driver?.name ?? 'not assigned yet'}
                {order.drop.dispatchReadyAt && ` · packed ${formatIst(order.drop.dispatchReadyAt)}`}
              </p>
            ) : (
              order.status === 'CONFIRMED' && <p className="text-muted-foreground">No drop yet.</p>
            )}
            {order.invoice && (
              <p>
                Invoice:{' '}
                <Link href={`/billing/invoices/${order.invoice.id}`} className="hover:underline">
                  {order.invoice.number}
                </Link>
              </p>
            )}
            {order.allergenAcknowledged && (
              <p className="flex items-center gap-1 text-amber-700">
                <AlertTriangle className="size-3.5" aria-hidden /> Allergen warning acknowledged
                when placed
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {order.lines.map((l) => (
            <div key={l.id} className="rounded-lg border p-3">
              <div className="flex justify-between font-medium">
                <span>
                  {l.dishName} × {l.quantity}{' '}
                  <span className="font-mono text-xs text-muted-foreground">{l.dishSku}</span>
                </span>
                <span className="tabular-nums">{money(l.totalCents)}</span>
              </div>
              {l.combinations.map((c) => (
                <div key={c.id} className="flex justify-between gap-2 pl-3 text-muted-foreground">
                  <span>
                    {c.prepDoneAt ? (
                      <Check className="mr-1 inline size-3.5 text-green-600" aria-label="Done" />
                    ) : null}
                    {c.quantity} ×{' '}
                    {c.choices
                      .map(
                        (ch) =>
                          `${ch.optionName}${ch.portionSizeName ? ` (${ch.portionSizeName})` : ''}`,
                      )
                      .join(', ') || 'as is'}
                  </span>
                  <span className="tabular-nums">
                    {canSeeMoney &&
                      `${money(c.unitPriceCents)} × ${c.quantity} = ${money(c.totalCents)}`}
                  </span>
                </div>
              ))}
            </div>
          ))}
          {canSeeMoney && (
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <span>Order total</span>
              <span className="tabular-nums">{money(order.totalCents)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {order.adjustments.length > 0 && canSeeMoney && (
        <Card>
          <CardHeader>
            <CardTitle>Billing adjustments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {order.adjustments.map((a) => (
              <div key={a.id} className="flex justify-between gap-2">
                <span>
                  {a.reason}{' '}
                  <span className="text-muted-foreground">
                    · {formatIst(a.createdAt, true)} ·{' '}
                    {a.invoiced ? 'on an invoice' : 'next invoice'}
                  </span>
                </span>
                <span className="tabular-nums text-green-700">{money(a.amountCents)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="stagger relative space-y-4 border-l border-border pl-5 text-sm">
            {order.events.map((e, i) => (
              <li key={e.id} className="relative">
                <span
                  className={cn(
                    'absolute top-1.5 -left-[25px] size-2.5 rounded-full ring-4 ring-card',
                    i === order.events.length - 1 ? 'bg-sidebar-primary' : 'bg-primary/60',
                  )}
                />
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{EVENT_LABEL[e.type] ?? e.type}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatIst(e.at, true)} · by {e.actorLabel}
                  </span>
                </div>
                {describeEvent(e.data) && (
                  <div className="text-xs text-muted-foreground">{describeEvent(e.data)}</div>
                )}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </>
  );
}

const STEPS = ['Draft', 'Placed', 'Confirmed', 'Cooking', 'Cooked', 'Packed', 'Out', 'Delivered'];
const STAGE_STEP: Record<NonNullable<OrderDetail['stage']>, number> = {
  QUEUED: 2,
  IN_PREP: 3,
  KITCHEN_READY: 4,
  DISPATCH_READY: 5,
  OUT_FOR_DELIVERY: 6,
  DELIVERED: 7,
};

/** Where the order is in its life, from draft to delivered. Hidden once cancelled or rejected. */
function Lifecycle({ order }: { order: OrderDetail }) {
  if (order.status === 'CANCELLED' || order.status === 'REJECTED') return null;
  const at =
    order.status === 'DRAFT'
      ? 0
      : order.status === 'PLACED'
        ? 1
        : order.status === 'DELIVERED'
          ? 7
          : order.stage
            ? STAGE_STEP[order.stage]
            : 2;
  return (
    <div className="animate-rise overflow-x-auto rounded-xl border bg-card p-4 shadow-(--shadow-card)">
      <ol className="flex min-w-[560px] items-start">
        {STEPS.map((label, i) => {
          const complete = i < at || (i === at && at === STEPS.length - 1);
          return (
            <li key={label} className="flex flex-1 flex-col items-center gap-1.5 last:flex-none">
              <div className="flex w-full items-center">
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors',
                    complete && 'bg-primary text-primary-foreground',
                    i === at &&
                      !complete &&
                      'bg-sidebar-primary text-sidebar-primary-foreground ring-4 ring-sidebar-primary/20',
                    i > at && 'bg-muted text-muted-foreground',
                  )}
                >
                  {complete ? <Check className="size-3.5" aria-hidden /> : i + 1}
                </span>
                {i < STEPS.length - 1 && (
                  <span
                    className={cn(
                      'mx-1 h-0.5 flex-1 rounded-full',
                      i < at ? 'bg-primary' : 'bg-muted',
                    )}
                  />
                )}
              </div>
              <span
                className={cn(
                  'w-full text-[11px]',
                  i === at ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function describeEvent(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (typeof d.reason === 'string') return d.reason;
  if (d.before && d.after) {
    const b = d.before as Record<string, string>;
    const a = d.after as Record<string, string>;
    return Object.keys(a)
      .filter((k) => a[k] !== b[k])
      .map((k) => `${k}: ${b[k]} → ${a[k]}`)
      .join(' · ');
  }
  return null;
}

function Row({ label, plan, actual }: { label: string; plan: string; actual: string | null }) {
  const late = actual ? new Date(actual) > new Date(plan) : false;
  return (
    <p className="flex justify-between gap-2">
      <span>{label}</span>
      <span className="tabular-nums">
        {formatIst(plan)}
        {actual && (
          <span className={late ? 'text-destructive' : 'text-green-700'}>
            {' '}
            · done {formatIst(actual)}
          </span>
        )}
      </span>
    </p>
  );
}

/** FR-ORD-08: admin changes time, address or packaging until the drop leaves. Flags don't apply. */
function OverrideForm({ order, onDone }: { order: OrderDetail; onDone: () => void }) {
  const queryClient = useQueryClient();
  const ctx = useQuery({
    queryKey: ['order-context', order.employee.id],
    queryFn: () => api<OrderContextDto>(`/orders/context?employeeId=${order.employee.id}`),
  });
  const [time, setTime] = useState(minutesToHHmm(order.deliveryTimeMinutes));
  const [addressId, setAddressId] = useState(order.address.id);
  const [packagingId, setPackagingId] = useState(order.packaging.id);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const body: Record<string, unknown> = { version: order.version };
    if (hhmmToMinutes(time) !== order.deliveryTimeMinutes)
      body.deliveryTimeMinutes = hhmmToMinutes(time);
    if (addressId !== order.address.id) body.addressId = addressId;
    if (packagingId !== order.packaging.id) body.packagingTypeId = packagingId;
    try {
      await api(`/orders/${order.id}/delivery`, { method: 'PATCH', body: JSON.stringify(body) });
      toast.success('Delivery details changed');
      void queryClient.invalidateQueries({ queryKey: ['order', order.id] });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change the delivery');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change delivery (admin override)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="ov-time">Time (IST)</Label>
            <Input
              id="ov-time"
              type="time"
              step={900}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ov-address">Address</Label>
            <NativeSelect
              id="ov-address"
              className="w-full"
              value={addressId}
              onChange={(e) => setAddressId(e.target.value)}
            >
              {(
                ctx.data?.addresses ?? [
                  { id: order.address.id, label: order.address.label, isDefault: false },
                ]
              ).map((a) => (
                <NativeSelectOption key={a.id} value={a.id}>
                  {a.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ov-pack">Packaging</Label>
            <NativeSelect
              id="ov-pack"
              className="w-full"
              value={packagingId}
              onChange={(e) => setPackagingId(e.target.value)}
            >
              {(ctx.data?.packagingTypes ?? [order.packaging]).map((p) => (
                <NativeSelectOption key={p.id} value={p.id}>
                  {p.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Plans are recalculated and the order moves to the matching delivery drop.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button onClick={() => void save()}>Save change</Button>
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** FR-BIL-05: short quantities per combination become a credit on the next invoice. */
function ShortageForm({ order, onDone }: { order: OrderDetail; onDone: () => void }) {
  const queryClient = useQueryClient();
  const combos = order.lines.flatMap((l) =>
    l.combinations.map((c) => ({
      ...c,
      dishName: l.dishName,
      label: c.choices.map((ch) => ch.optionName).join(', '),
      remaining: c.quantity - c.shortQuantity,
    })),
  );
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const credit = combos.reduce((s, c) => s + (qty[c.id] ?? 0) * c.unitPriceCents, 0);

  async function save() {
    try {
      await api(`/orders/${order.id}/shortage`, {
        method: 'POST',
        body: JSON.stringify({
          reason,
          items: combos
            .map((c) => ({ combinationId: c.id, shortQty: qty[c.id] ?? 0 }))
            .filter((i) => i.shortQty > 0),
        }),
      });
      toast.success('Shortage recorded; the credit goes on the next invoice');
      void queryClient.invalidateQueries({ queryKey: ['order', order.id] });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record the shortage');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record a short delivery</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {combos.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {c.dishName}
              {c.label ? ` (${c.label})` : ''} · ordered {c.quantity}
              {c.shortQuantity > 0 ? `, already short ${c.shortQuantity}` : ''}
            </span>
            <Input
              type="number"
              aria-label={`Short quantity for ${c.dishName}`}
              className="w-20"
              min={0}
              max={c.remaining}
              value={qty[c.id] ?? 0}
              onChange={(e) =>
                setQty({
                  ...qty,
                  [c.id]: Math.max(0, Math.min(c.remaining, Number(e.target.value))),
                })
              }
            />
          </div>
        ))}
        <div className="space-y-1">
          <Label htmlFor="short-reason">What happened?</Label>
          <Input
            id="short-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="One bowl missing from the bag"
          />
        </div>
        <p>Credit: {formatUsd(-credit)}</p>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button disabled={credit === 0 || reason.trim().length < 3} onClick={() => void save()}>
            Record shortage
          </Button>
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
