'use client';

import {
  addDays,
  calendarDate,
  type DispatchBoardDto,
  type DriverDropsDto,
  type DropStage,
  type KitchenBoardDto,
  minutesToHHmm,
} from '@fernleaf/shared';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle2,
  ChefHat,
  Clock,
  CookingPot,
  MapPin,
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
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api-client';
import { formatIst, formatKitchenDate } from '@/lib/orders';
import { nameLookup, useReferenceList } from '@/lib/reference';
import { cn } from '@/lib/utils';
import { Metric, Panel, ratio } from './metric';

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

// ---------------------------------------------------------------------------------------------
// Kitchen (PRD §8.3)

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
  if (!b) return <LoadingGrid />;

  const units = b.slots.flatMap((s) => s.units);
  const work = units.filter((u) => !u.doNotCook);
  const meals = (list: typeof work) => list.reduce((s, u) => s + u.quantity, 0);
  const stations = b.stations.map((st) => {
    const mine = work.filter((u) => u.stationId === st.id);
    return {
      name: st.name,
      queued: meals(mine.filter((u) => !u.prepStartedAt)),
      cooking: meals(mine.filter((u) => u.prepStartedAt && !u.prepDoneAt)),
      done: meals(mine.filter((u) => u.prepDoneAt)),
    };
  });
  const now = Date.parse(b.now);
  const deadlines = b.slots
    .filter(
      (s) =>
        Date.parse(s.plannedKitchenReadyAt) >= now &&
        s.units.some((u) => !u.prepDoneAt && !u.doNotCook),
    )
    .slice(0, 3)
    .map((s) => {
      const per = new Map<string, number>();
      for (const u of s.units.filter((x) => !x.prepDoneAt && !x.doNotCook)) {
        const name = b.stations.find((st) => st.id === u.stationId)?.name ?? 'Unassigned';
        per.set(name, (per.get(name) ?? 0) + u.quantity);
      }
      return { at: s.plannedKitchenReadyAt, per: [...per.entries()] };
    });
  const allergenMeals = new Map<string, number>();
  for (const u of work)
    for (const a of u.containsAllergenIds)
      allergenMeals.set(a, (allergenMeals.get(a) ?? 0) + u.quantity);
  const clashes = work.filter((u) => u.allergenIds.length > 0);
  const doNotCook = units.filter((u) => u.doNotCook);
  const doneMeals = meals(work.filter((u) => u.prepDoneAt));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border bg-card p-1 shadow-(--shadow-card)">
          {(['today', 'tomorrow'] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={day === d}
              onClick={() => setDay(d)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm transition-colors',
                day === d ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted',
              )}
            >
              {d === 'today'
                ? `Today · ${formatKitchenDate(today.data!.date)}`
                : `Tomorrow · ${tomorrowDate ? formatKitchenDate(tomorrowDate) : ''}`}
            </button>
          ))}
        </div>
        <Link href="/kitchen" className={cn(buttonVariants({ size: 'sm' }), 'ml-auto')}>
          <ChefHat className="size-4" aria-hidden /> Open the board
        </Link>
      </div>

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

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Meals today"
          icon={CookingPot}
          value={meals(work)}
          hint={`${b.summary.orders} orders · ${b.summary.units} items`}
        />
        <Metric
          label="Done"
          icon={CheckCircle2}
          value={doneMeals}
          hint={`${ratio(b.summary.done, b.summary.units)} of items`}
        >
          <StackBar done={doneMeals} active={0} waiting={meals(work) - doneMeals} />
        </Metric>
        <Metric
          label="Late"
          icon={AlertTriangle}
          value={b.summary.late}
          tone={b.summary.late > 0 ? 'red' : undefined}
          hint="items past their ready-by time"
        />
        <Metric
          label="At risk"
          icon={Clock}
          value={b.summary.atRisk}
          tone={b.summary.atRisk > 0 ? 'amber' : undefined}
          hint="due within the warning window"
        />
      </div>

      <div className="stagger grid gap-4 lg:grid-cols-3">
        <Panel title="Production by station">
          <div className="space-y-3">
            {stations.map((s) => {
              const total = s.queued + s.cooking + s.done;
              return (
                <div key={s.name} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span
                      className={cn(
                        'font-medium',
                        s.name === 'Unassigned' && 'text-amber-700 dark:text-amber-300',
                      )}
                    >
                      {s.name}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {s.done}/{total} meals
                      {s.cooking > 0 && ` · ${s.cooking} cooking`}
                    </span>
                  </div>
                  <StackBar done={s.done} active={s.cooking} waiting={s.queued} />
                </div>
              );
            })}
            <div className="flex gap-3 pt-1 text-[11px] text-muted-foreground">
              <Dot className="bg-primary" label="Done" />
              <Dot className="bg-chart-2" label="Cooking" />
              <Dot className="bg-muted-foreground/30" label="Not started" />
            </div>
          </div>
        </Panel>

        <Panel title="Next deadlines">
          {deadlines.length === 0 ? (
            <EmptyHint icon={CheckCircle2} text="Nothing outstanding. Everything due is cooked." />
          ) : (
            <ol className="relative space-y-4 border-l border-border pl-5">
              {deadlines.map((dl, i) => (
                <li key={dl.at} className="relative">
                  <span
                    className={cn(
                      'absolute top-1 -left-[26px] size-3 rounded-full ring-4 ring-card',
                      i === 0 ? 'animate-soft-pulse bg-sidebar-primary' : 'bg-primary/50',
                    )}
                  />
                  <div className="font-heading font-semibold">Ready by {formatIst(dl.at)}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {dl.per.map(([n, m]) => (
                      <Badge key={n} variant="secondary">
                        {n} · {m}
                      </Badge>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel title="Allergen watch">
          {clashes.length === 0 ? (
            <EmptyHint
              icon={ShieldAlert}
              text="No dish clashes with an employee’s recorded allergy."
            />
          ) : (
            <ul className="space-y-2">
              {clashes.map((u) => (
                <li
                  key={u.id}
                  className="flex items-start gap-2 rounded-lg bg-red-500/8 p-2 text-xs dark:bg-red-500/10"
                >
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-red-600" aria-hidden />
                  <span>
                    <span className="font-medium">{u.order.employeeName}</span>: {u.dish.name}{' '}
                    contains {u.allergenIds.map((a) => allergens.get(a)).join(', ')} (#
                    {u.order.number})
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 border-t pt-3">
            <div className="pb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Meals containing
            </div>
            <div className="flex flex-wrap gap-1">
              {[...allergenMeals.entries()]
                .sort((a, c) => c[1] - a[1])
                .map(([a, m]) => (
                  <Badge key={a} variant="outline">
                    {allergens.get(a) ?? 'Allergen'} · {m}
                  </Badge>
                ))}
            </div>
          </div>
        </Panel>
      </div>

      <div className="stagger grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Prep summary">
            {b.prep.length === 0 ? (
              <EmptyHint icon={CookingPot} text="Nothing to cook for this day yet." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {b.prep.map((s) => (
                  <div key={s.stationName} className="rounded-lg border bg-background/60 p-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="font-medium">{s.stationName}</span>
                      <span className="text-xs text-muted-foreground">
                        {s.dishes.reduce((t, d) => t + d.quantity, 0)} meals
                      </span>
                    </div>
                    {s.dishes.map((dish) => (
                      <div key={dish.dishName} className="py-0.5 text-xs">
                        <span className="font-heading font-semibold tabular-nums">
                          {dish.quantity}×
                        </span>{' '}
                        {dish.dishName}
                        <div className="text-muted-foreground">
                          {dish.combinations.map((c) => `${c.quantity} ${c.label}`).join(' · ')}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
        <Panel title={day === 'today' ? 'Tomorrow' : 'Still open for this day'}>
          <TomorrowBlock board={day === 'today' ? tomorrow.data : b} />
        </Panel>
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
  return (
    <div className="space-y-4">
      <div>
        <div className="pb-1.5 text-xs text-muted-foreground">
          Confirmed meals · {formatKitchenDate(board.date)}
        </div>
        {byStation.size === 0 ? (
          <p className="text-muted-foreground">None confirmed yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {[...byStation.entries()].map(([n, m]) => (
              <Badge key={n}>
                {n} · {m}
              </Badge>
            ))}
          </div>
        )}
      </div>
      {!board.pending.cutoffPassed && board.pending.placedMealsByStation.length > 0 && (
        <div>
          <div className="pb-1.5 text-xs text-muted-foreground">
            May still change · cut-off {formatIst(board.pending.cutoffAt, true)}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {board.pending.placedMealsByStation.map((s) => (
              <Badge key={s.stationName} variant="info">
                {s.stationName} · {s.meals}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Dispatch (PRD §8.4)

const STAGES: ReadonlyArray<{ stage: DropStage; label: string; icon: typeof Truck }> = [
  { stage: 'COOKING', label: 'Waiting on kitchen', icon: ChefHat },
  { stage: 'KITCHEN_READY', label: 'Ready to stage', icon: Package },
  { stage: 'DISPATCH_READY', label: 'Packed', icon: PackageCheck },
  { stage: 'OUT_FOR_DELIVERY', label: 'Out', icon: Truck },
  { stage: 'DELIVERED', label: 'Delivered', icon: CheckCircle2 },
];

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
  const d = today.data;
  if (!d) return <LoadingGrid />;
  const notOut = d.drops.filter((x) => !x.outForDeliveryAt);
  const lateDrops = notOut.filter((x) => x.timeliness === 'LATE' || x.timeliness === 'AT_RISK');
  const noDriver = [...d.drops, ...(tomorrow.data?.drops ?? [])].filter(
    (x) => !x.driver && x.stage !== 'DELIVERED',
  );
  const next = [...notOut]
    .sort((a, b) => a.plannedDispatchReadyAt.localeCompare(b.plannedDispatchReadyAt))
    .slice(0, 5);
  const delivered = d.drops.filter((x) => x.deliveredAt);
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {d.summary.drops} drops today · on time{' '}
          <span className="font-medium text-foreground">
            {ratio(delivered.filter((x) => x.deliveredOnTime).length, delivered.length)}
          </span>
        </p>
        <Link href="/dispatch" className={buttonVariants({ size: 'sm' })}>
          <Truck className="size-4" aria-hidden /> Open the board
        </Link>
      </div>

      {/* Stage pipeline */}
      <div className="stagger grid gap-2 sm:grid-cols-5">
        {STAGES.map((s, i) => {
          const count = d.summary[s.stage];
          const attention = s.stage === 'KITCHEN_READY' && count > 0;
          return (
            <div key={s.stage} className="relative">
              <div
                className={cn(
                  'lift flex items-center gap-3 rounded-xl border bg-card p-3 shadow-(--shadow-card)',
                  attention && 'border-amber-400',
                )}
              >
                <span
                  className={cn(
                    'flex size-9 items-center justify-center rounded-lg',
                    attention
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
                  className="absolute top-1/2 -right-2 z-10 hidden size-4 -translate-y-1/2 text-muted-foreground/60 sm:block"
                  aria-hidden
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="stagger grid gap-4 lg:grid-cols-3">
        <Panel title={`Late or at risk · ${lateDrops.length}`}>
          {lateDrops.length === 0 ? (
            <EmptyHint icon={CheckCircle2} text="Nothing late. Every drop is on schedule." />
          ) : (
            <ul className="space-y-2">
              {lateDrops.map((x) => (
                <li
                  key={x.id}
                  className="flex items-center justify-between gap-2 rounded-lg border p-2"
                >
                  <span>
                    <span className="font-medium">{x.company.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {minutesToHHmm(x.deliveryTimeMinutes)} · leaves by{' '}
                      {formatIst(x.plannedDispatchReadyAt)}
                    </span>
                  </span>
                  <Badge variant={x.timeliness === 'LATE' ? 'destructive' : 'warning'}>
                    {x.timeliness === 'LATE' ? 'LATE' : 'AT RISK'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Next departures">
          {next.length === 0 ? (
            <EmptyHint icon={Truck} text="Everything has left the kitchen." />
          ) : (
            <ol className="space-y-3">
              {next.map((x) => (
                <li key={x.id} className="space-y-1">
                  <div className="flex justify-between gap-2 text-sm">
                    <span>
                      <span className="font-heading font-semibold">
                        {formatIst(x.plannedDispatchReadyAt)}
                      </span>{' '}
                      {x.company.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {x.driver?.name ?? 'No driver'}
                    </span>
                  </div>
                  <StackBar
                    done={x.readiness.ready}
                    active={0}
                    waiting={x.readiness.total - x.readiness.ready}
                  />
                  <div className="text-[11px] text-muted-foreground">
                    {x.readiness.ready}/{x.readiness.total} orders cooked
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel title={`No driver · ${noDriver.length}`}>
          {noDriver.length === 0 ? (
            <EmptyHint icon={CheckCircle2} text="Every drop today and tomorrow has a driver." />
          ) : (
            <ul className="space-y-1.5">
              {noDriver.map((x) => (
                <li key={x.id} className="flex items-center gap-2 text-sm">
                  <UserX className="size-4 text-amber-600" aria-hidden />
                  {formatKitchenDate(x.deliveryDate)} {minutesToHHmm(x.deliveryTimeMinutes)} ·{' '}
                  {x.company.name}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Driver load today">
        {drivers.length === 0 ? (
          <EmptyHint icon={Route} text="No drops assigned today." />
        ) : (
          <div className="space-y-3">
            {drivers.map((x) => (
              <div key={x.name} className="grid items-center gap-3 sm:grid-cols-[10rem_1fr_9rem]">
                <span className="flex items-center gap-2 font-medium">
                  <span className="flex size-7 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                    {x.name
                      .split(' ')
                      .map((p) => p[0])
                      .join('')}
                  </span>
                  {x.name}
                </span>
                <StackBar
                  done={x.delivered}
                  active={x.out}
                  waiting={x.assigned - x.delivered - x.out}
                />
                <span className="text-xs text-muted-foreground sm:text-right">
                  {x.delivered}/{x.assigned} delivered · on time {ratio(x.onTime, x.delivered)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Driver (PRD §8.5)

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
  const next = d.drops.find((x) => !x.deliveredAt);
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="stagger grid grid-cols-2 gap-4">
        <Metric
          label="My drops today"
          icon={Route}
          value={d.drops.length}
          hint={`${delivered.length} delivered · ${d.drops.length - delivered.length} to go`}
        >
          <StackBar
            done={delivered.length}
            active={0}
            waiting={d.drops.length - delivered.length}
          />
        </Metric>
        <Metric
          label="On time today"
          icon={Timer}
          value={ratio(delivered.filter((x) => x.deliveredOnTime).length, delivered.length)}
        />
      </div>
      {next ? (
        <div className="animate-rise overflow-hidden rounded-2xl bg-sidebar p-5 text-sidebar-foreground shadow-(--shadow-card)">
          <div className="text-[11px] font-medium tracking-wider text-sidebar-primary uppercase">
            Next stop
          </div>
          <div className="mt-1 font-heading text-3xl font-semibold text-sidebar-accent-foreground">
            {minutesToHHmm(next.deliveryTimeMinutes)} · {next.company.name}
          </div>
          <div className="mt-2 flex items-start gap-2 text-sm">
            <MapPin className="mt-0.5 size-4 shrink-0 text-sidebar-primary" aria-hidden />
            {next.address.label}: {next.address.line1}, {next.address.city}
          </div>
          <div className="mt-1 text-sm text-sidebar-foreground/75">
            {next.boxes} box{next.boxes === 1 ? '' : 'es'} · {next.driverInstructions}
          </div>
          <Link
            href="/driver"
            className={cn(
              buttonVariants({ size: 'lg' }),
              'mt-4 w-full bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90',
            )}
          >
            Open my deliveries
          </Link>
        </div>
      ) : (
        <Panel title="Next stop">
          <EmptyHint icon={CheckCircle2} text="No more stops today. Nice work." />
        </Panel>
      )}
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
