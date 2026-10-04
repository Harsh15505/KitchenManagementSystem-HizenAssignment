'use client';

import { type AdminDashboardDto, formatUsd } from '@fernleaf/shared';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  LockKeyhole,
  MapPinOff,
  Tags,
  Timer,
  UtensilsCrossed,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CountUp } from '@/components/count-up';
import {
  ListBox,
  ListBoxEmpty,
  ListBoxFooter,
  ListBoxHeader,
  ListBoxRow,
  ListBoxRows,
} from '@/components/list-box';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api-client';
import { formatIst, formatKitchenDate } from '@/lib/orders';
import { cn, plural } from '@/lib/utils';
import { Countdown } from './countdown';
import { Panel, ratio } from './metric';

/** PRD §8.2: "Is today on track, what needs me, are we getting paid?" */
export function AdminSection() {
  const q = useQuery({
    queryKey: ['dashboard-admin'],
    queryFn: () => api<AdminDashboardDto>('/dashboard/admin'),
    refetchInterval: 60_000,
  });
  const d = q.data;
  if (!d) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  const today = d.onTime.at(-1)!;
  const week = d.onTime.reduce(
    (t, x) => ({ delivered: t.delivered + x.delivered, onTime: t.onTime + x.onTime }),
    { delivered: 0, onTime: 0 },
  );
  const late = d.today.lateUnits + d.today.lateDrops;
  const gaps =
    d.setupGaps.unpricedDishes.length +
    d.setupGaps.companiesWithoutDriver.length +
    d.setupGaps.dishesWithoutStation.length;
  const weekDelta =
    d.revenue.lastWeekCents === 0 ? null : d.revenue.thisWeekCents / d.revenue.lastWeekCents - 1;

  return (
    <div className="space-y-5">
      {d.pendingProcessing.length > 0 && (
        <div
          role="alert"
          className="animate-rise flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950/40"
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-red-600" aria-hidden />
            Cut-off processing is pending for{' '}
            {d.pendingProcessing.map((p) => formatKitchenDate(p.deliveryDate)).join(', ')}.
          </span>
          <Link href="/cutoff" className={buttonVariants({ size: 'sm', variant: 'destructive' })}>
            Run now
          </Link>
        </div>
      )}

      {/* First glance, no scrolling at 1440×900: today, the next cut-off, what needs the admin,
          the week ahead and money. Trends and the setup-gap detail follow below the fold. */}
      <div className="stagger grid gap-4 lg:grid-cols-12">
        <HeroToday
          d={d}
          onTimeToday={ratio(today.onTime, today.delivered)}
          onTimeWeek={ratio(week.onTime, week.delivered)}
          onTimeLow={today.rate !== null && today.rate < 0.8}
          className="lg:col-span-12 xl:col-span-5"
        />

        <Panel
          title="Next cut-off"
          tone="accent"
          className="lg:col-span-7 xl:col-span-4"
          action={
            <Link href="/cutoff" className="text-xs font-medium text-primary hover:underline">
              Cut-off page →
            </Link>
          }
        >
          {d.nextCutoff ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-card text-accent-foreground shadow-sm">
                  <LockKeyhole className="size-5" aria-hidden />
                </span>
                <div>
                  <div className="font-heading text-2xl leading-tight font-semibold">
                    <Countdown to={d.nextCutoff.cutoffAt} now={d.now} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatIst(d.nextCutoff.cutoffAt, true)} · for{' '}
                    {formatKitchenDate(d.nextCutoff.deliveryDate)}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-card/80 p-3">
                  <div className="font-heading text-2xl font-semibold">
                    <CountUp value={d.nextCutoff.placed} />
                  </div>
                  <div className="text-xs text-muted-foreground">placed → confirmed</div>
                </div>
                <div className="rounded-xl bg-card/80 p-3">
                  <div className="font-heading text-2xl font-semibold">
                    <CountUp value={d.nextCutoff.drafts} />
                  </div>
                  <div className="text-xs text-muted-foreground">drafts → cancelled</div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No upcoming cut-off.</p>
          )}
        </Panel>

        <AttentionCard d={d} late={late} gaps={gaps} className="lg:col-span-5 xl:col-span-3" />

        <Panel title="Next 7 days" className="lg:col-span-7">
          <PipelineChart pipeline={d.pipeline} />
        </Panel>

        <Panel
          title="Getting paid"
          tone="soft"
          className="lg:col-span-5"
          action={
            <Link href="/billing" className="text-xs font-medium text-primary hover:underline">
              Billing →
            </Link>
          }
        >
          <GettingPaid d={d} />
        </Panel>

        <div className="lg:col-span-8">
          <Panel
            title="Booked revenue"
            className="h-full"
            action={
              weekDelta !== null && (
                <Badge variant={weekDelta >= 0 ? 'success' : 'warning'}>
                  {weekDelta >= 0 ? <ArrowUpRight aria-hidden /> : <ArrowDownRight aria-hidden />}
                  {Math.abs(Math.round(weekDelta * 100))}% vs last week
                </Badge>
              )
            }
          >
            <RevenueChart d={d} />
          </Panel>
        </div>
        <Panel title="On time, last 7 days" className="lg:col-span-4">
          <OnTimeChart days={d.onTime} />
        </Panel>

        <div id="setup-gaps" className="scroll-mt-24 lg:col-span-12">
          <Panel
            title={gaps === 0 ? 'Setup gaps' : `Setup gaps · ${gaps}`}
            className="border-dashed"
          >
            {gaps === 0 ? (
              <p className="flex items-center gap-2 text-muted-foreground">
                <BadgeCheck className="size-4 text-emerald-600" aria-hidden /> Nothing missing.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <GapList
                  icon={Tags}
                  title="Unpriced on a tier in use"
                  items={d.setupGaps.unpricedDishes.map((g) => ({
                    key: `${g.dishId}-${g.tierName}`,
                    href: `/catalogue/dishes/${g.dishId}`,
                    label: g.dishName,
                    note: g.tierName,
                  }))}
                />
                <GapList
                  icon={Building2}
                  title="Companies without a default driver"
                  items={d.setupGaps.companiesWithoutDriver.map((c) => ({
                    key: c.id,
                    href: `/companies/${c.id}`,
                    label: c.name,
                  }))}
                />
                <GapList
                  icon={MapPinOff}
                  title="Dishes without a kitchen station"
                  items={d.setupGaps.dishesWithoutStation.map((x) => ({
                    key: x.id,
                    href: `/catalogue/dishes/${x.id}`,
                    label: x.name,
                  }))}
                />
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

/** The dark hero card: today's size, the delivery ring and the on-time figures. */
function HeroToday({
  d,
  onTimeToday,
  onTimeWeek,
  onTimeLow,
  className,
}: {
  d: AdminDashboardDto;
  onTimeToday: string;
  onTimeWeek: string;
  onTimeLow: boolean;
  className?: string;
}) {
  const pct = d.today.drops === 0 ? 0 : d.today.dropsDelivered / d.today.drops;
  return (
    <div
      className={cn(
        'animate-rise relative overflow-hidden rounded-2xl bg-gradient-to-br from-[oklch(0.32_0.075_155)] to-[oklch(0.2_0.05_158)] p-5 text-sidebar-foreground shadow-(--shadow-card)',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full bg-sidebar-primary/20 blur-3xl"
      />
      <div className="relative flex h-full flex-col justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-medium tracking-wider text-sidebar-primary uppercase">
          <UtensilsCrossed className="size-4" aria-hidden /> Today · {formatKitchenDate(d.date)}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="font-heading text-6xl leading-none font-semibold text-sidebar-accent-foreground">
              <CountUp value={d.today.orders} />
            </div>
            <div className="mt-2 text-sm text-sidebar-foreground/80">
              {d.today.orders === 1 ? 'order' : 'orders'} · {plural(d.today.meals, 'meal')} in the
              boxes
            </div>
          </div>
          <Ring
            pct={pct}
            label={`${d.today.dropsDelivered}/${d.today.drops}`}
            caption="delivered"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/[0.07] px-3 py-2 ring-1 ring-white/10">
            <div className="flex items-center gap-1.5 text-xs text-sidebar-foreground/75">
              <Timer className="size-3.5" aria-hidden /> On time today
            </div>
            <div
              className={cn(
                'font-heading text-2xl font-semibold',
                onTimeLow ? 'text-amber-300' : 'text-sidebar-accent-foreground',
              )}
            >
              {onTimeToday}
            </div>
          </div>
          <div className="rounded-xl bg-white/[0.07] px-3 py-2 ring-1 ring-white/10">
            <div className="flex items-center gap-1.5 text-xs text-sidebar-foreground/75">
              <CalendarClock className="size-3.5" aria-hidden /> On time, 7 days
            </div>
            <div className="font-heading text-2xl font-semibold text-sidebar-accent-foreground">
              {onTimeWeek}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A circular progress ring; the arc grows in on first paint. */
function Ring({ pct, label, caption }: { pct: number; label: string; caption: string }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const r = 46;
  const c = 2 * Math.PI * r;
  return (
    <div
      className="relative size-28 shrink-0"
      role="img"
      aria-label={`${label} drops ${caption}, ${Math.round(pct * 100)} percent`}
    >
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-white/10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className="stroke-sidebar-primary transition-[stroke-dashoffset] duration-1000 ease-out"
          strokeDasharray={c}
          strokeDashoffset={shown ? c * (1 - pct) : c}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-xl font-semibold text-sidebar-accent-foreground">
          {label}
        </span>
        <span className="text-[11px] text-sidebar-foreground/75">{caption}</span>
      </div>
    </div>
  );
}

/**
 * "What needs me?": three figures that should all be zero on a good day. Each row links to where
 * the problem is fixed. Red when work is late or a cut-off is unprocessed, amber for setup gaps.
 */
function AttentionCard({
  d,
  late,
  gaps,
  className,
}: {
  d: AdminDashboardDto;
  late: number;
  gaps: number;
  className?: string;
}) {
  const pending = d.pendingProcessing.length;
  const rows = [
    {
      label: 'Late right now',
      value: late,
      detail: `${d.today.lateUnits} kitchen item${d.today.lateUnits === 1 ? '' : 's'} · ${d.today.lateDrops} drop${d.today.lateDrops === 1 ? '' : 's'}`,
      href: '/kitchen',
      tone: 'red',
    },
    {
      label: 'Cut-off not processed',
      value: pending,
      detail:
        pending === 0
          ? 'every passed cut-off is done'
          : d.pendingProcessing.map((p) => formatKitchenDate(p.deliveryDate)).join(', '),
      href: '/cutoff',
      tone: 'red',
    },
    {
      label: 'Setup gaps',
      value: gaps,
      detail: 'unpriced dishes, no driver, no station',
      href: '#setup-gaps',
      tone: 'amber',
    },
  ] as const;
  const urgent = late > 0 || pending > 0;
  return (
    <div
      className={cn(
        'animate-rise flex flex-col rounded-2xl p-4 ring-1 shadow-(--shadow-card)',
        urgent
          ? 'bg-red-50 text-red-950 ring-red-300 dark:bg-red-950/40 dark:text-red-50 dark:ring-red-900'
          : gaps > 0
            ? 'bg-amber-50 text-amber-950 ring-amber-300 dark:bg-amber-950/30 dark:text-amber-50 dark:ring-amber-900'
            : 'bg-emerald-50 text-emerald-950 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-50 dark:ring-emerald-900',
        className,
      )}
    >
      <div className="flex items-center justify-between text-xs font-medium tracking-wide uppercase">
        Needs you
        {urgent || gaps > 0 ? (
          <AlertTriangle className="size-4" aria-hidden />
        ) : (
          <BadgeCheck className="size-4" aria-hidden />
        )}
      </div>
      <ul className="mt-3 flex flex-1 flex-col justify-between gap-2">
        {rows.map((r) => (
          <li key={r.label}>
            <Link
              href={r.href}
              className="flex items-center justify-between gap-3 rounded-lg bg-white/65 px-3 py-2 transition-colors hover:bg-white/90 dark:bg-white/5 dark:hover:bg-white/10"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium">{r.label}</span>
                <span className="block truncate text-[11px] opacity-75">{r.detail}</span>
              </span>
              <span
                className={cn(
                  'font-heading text-2xl font-semibold tabular-nums',
                  r.value > 0 && r.tone === 'red' && 'text-red-700 dark:text-red-300',
                  r.value > 0 && r.tone === 'amber' && 'text-amber-700 dark:text-amber-300',
                )}
              >
                {r.value}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PipelineChart({ pipeline }: { pipeline: AdminDashboardDto['pipeline'] }) {
  const max = Math.max(1, ...pipeline.map((p) => p.confirmed + p.placed + p.draft));
  return (
    <div className="space-y-2">
      {pipeline.map((p, i) => {
        const total = p.confirmed + p.placed + p.draft;
        return (
          <div key={p.date} className="grid grid-cols-[4.5rem_1fr_4rem] items-center gap-2 text-xs">
            <span className="text-muted-foreground">{formatKitchenDate(p.date)}</span>
            <div
              className="flex h-5 overflow-hidden rounded-md bg-muted"
              title={`${p.confirmed} confirmed · ${p.placed} placed · ${p.draft} draft`}
            >
              {p.kitchenHoliday ? (
                // A kitchen holiday with orders booked is a conflict to resolve, not a quiet gap.
                <span
                  className={cn(
                    'px-2 text-[11px] leading-5',
                    total > 0
                      ? 'font-medium text-red-700 dark:text-red-300'
                      : 'text-muted-foreground',
                  )}
                >
                  kitchen closed{total > 0 ? ` · ${plural(total, 'order')} booked` : ''}
                </span>
              ) : (
                <div
                  className="animate-grow-x flex h-full"
                  style={{ width: `${(total / max) * 100}%`, animationDelay: `${i * 60}ms` }}
                >
                  <span className="h-full bg-primary" style={{ flex: p.confirmed }} />
                  <span className="h-full bg-chart-3" style={{ flex: p.placed }} />
                  <span className="h-full bg-chart-2/70" style={{ flex: p.draft }} />
                </div>
              )}
            </div>
            <span className="text-right tabular-nums">
              <span className="font-medium">{p.meals}</span>{' '}
              <span className="text-muted-foreground">meals</span>
            </span>
          </div>
        );
      })}
      <div className="flex gap-3 pt-1 text-[11px] text-muted-foreground">
        <Legend className="bg-primary" label="Confirmed" />
        <Legend className="bg-chart-3" label="Placed" />
        <Legend className="bg-chart-2/70" label="Draft" />
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn('size-2 rounded-full', className)} />
      {label}
    </span>
  );
}

function GettingPaid({ d }: { d: AdminDashboardDto }) {
  const total = d.uninvoiced.cents + d.openInvoices.cents + d.paidLast30DaysCents;
  const seg = (v: number) => (total === 0 ? 0 : (v / total) * 100);
  const daysOpen = d.openInvoices.oldestIssuedAt
    ? Math.floor((Date.parse(d.now) - Date.parse(d.openInvoices.oldestIssuedAt)) / 86_400_000)
    : null;
  return (
    <div className="space-y-3">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        <span
          className="animate-grow-x h-full bg-chart-2"
          style={{ width: `${seg(d.uninvoiced.cents)}%` }}
        />
        <span
          className="animate-grow-x h-full bg-chart-3"
          style={{ width: `${seg(d.openInvoices.cents)}%` }}
        />
        <span
          className="animate-grow-x h-full bg-primary"
          style={{ width: `${seg(d.paidLast30DaysCents)}%` }}
        />
      </div>
      <dl className="space-y-2 text-sm">
        <Money dot="bg-chart-2" label="Not yet invoiced" cents={d.uninvoiced.cents} />
        <Money
          dot="bg-chart-3"
          label={`Open invoices (${d.openInvoices.count})`}
          cents={d.openInvoices.cents}
          note={daysOpen !== null ? `oldest ${plural(daysOpen, 'day')}` : undefined}
        />
        <Money dot="bg-primary" label="Paid, last 30 days" cents={d.paidLast30DaysCents} />
      </dl>
      {d.uninvoiced.top.length > 0 && (
        <ListBox>
          <ListBoxHeader
            title="Most owed"
            meta={<span className="text-muted-foreground">not yet invoiced</span>}
          />
          <ListBoxRows>
            {d.uninvoiced.top.slice(0, 3).map((t) => (
              <ListBoxRow
                key={t.companyId}
                href={`/billing/companies/${t.companyId}`}
                title={t.companyName}
                trail={
                  <span className="font-heading text-sm font-semibold tabular-nums">
                    {formatUsd(t.cents)}
                  </span>
                }
              />
            ))}
          </ListBoxRows>
        </ListBox>
      )}
    </div>
  );
}

function Money({
  dot,
  label,
  cents,
  note,
}: {
  dot: string;
  label: string;
  cents: number;
  note?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="flex items-center gap-2">
        <span className={cn('size-2 rounded-full', dot)} />
        {label}
        {note && <span className="text-xs text-muted-foreground">· {note}</span>}
      </dt>
      <dd className="font-heading font-semibold tabular-nums">
        <CountUp value={cents} format={(n) => formatUsd(Math.round(n))} />
      </dd>
    </div>
  );
}

function RevenueChart({ d }: { d: AdminDashboardDto }) {
  const max = Math.max(1, ...d.revenue.days.map((x) => x.cents));
  return (
    <div>
      <div className="relative h-44">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <div
            key={f}
            className="absolute inset-x-0 border-t border-dashed border-border/70"
            style={{ bottom: `${f * 100}%` }}
          />
        ))}
        <div className="relative flex h-full items-end gap-1">
          {d.revenue.days.map((x, i) => {
            const isToday = x.date === d.date;
            return (
              <div key={x.date} className="group relative flex h-full flex-1 items-end">
                <div
                  className={cn(
                    'animate-grow-y w-full rounded-t-md transition-[filter] group-hover:brightness-110',
                    x.future ? 'bg-primary/30' : isToday ? 'bg-sidebar-primary' : 'bg-primary/85',
                  )}
                  style={{
                    height: `${Math.max(1.5, (x.cents / max) * 100)}%`,
                    animationDelay: `${i * 25}ms`,
                  }}
                />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-[11px] whitespace-nowrap text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  {formatKitchenDate(x.date)} · {formatUsd(x.cents)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{formatKitchenDate(d.revenue.days[0]!.date)}</span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-sidebar-primary" /> today
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-primary/30" /> next 7 days (confirmed so far)
        </span>
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
        This week so far{' '}
        <strong className="tabular-nums">{formatUsd(d.revenue.thisWeekCents)}</strong>
        <span className="text-muted-foreground">
          vs {formatUsd(d.revenue.lastWeekCents)} by the same day last week
        </span>
      </p>
    </div>
  );
}

function OnTimeChart({ days }: { days: AdminDashboardDto['onTime'] }) {
  return (
    <div className="space-y-2">
      <div className="flex h-36 items-end gap-2">
        {days.map((x, i) => (
          <div
            key={x.date}
            className="flex flex-1 flex-col items-center gap-1"
            title={`${formatKitchenDate(x.date)}: ${x.onTime}/${x.delivered}`}
          >
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {x.rate === null ? '—' : `${Math.round(x.rate * 100)}%`}
            </span>
            <div className="relative h-24 w-full overflow-hidden rounded-md bg-muted">
              {x.rate !== null && (
                <div
                  className={cn(
                    'animate-grow-y absolute inset-x-0 bottom-0 rounded-md',
                    x.rate >= 0.9 ? 'bg-primary' : x.rate >= 0.75 ? 'bg-chart-2' : 'bg-chart-4',
                  )}
                  style={{ height: `${Math.max(4, x.rate * 100)}%`, animationDelay: `${i * 50}ms` }}
                />
              )}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {formatKitchenDate(x.date).split(',')[0]}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Share of delivered drops that arrived within the grace period. “—” means nothing was
        delivered.
      </p>
    </div>
  );
}

function GapList({
  icon,
  title,
  items,
}: {
  icon: typeof Tags;
  title: string;
  items: Array<{ key: string; href: string; label: string; note?: string }>;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 5);
  return (
    <ListBox tone={items.length > 0 ? 'warning' : 'default'}>
      <ListBoxHeader
        icon={icon}
        tone={items.length > 0 ? 'warning' : 'default'}
        title={title}
        meta={<Badge variant={items.length > 0 ? 'warning' : 'success'}>{items.length}</Badge>}
      />
      {items.length === 0 ? (
        <ListBoxEmpty>All set.</ListBoxEmpty>
      ) : (
        <ListBoxRows>
          {shown.map((it) => (
            <ListBoxRow
              key={it.key}
              href={it.href}
              title={it.label}
              trail={it.note && <Badge variant="outline">{it.note}</Badge>}
            />
          ))}
        </ListBoxRows>
      )}
      {items.length > 5 && (
        <ListBoxFooter>
          <button
            type="button"
            onClick={() => setAll(!all)}
            className="cursor-pointer font-medium text-primary hover:underline"
          >
            {all ? 'Show fewer' : `Show all ${items.length}`}
          </button>
        </ListBoxFooter>
      )}
    </ListBox>
  );
}
