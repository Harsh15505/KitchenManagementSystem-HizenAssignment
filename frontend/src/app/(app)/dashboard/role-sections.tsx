'use client';

import {
  addDays,
  calendarDate,
  type DispatchBoardDto,
  type DriverDropsDto,
  type DropDto,
  type DropStage,
  type KitchenBoardDto,
  minutesToHHmm,
} from '@fernleaf/shared';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  Clock,
  CookingPot,
  MapPin,
  Navigation,
  Package,
  PackageCheck,
  Route,
  ShieldAlert,
  Timer,
  Truck,
  UserX,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { CountUp } from '@/components/count-up';
import { Badge } from '@/components/ui/badge';
import {
  Chip,
  ListBox,
  ListBoxEmpty,
  ListBoxHeader,
  ListBoxRow,
  ListBoxRows,
} from '@/components/list-box';
import { PrepStationCard } from '@/components/prep-station-card';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api-client';
import { formatIst, formatKitchenDate } from '@/lib/orders';
import { nameLookup, useReferenceList } from '@/lib/reference';
import { cn, plural } from '@/lib/utils';
import { Countdown } from './countdown';
import { HeroMetric, Panel, ratio } from './metric';
import { DashboardToolbar } from './toolbar';

function LoadingGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-32 rounded-xl" />
      ))}
    </div>
  );
}

/** A thin stacked bar: done / in progress / waiting. */
function StackBar({ done, active, waiting }: { done: number; active: number; waiting: number }) {
  const total = done + active + waiting;
  if (total === 0) return <div className="h-2 rounded-full bg-muted" />;
  return (
    <div className="animate-grow-x flex h-2 overflow-hidden rounded-full bg-muted">
      <span className="h-full bg-primary" style={{ width: `${(done / total) * 100}%` }} />
      <span className="h-full bg-chart-2" style={{ width: `${(active / total) * 100}%` }} />
    </div>
  );
}

/**
 * A count that should be zero (late, at risk): calm when it is, coloured when it isn't. The whole
 * tile links to the board where the work can be done.
 */
