'use client';

import { type AdminDashboardDto, formatUsd } from '@fernleaf/shared';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Timer, Truck, UtensilsCrossed } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api-client';
import { formatIst, formatKitchenDate } from '@/lib/orders';
import { Metric, Panel, ratio } from './metric';

/** PRD §8.2: "Is today on track, what needs me, are we getting paid?" */
export function AdminSection() {
  const q = useQuery({
    queryKey: ['dashboard-admin'],
    queryFn: () => api<AdminDashboardDto>('/dashboard/admin'),
    refetchInterval: 60_000,
  });
  const d = q.data;
  if (!d) return <Skeleton className="h-96" />;
  const today = d.onTime.at(-1)!;
  const week = d.onTime.reduce(
    (t, x) => ({ delivered: t.delivered + x.delivered, onTime: t.onTime + x.onTime }),
    { delivered: 0, onTime: 0 },
  );
  const late = d.today.lateUnits + d.today.lateDrops;
  const maxRevenue = Math.max(1, ...d.revenue.days.map((x) => x.cents));
  const daysOpen = d.openInvoices.oldestIssuedAt
    ? Math.floor((Date.parse(d.now) - Date.parse(d.openInvoices.oldestIssuedAt)) / 86_400_000)
    : null;
  const gaps =
    d.setupGaps.unpricedDishes.length +
    d.setupGaps.companiesWithoutDriver.length +
    d.setupGaps.dishesWithoutStation.length;

  return (
    <div className="space-y-4">
      {d.pendingProcessing.length > 0 && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-400 bg-red-50 p-3 text-sm dark:bg-red-950/40"
        >
          <span>
            Cut-off processing is pending for{' '}
            {d.pendingProcessing.map((p) => formatKitchenDate(p.deliveryDate)).join(', ')}: orders
            are past their cut-off but not yet confirmed.
          </span>
          <Link href="/cutoff" className={buttonVariants({ size: 'sm', variant: 'destructive' })}>
            Run now
          </Link>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Orders today"
          icon={UtensilsCrossed}
          value={d.today.orders}
          hint={`${d.today.meals} meals`}
        />
        <Metric
          label="Delivery progress"
          icon={Truck}
          value={`${d.today.dropsDelivered}/${d.today.drops}`}
          hint={`drops delivered · ${ratio(d.today.dropsDelivered, d.today.drops)}`}
        />
        <Metric
          label="On time"
          icon={Timer}
          value={ratio(today.onTime, today.delivered)}
          hint={`today (${today.onTime}/${today.delivered}) · 7 days ${ratio(week.onTime, week.delivered)}`}
          tone={today.rate !== null && today.rate < 0.8 ? 'amber' : undefined}
        />
        <Metric
          label="Late right now"
          icon={AlertTriangle}
          value={late}
          hint={`${d.today.lateUnits} kitchen item${d.today.lateUnits === 1 ? '' : 's'} · ${d.today.lateDrops} drop${d.today.lateDrops === 1 ? '' : 's'}`}
          tone={late > 0 ? 'red' : 'green'}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Next cut-off"
          action={
            <Link href="/cutoff" className="text-xs underline">
              Cut-off page
            </Link>
          }
        >
          {d.nextCutoff ? (
            <div className="space-y-1">
              <p className="text-lg font-semibold">{formatIst(d.nextCutoff.cutoffAt, true)}</p>
              <p>for {formatKitchenDate(d.nextCutoff.deliveryDate)} deliveries</p>
              <p>
                <Badge variant="outline">{d.nextCutoff.drafts} drafts will be cancelled</Badge>{' '}
                <Badge>{d.nextCutoff.placed} placed will be confirmed</Badge>
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">No upcoming cut-off.</p>
          )}
        </Panel>
        <Panel title="Next 7 days">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="text-left font-normal">Date</th>
                <th className="text-right font-normal">Conf.</th>
                <th className="text-right font-normal">Placed</th>
                <th className="text-right font-normal">Draft</th>
                <th className="text-right font-normal">Meals</th>
              </tr>
            </thead>
            <tbody>
              {d.pipeline.map((p) => (
                <tr key={p.date}>
                  <td>
                    {formatKitchenDate(p.date)}
                    {p.kitchenHoliday && (
                      <Badge variant="outline" className="ml-1">
                        kitchen closed
                      </Badge>
                    )}
                  </td>
                  <td className="text-right tabular-nums">{p.confirmed}</td>
                  <td className="text-right tabular-nums">{p.placed}</td>
                  <td className="text-right tabular-nums">{p.draft}</td>
                  <td className="text-right font-medium tabular-nums">{p.meals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel
          title="Getting paid"
          action={
            <Link href="/billing" className="text-xs underline">
              Billing
            </Link>
          }
        >
          <div className="space-y-2">
            <div>
              <div className="text-xs text-muted-foreground">Not yet invoiced</div>
              <div className="text-lg font-semibold tabular-nums">
                {formatUsd(d.uninvoiced.cents)}
              </div>
              <ul className="text-xs">
                {d.uninvoiced.top.map((t) => (
                  <li key={t.companyId} className="flex justify-between">
                    <span>{t.companyName}</span>
                    <span className="tabular-nums">{formatUsd(t.cents)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Open invoices</div>
              <div className="font-semibold tabular-nums">
                {d.openInvoices.count} · {formatUsd(d.openInvoices.cents)}
              </div>
              {daysOpen !== null && (
                <div className="text-xs text-muted-foreground">
                  oldest issued {daysOpen} days ago
                </div>
              )}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Paid in the last 30 days</div>
              <div className="font-semibold tabular-nums">{formatUsd(d.paidLast30DaysCents)}</div>
            </div>
          </div>
        </Panel>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Booked revenue by delivery date">
            <div className="flex h-36 items-end gap-1" aria-label="Revenue chart">
              {d.revenue.days.map((x) => (
                <div
                  key={x.date}
                  className="flex flex-1 flex-col items-center gap-1"
                  title={`${formatKitchenDate(x.date)}: ${formatUsd(x.cents)}`}
                >
                  <div
                    className={
                      x.future
                        ? 'w-full rounded-t bg-primary/30'
                        : x.date === d.date
                          ? 'w-full rounded-t bg-amber-500'
                          : 'w-full rounded-t bg-primary'
                    }
                    style={{ height: `${Math.max(2, (x.cents / maxRevenue) * 120)}px` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>{formatKitchenDate(d.revenue.days[0]!.date)}</span>
              <span>today</span>
              <span>{formatKitchenDate(d.revenue.days.at(-1)!.date)} (confirmed so far)</span>
            </div>
            <p className="mt-2 text-xs">
              This week so far {formatUsd(d.revenue.thisWeekCents)} vs{' '}
              {formatUsd(d.revenue.lastWeekCents)} by the same day last week
            </p>
          </Panel>
        </div>
        <Panel title={`Setup gaps (${gaps})`}>
          {gaps === 0 && <p className="text-muted-foreground">Nothing missing.</p>}
          {d.setupGaps.unpricedDishes.length > 0 && (
            <div className="mb-2">
              <div className="text-xs font-medium">
                Dishes on the menu with no price on a tier in use
              </div>
              <ul className="text-xs text-muted-foreground">
                {d.setupGaps.unpricedDishes.slice(0, 6).map((g) => (
                  <li key={`${g.dishId}-${g.tierName}`}>
                    <Link href={`/catalogue/dishes/${g.dishId}`} className="hover:underline">
                      {g.dishName}
                    </Link>{' '}
                    · {g.tierName}
                  </li>
                ))}
                {d.setupGaps.unpricedDishes.length > 6 && (
                  <li>+{d.setupGaps.unpricedDishes.length - 6} more (see Pricing)</li>
                )}
              </ul>
            </div>
          )}
          {d.setupGaps.companiesWithoutDriver.length > 0 && (
            <div className="mb-2">
              <div className="text-xs font-medium">Companies without a default driver</div>
              <ul className="text-xs text-muted-foreground">
                {d.setupGaps.companiesWithoutDriver.map((c) => (
                  <li key={c.id}>
                    <Link href={`/companies/${c.id}`} className="hover:underline">
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {d.setupGaps.dishesWithoutStation.length > 0 && (
            <div>
              <div className="text-xs font-medium">Dishes without a kitchen station</div>
              <ul className="text-xs text-muted-foreground">
                {d.setupGaps.dishesWithoutStation.map((x) => (
                  <li key={x.id}>
                    <Link href={`/catalogue/dishes/${x.id}`} className="hover:underline">
                      {x.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