function CountTile({
  label,
  value,
  hint,
  tone,
  icon: Icon,
  href,
  className,
}: {
  label: string;
  value: number;
  hint: string;
  tone: 'red' | 'amber';
  icon: typeof Truck;
  href: string;
  className?: string;
}) {
  const on = value > 0;
  return (
    <Link
      href={href}
      className={cn(
        'animate-rise lift flex flex-col justify-between gap-3 rounded-2xl p-4 ring-1 shadow-(--shadow-card) focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        on &&
          tone === 'red' &&
          'bg-red-50 text-red-900 ring-red-300 dark:bg-red-950/40 dark:text-red-100 dark:ring-red-900',
        on &&
          tone === 'amber' &&
          'bg-amber-50 text-amber-900 ring-amber-300 dark:bg-amber-950/30 dark:text-amber-100 dark:ring-amber-900',
        !on && 'bg-card ring-foreground/[0.06]',
        className,
      )}
    >
      <span className="flex items-center justify-between text-xs font-medium tracking-wide uppercase">
        {label}
        <Icon className={cn('size-4', !on && 'text-muted-foreground')} aria-hidden />
      </span>
      <span>
        <span className="block font-heading text-4xl leading-none font-semibold">
          <CountUp value={value} />
        </span>
        <span className={cn('mt-1.5 block text-xs', on ? 'opacity-80' : 'text-muted-foreground')}>
          {hint}
        </span>
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------------------------
// Kitchen (PRD §8.3) — first glance: meals, next deadline, late, at risk, prep summary, allergens.

/** "What do I cook, by when, where are we behind?" Date defaults to today; tomorrow one click away. */
export function KitchenSection() {
  const allergens = nameLookup(useReferenceList('allergens').data);
  const [day, setDay] = useState<'today' | 'tomorrow'>('today');
  const today = useQuery({
    queryKey: ['kitchen-board', ''],
    queryFn: () => api<KitchenBoardDto>('/kitchen/board'),
    refetchInterval: 30_000,
  });
  const tomorrowDate = today.data ? addDays(calendarDate(today.data.date), 1) : null;
  const tomorrow = useQuery({
    queryKey: ['kitchen-board', `date=${tomorrowDate}`],
    queryFn: () => api<KitchenBoardDto>(`/kitchen/board?date=${tomorrowDate}`),
    enabled: Boolean(tomorrowDate),
  });
  const b = day === 'today' ? today.data : tomorrow.data;

  const toolbar = today.data && (
    <DashboardToolbar>
      <div className="flex rounded-full border bg-card p-1 shadow-(--shadow-card)">
        {(['today', 'tomorrow'] as const).map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={day === d}
            onClick={() => setDay(d)}
            className={cn(
              'cursor-pointer rounded-full px-3.5 py-1 text-sm transition-colors',
              day === d ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted',
            )}
          >
            {d === 'today'
              ? `Today · ${formatKitchenDate(today.data.date)}`
              : `Tomorrow · ${tomorrowDate ? formatKitchenDate(tomorrowDate) : ''}`}
          </button>
        ))}
      </div>
      <Link href="/kitchen" className={buttonVariants({ size: 'sm' })}>
        <ChefHat className="size-4" aria-hidden /> Open the board
      </Link>
    </DashboardToolbar>
  );
  if (!b)
    return (
      <>
        {toolbar}
        <LoadingGrid />
      </>
    );

  const stationName = new Map(b.stations.map((s) => [s.id, s.name]));
  const units = b.slots.flatMap((s) => s.units);
  const work = units.filter((u) => !u.doNotCook);
  const meals = (list: typeof work) => list.reduce((s, u) => s + u.quantity, 0);
  const totalMeals = meals(work);
  const doneMeals = meals(work.filter((u) => u.prepDoneAt));
  const now = Date.parse(b.now);
  // Ready-by slots from now on that still have meals to cook (overdue ones count as "late").
  const upcoming = b.slots
    .filter((s) => Date.parse(s.plannedKitchenReadyAt) >= now)
    .map((s) => {
      const open = s.units.filter((u) => !u.prepDoneAt && !u.doNotCook);
      const per = new Map<string, number>();
      for (const u of open) {
        const name = stationName.get(u.stationId) ?? 'Unassigned';
        per.set(name, (per.get(name) ?? 0) + u.quantity);
      }
      return { at: s.plannedKitchenReadyAt, meals: meals(open), per: [...per.entries()] };
    })
    .filter((s) => s.meals > 0);
  const next = upcoming[0];
  const allergenMeals = new Map<string, number>();
  for (const u of work)
    for (const a of u.containsAllergenIds)
      allergenMeals.set(a, (allergenMeals.get(a) ?? 0) + u.quantity);
  const clashes = work.filter((u) => u.allergenIds.length > 0);
  const doNotCook = units.filter((u) => u.doNotCook);
  const prepLeft = b.prep.reduce((t, s) => t + s.meals.total - s.meals.done, 0);

  return (
    <div className="space-y-4">
      {toolbar}
      {doNotCook.length > 0 && (
        <div
          role="alert"
          className="animate-rise flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/30"
        >
          <Ban className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden />
          <span>
            <span className="font-medium">Do not cook</span> (cancelled or rejected after work
            started):{' '}
            {doNotCook.map((u) => `#${u.order.number} ${u.quantity} × ${u.dish.name}`).join(' · ')}
          </span>
        </div>
      )}

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
        <HeroMetric
          compact
          label={day === 'today' ? 'Meals today' : `Meals · ${formatKitchenDate(b.date)}`}
          icon={CookingPot}
          value={totalMeals}
          hint={`${plural(b.summary.orders, 'order')} · ${plural(b.summary.units, 'item')} to cook`}
          className="sm:col-span-2 lg:col-span-4 xl:col-span-3"
        >
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-sidebar-foreground/80">
              <span>{doneMeals} cooked</span>
              <span>{ratio(doneMeals, totalMeals)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="animate-grow-x h-full rounded-full bg-sidebar-primary"
                style={{ width: `${totalMeals === 0 ? 0 : (doneMeals / totalMeals) * 100}%` }}
              />
            </div>
          </div>
        </HeroMetric>

        <div className="animate-rise flex flex-col justify-between gap-2 rounded-2xl bg-accent/70 p-4 ring-1 ring-accent-foreground/10 shadow-(--shadow-card) sm:col-span-2 lg:col-span-8 xl:col-span-5">
          <div className="flex items-center justify-between gap-2 text-xs font-medium tracking-wide text-accent-foreground uppercase">
            <span className="flex items-center gap-1.5">
              <Timer className="size-4" aria-hidden /> Next deadline
            </span>
            {next && (
              <span className="font-normal tracking-normal normal-case">
                <Countdown to={next.at} now={b.now} />
              </span>
            )}
          </div>
          {next ? (
            <>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-heading text-4xl leading-none font-semibold">
                  {formatIst(next.at)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {next.meals} meal{next.meals === 1 ? '' : 's'} still to cook
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {next.per.map(([n, m]) => (
                  <Badge key={n} variant="secondary">
                    {n} · {m}
                  </Badge>
                ))}
              </div>
              {upcoming.length > 1 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-accent-foreground/10 pt-2 text-xs text-muted-foreground">
                  <span>Then</span>
                  {upcoming.slice(1, 4).map((s) => (
                    <span key={s.at}>
                      <span className="font-medium text-foreground">{formatIst(s.at)}</span> ·{' '}
                      {plural(s.meals, 'meal')}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="flex flex-1 items-center gap-2 text-sm text-muted-foreground">
              {b.summary.late > 0 ? (
                <>
                  <AlertTriangle className="size-4 shrink-0 text-red-600" aria-hidden /> Nothing
                  else due {day === 'today' ? 'today' : 'that day'}, but {b.summary.late} item
                  {b.summary.late === 1 ? ' is' : 's are'} past its ready-by time: see Late.
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden /> Nothing
                  outstanding: everything due is cooked.
                </>
              )}
            </p>
          )}
        </div>

        <CountTile
          label="Late"
          value={b.summary.late}
          hint="items past their ready-by time"
          tone="red"
          icon={AlertTriangle}
          href="/kitchen"
          className="lg:col-span-6 xl:col-span-2"
        />
        <CountTile
          label="At risk"
          value={b.summary.atRisk}
          hint="due within the warning window"
          tone="amber"
          icon={Clock}
          href="/kitchen"
          className="lg:col-span-6 xl:col-span-2"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Panel
          title="Prep summary"
          className="xl:col-span-8"
          action={
            <span className="text-xs text-muted-foreground tabular-nums">
              {prepLeft} of {plural(totalMeals, 'meal')} left
            </span>
          }
        >
          {b.prep.length === 0 ? (
            <EmptyHint icon={CookingPot} text="Nothing to cook for this day yet." />
          ) : (
            <>
              <div className="soft-scroll grid gap-3 sm:grid-cols-2 xl:max-h-[24rem] xl:overflow-y-auto xl:pr-1">
                {b.prep.map((s) => (
                  <PrepStationCard key={s.stationId ?? 'none'} station={s} now={b.now} />
                ))}
              </div>
              <div className="mt-3 flex gap-3 text-[11px] text-muted-foreground">
                <Dot className="bg-primary" label="Done" />
                <Dot className="bg-chart-2" label="Cooking" />
                <Dot className="bg-muted-foreground/30" label="Not started" />
                <span className="ml-auto">Soonest due first · “by” = ready-by time</span>
              </div>
            </>
          )}
        </Panel>

        <div className="grid content-start gap-4 lg:grid-cols-2 xl:col-span-4 xl:grid-cols-1">
          <Panel
            title="Allergen watch"
            action={
              clashes.length > 0 && <Badge variant="destructive">{clashes.length} to check</Badge>
            }
          >
            <div className="space-y-3">
              {clashes.length === 0 ? (
                <ListBox>
                  <ListBoxEmpty>No dish clashes with an employee’s recorded allergy.</ListBoxEmpty>
                </ListBox>
              ) : (
                <ListBox tone="danger">
                  <ListBoxHeader
                    icon={AlertTriangle}
                    tone="danger"
                    title="Check before packing"
                    meta={<Badge variant="destructive">{clashes.length}</Badge>}
                  />
                  <ListBoxRows className="soft-scroll max-h-44 overflow-y-auto">
                    {clashes.map((u) => (
                      <ListBoxRow
                        key={u.id}
                        title={
                          <>
                            {u.order.employeeName}
                            <span className="font-normal text-muted-foreground">
                              {' '}
                              · {u.dish.name}
                            </span>
                          </>
                        }
                        sub={
                          <span className="flex flex-wrap gap-1">
                            {u.allergenIds.map((a) => (
                              <Chip key={a} tone="danger">
                                {allergens.get(a) ?? 'Allergen'}
                              </Chip>
                            ))}
                          </span>
                        }
                        trail={
                          <span className="leading-tight text-muted-foreground">
                            #{u.order.number}
                            <span className="block">by {formatIst(u.plannedKitchenReadyAt)}</span>
                          </span>
                        }
                      />
                    ))}
                  </ListBoxRows>
                </ListBox>
              )}
              {allergenMeals.size > 0 && (
                <ListBox>
                  <ListBoxHeader icon={ShieldAlert} title="Meals containing" />
                  <div className="flex flex-wrap gap-1 p-3">
                    {[...allergenMeals.entries()]
                      .sort((a, c) => c[1] - a[1])
                      .map(([a, m]) => (
                        <span
                          key={a}
                          className="inline-flex items-center gap-1.5 rounded-md border bg-background px-1.5 py-0.5 text-xs"
                        >
                          {allergens.get(a) ?? 'Allergen'}
                          <span className="font-semibold tabular-nums">{m}</span>
                        </span>
                      ))}
                  </div>
                </ListBox>
              )}
            </div>
          </Panel>

          <Panel
            title={day === 'today' ? 'Tomorrow' : 'Booked for this day'}
            tone="soft"
            action={
              day === 'today' && (
                <button
                  type="button"
                  onClick={() => setDay('tomorrow')}
                  className="cursor-pointer text-xs font-medium text-primary hover:underline"
                >
                  Open tomorrow →
                </button>
              )
            }
          >
            <TomorrowBlock board={day === 'today' ? tomorrow.data : b} />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function TomorrowBlock({ board }: { board: KitchenBoardDto | undefined }) {
  if (!board) return <Skeleton className="h-20" />;
  const byStation = new Map<string, number>();
  for (const u of board.slots.flatMap((s) => s.units).filter((x) => !x.doNotCook)) {
    const name = board.stations.find((st) => st.id === u.stationId)?.name ?? 'Unassigned';
    byStation.set(name, (byStation.get(name) ?? 0) + u.quantity);
  }
  const confirmed = [...byStation.values()].reduce((t, m) => t + m, 0);
  const placed = board.pending.cutoffPassed ? [] : board.pending.placedMealsByStation;
  return (
    <div className="space-y-3">
      <ListBox>
        <ListBoxHeader
          icon={CalendarDays}
          title={`Confirmed · ${formatKitchenDate(board.date)}`}
          meta={<Badge variant="secondary">{plural(confirmed, 'meal')}</Badge>}
        />
        {byStation.size === 0 ? (
          <ListBoxEmpty>None confirmed yet.</ListBoxEmpty>
        ) : (
          <div className="flex flex-wrap gap-1 p-3">
            {[...byStation.entries()].map(([n, m]) => (
              <Chip key={n} count={m}>
                {n}
              </Chip>
            ))}
          </div>
        )}
      </ListBox>
      {placed.length > 0 && (
        <ListBox>
          <ListBoxHeader
            icon={Clock}
            title="May still change"
            meta={
              <span className="text-muted-foreground">
                cut-off {formatIst(board.pending.cutoffAt, true)}
              </span>
            }
          />
          <div className="flex flex-wrap gap-1 p-3">
            {placed.map((p) => (
              <Chip key={p.stationName} count={p.meals}>
                {p.stationName}
              </Chip>
            ))}
          </div>
        </ListBox>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Dispatch (PRD §8.4) — first glance: stages, next departures, what needs a decision, drivers.

const STAGES: ReadonlyArray<{ stage: DropStage; label: string; icon: typeof Truck }> = [
  { stage: 'COOKING', label: 'Waiting on kitchen', icon: ChefHat },
  { stage: 'KITCHEN_READY', label: 'Ready to pack', icon: Package },
  { stage: 'DISPATCH_READY', label: 'Packed', icon: PackageCheck },
  { stage: 'OUT_FOR_DELIVERY', label: 'Out', icon: Truck },
  { stage: 'DELIVERED', label: 'Delivered', icon: CheckCircle2 },
];
const STAGE_TEXT = Object.fromEntries(STAGES.map((s) => [s.stage, s.label])) as Record<
  DropStage,
  string
>;

/** "What leaves next, who drives it, what's late?" */
export function DispatchSection() {
  const today = useQuery({
    queryKey: ['dispatch-board', ''],
    queryFn: () => api<DispatchBoardDto>('/dispatch/board'),
    refetchInterval: 30_000,
  });
  const tomorrowDate = today.data ? addDays(calendarDate(today.data.date), 1) : null;
  const tomorrow = useQuery({
    queryKey: ['dispatch-board', `date=${tomorrowDate}`],
    queryFn: () => api<DispatchBoardDto>(`/dispatch/board?date=${tomorrowDate}`),
    enabled: Boolean(tomorrowDate),
  });
  const toolbar = (
    <DashboardToolbar>
      <Link href="/dispatch" className={buttonVariants({ size: 'sm' })}>
        <Truck className="size-4" aria-hidden /> Open the board
      </Link>
    </DashboardToolbar>
  );
  const d = today.data;
  if (!d)
    return (
      <>
        {toolbar}
        <LoadingGrid />
      </>
    );
  const notOut = d.drops.filter((x) => !x.outForDeliveryAt);
  const lateDrops = notOut.filter((x) => x.timeliness === 'LATE' || x.timeliness === 'AT_RISK');
  const noDriver = [...d.drops, ...(tomorrow.data?.drops ?? [])].filter(
    (x) => !x.driver && !x.outForDeliveryAt,
  );
  const next = [...notOut]
    .sort((a, b) => a.plannedDispatchReadyAt.localeCompare(b.plannedDispatchReadyAt))
    .slice(0, 6);
  const delivered = d.drops.filter((x) => x.deliveredAt);
  const onTime = delivered.filter((x) => x.deliveredOnTime).length;
  const drivers = d.drivers
    .map((dr) => {
      const mine = d.drops.filter((x) => x.driver?.id === dr.id);
      const done = mine.filter((x) => x.deliveredAt);
      return {
        name: dr.name,
        assigned: mine.length,
        out: mine.filter((x) => x.stage === 'OUT_FOR_DELIVERY').length,
        delivered: done.length,
        onTime: done.filter((x) => x.deliveredOnTime).length,
      };
    })
    .filter((x) => x.assigned > 0);
  const attention = lateDrops.length + noDriver.length;

  return (
    <div className="space-y-4">
      {toolbar}
      <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STAGES.map((s, i) => {
          const count = d.summary[s.stage];
          const waiting = s.stage === 'KITCHEN_READY' && count > 0;
          return (
            <div key={s.stage} className="relative">
              <div
                className={cn(
                  'lift flex h-full items-center gap-3 rounded-xl border bg-card p-3 shadow-(--shadow-card)',
                  waiting && 'border-amber-400',
                )}
              >
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-lg',
                    waiting
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                      : 'bg-secondary text-secondary-foreground',
                  )}
                >
                  <s.icon className="size-4" aria-hidden />
                </span>
                <div>
                  <div className="font-heading text-2xl leading-none font-semibold">
                    <CountUp value={count} />
                  </div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              </div>
              {i < STAGES.length - 1 && (
                <ArrowRight
                  className="absolute top-1/2 -right-2.5 z-10 hidden size-4 -translate-y-1/2 text-muted-foreground/60 lg:block"
                  aria-hidden
                />
              )}
            </div>
          );
        })}
        <div className="flex items-center gap-3 rounded-xl bg-sidebar p-3 text-sidebar-foreground shadow-(--shadow-card)">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-sidebar-primary">
            <Timer className="size-4" aria-hidden />
          </span>
          <div>
            <div className="font-heading text-2xl leading-none font-semibold text-sidebar-accent-foreground">
              {ratio(onTime, delivered.length)}
            </div>
            <div className="text-xs text-sidebar-foreground/75">
              on time · {onTime}/{delivered.length}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Panel
          title="Next departures"
          className="xl:col-span-7"
          action={
            <span className="text-xs text-muted-foreground">
              {notOut.length} of {plural(d.summary.drops, 'drop')} still to leave
            </span>
          }
        >
          {next.length === 0 ? (
            <EmptyHint icon={Truck} text="Everything has left the kitchen." />
          ) : (
            <ol className="space-y-2">
              {next.map((x, i) => (
                <DepartureRow key={x.id} drop={x} first={i === 0} />
              ))}
            </ol>
          )}
        </Panel>

        <div className="grid content-start gap-4 lg:grid-cols-2 xl:col-span-5 xl:grid-cols-1">
          <Panel
            title="Needs a decision"
            className={cn(
              lateDrops.length > 0 && 'ring-red-300 dark:ring-red-900',
              lateDrops.length === 0 && noDriver.length > 0 && 'ring-amber-300 dark:ring-amber-900',
            )}
            action={
              attention > 0 && (
                <Badge variant={lateDrops.length > 0 ? 'destructive' : 'warning'}>
                  {attention}
                </Badge>
              )
            }
          >
            {attention === 0 ? (
              <ListBox>
                <ListBoxEmpty>
                  Nothing late, and every drop today and tomorrow has a driver.
                </ListBoxEmpty>
              </ListBox>
            ) : (
              <div className="soft-scroll max-h-64 space-y-3 overflow-y-auto pr-1">
                {lateDrops.length > 0 && (
                  <ListBox tone="danger">
                    <ListBoxHeader
                      icon={AlertTriangle}
                      tone="danger"
                      title="Late or at risk"
                      meta={<Badge variant="destructive">{lateDrops.length}</Badge>}
                    />
                    <ListBoxRows>
                      {lateDrops.map((x) => (
                        <ListBoxRow
                          key={x.id}
                          href="/dispatch"
                          title={x.company.name}
                          sub={`leaves by ${formatIst(x.plannedDispatchReadyAt)} · ${STAGE_TEXT[x.stage].toLowerCase()}`}
                          trail={
                            <Badge variant={x.timeliness === 'LATE' ? 'destructive' : 'warning'}>
                              {x.timeliness === 'LATE' ? 'Late' : 'At risk'}
                            </Badge>
                          }
                        />
                      ))}
                    </ListBoxRows>
                  </ListBox>
                )}
                {noDriver.length > 0 && (
                  <ListBox tone="warning">
                    <ListBoxHeader
                      icon={UserX}
                      tone="warning"
                      title="No driver yet"
                      meta={<Badge variant="warning">{noDriver.length}</Badge>}
                    />
                    <ListBoxRows>
                      {noDriver.map((x) => (
                        <ListBoxRow
                          key={x.id}
                          href="/dispatch"
                          title={x.company.name}
                          sub={`${formatKitchenDate(x.deliveryDate)} · deliver ${minutesToHHmm(x.deliveryTimeMinutes)}`}
                        />
                      ))}
                    </ListBoxRows>
                  </ListBox>
                )}
              </div>
            )}
          </Panel>

          <Panel title="Driver load today">
            {drivers.length === 0 ? (
              <EmptyHint icon={Route} text="No drops assigned today." />
            ) : (
              <div className="space-y-3">
                {drivers.map((x) => (
                  <div key={x.name} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 font-medium">
                        <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                          {x.name
                            .split(' ')
                            .map((p) => p[0])
                            .join('')}
                        </span>
                        {x.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {x.delivered}/{x.assigned} delivered · on time{' '}
                        {ratio(x.onTime, x.delivered)}
                      </span>
                    </div>
                    <StackBar
                      done={x.delivered}
                      active={x.out}
                      waiting={x.assigned - x.delivered - x.out}
                    />
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

/** One upcoming departure: when it must leave, where, who drives, and whether it is cooked. */
function DepartureRow({ drop: x, first }: { drop: DropDto; first: boolean }) {
  return (
    <li
      className={cn(
        'grid grid-cols-[4.75rem_1fr_auto] items-center gap-3 rounded-xl border p-2.5',
        first ? 'border-primary/40 bg-primary/[0.05]' : 'bg-background/60',
      )}
    >
      <div className="text-center leading-tight">
        <div className="font-heading text-sm font-semibold whitespace-nowrap tabular-nums">
          {formatIst(x.plannedDispatchReadyAt)}
        </div>
        <div className="text-[10px] tracking-wide text-muted-foreground uppercase">leaves</div>
      </div>
      <div className="min-w-0">
        <div className="truncate font-medium">
          {x.company.name}{' '}
          <span className="font-normal text-muted-foreground">· {x.address.label}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span>deliver {minutesToHHmm(x.deliveryTimeMinutes)}</span>
          <span>· {plural(x.boxes, 'box', 'boxes')} ·</span>
          {x.driver ? (
            <span>{x.driver.name}</span>
          ) : (
            <span className="font-medium text-amber-700 dark:text-amber-300">No driver</span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className="w-24">
            <StackBar
              done={x.readiness.ready}
              active={0}
              waiting={x.readiness.total - x.readiness.ready}
            />
          </div>
          <span className="text-[11px] text-muted-foreground">
            {x.readiness.ready}/{plural(x.readiness.total, 'order')} cooked
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <Badge variant="outline">{STAGE_TEXT[x.stage]}</Badge>
        {x.timeliness === 'LATE' && <Badge variant="destructive">Late</Badge>}
        {x.timeliness === 'AT_RISK' && <Badge variant="warning">At risk</Badge>}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------------------------
// Driver (PRD §8.5) — first glance, on a phone: the next stop, then progress, then the rest.

const DRIVER_STATUS: Record<DropStage, string> = {
  COOKING: 'Being cooked',
  KITCHEN_READY: 'Being packed',
  DISPATCH_READY: 'Packed, waiting for you',
  OUT_FOR_DELIVERY: 'On the way',
  DELIVERED: 'Delivered',
};

/** "Where do I go next?" */
export function DriverSection() {
  const q = useQuery({
    queryKey: ['driver-drops'],
    queryFn: () => api<DriverDropsDto>('/driver/drops'),
    refetchInterval: 30_000,
  });
  const d = q.data;
  if (!d) return <Skeleton className="h-64 rounded-xl" />;
  const delivered = d.drops.filter((x) => x.deliveredAt);
  const pending = d.drops.filter((x) => !x.deliveredAt);
  // Same rule as the deliveries page: a drop already out comes first, then the earliest.
  const next = pending.find((x) => x.stage === 'OUT_FOR_DELIVERY') ?? pending[0];
  const later = pending.filter((x) => x !== next);
  const onTime = delivered.filter((x) => x.deliveredOnTime).length;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {next ? (
        <NextStop drop={next} />
      ) : (
        <Panel title="Next stop">
          <EmptyHint
            icon={CheckCircle2}
            text={
              d.drops.length === 0 ? 'No deliveries assigned to you today.' : 'All done for today.'
            }
          />
        </Panel>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="animate-rise rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.06] shadow-(--shadow-card)">
          <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Delivered
          </div>
          <div className="mt-1 font-heading text-3xl font-semibold tabular-nums">
            {delivered.length}
            <span className="text-lg text-muted-foreground">/{d.drops.length}</span>
          </div>
          <div className="mt-2">
            <StackBar done={delivered.length} active={0} waiting={pending.length} />
          </div>
        </div>
        <div className="animate-rise rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.06] shadow-(--shadow-card)">
          <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            On time today
          </div>
          <div className="mt-1 font-heading text-3xl font-semibold">
            {ratio(onTime, delivered.length)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {onTime} of {delivered.length} delivered
          </div>
        </div>
      </div>

      {later.length > 0 && (
        <Panel title={`Later today · ${later.length}`}>
          <ul className="divide-y">
            {later.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-3 py-2 first:pt-0">
                <span className="min-w-0">
                  <span className="font-heading font-semibold tabular-nums">
                    {minutesToHHmm(x.deliveryTimeMinutes)}
                  </span>{' '}
                  {x.company.name}
                  <span className="block truncate text-xs text-muted-foreground">
                    {x.address.label} · {x.boxes} box{x.boxes === 1 ? '' : 'es'}
                  </span>
                </span>
                <Badge variant="outline" className="shrink-0">
                  {DRIVER_STATUS[x.stage]}
                </Badge>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function NextStop({ drop: x }: { drop: DropDto }) {
  const address = [x.address.line1, x.address.line2, `${x.address.city} ${x.address.postalCode}`]
    .filter(Boolean)
    .join(', ');
  const packaging = [...new Set(x.orders.map((o) => o.packaging))].join(', ');
  return (
    <div className="animate-rise relative overflow-hidden rounded-2xl bg-gradient-to-br from-[oklch(0.32_0.075_155)] to-[oklch(0.2_0.05_158)] p-5 text-sidebar-foreground shadow-(--shadow-card)">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-16 size-56 rounded-full bg-sidebar-primary/20 blur-3xl"
      />
      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium tracking-wider text-sidebar-primary uppercase">
            Next stop
          </span>
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs">
            {DRIVER_STATUS[x.stage]}
          </span>
        </div>
        <div className="mt-1 font-heading text-3xl leading-tight font-semibold text-sidebar-accent-foreground">
          {minutesToHHmm(x.deliveryTimeMinutes)} · {x.company.name}
        </div>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address}, India`)}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-start gap-2 text-sm underline-offset-2 hover:underline"
        >
          <MapPin className="mt-0.5 size-4 shrink-0 text-sidebar-primary" aria-hidden />
          <span>
            {x.address.label}: {address}
            {x.address.accessNotes && (
              <span className="block text-sidebar-foreground/75">{x.address.accessNotes}</span>
            )}
          </span>
        </a>
        <div className="mt-2 flex items-start gap-2 text-sm text-sidebar-foreground/85">
          <Package className="mt-0.5 size-4 shrink-0 text-sidebar-primary" aria-hidden />
          <span>
            {x.boxes} box{x.boxes === 1 ? '' : 'es'} · {packaging}
            {x.driverInstructions && (
              <span className="block text-sidebar-foreground/75">{x.driverInstructions}</span>
            )}
          </span>
        </div>
        <Link
          href="/driver"
          className={cn(
            buttonVariants({ size: 'lg' }),
            'mt-4 w-full bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90',
          )}
        >
          <Navigation className="size-4" aria-hidden /> Open my deliveries
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function Dot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn('size-2 rounded-full', className)} />
      {label}
    </span>
  );
}

function EmptyHint({ icon: Icon, text }: { icon: typeof Truck; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center text-sm text-muted-foreground">
      <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      {text}
    </div>
  );
}
