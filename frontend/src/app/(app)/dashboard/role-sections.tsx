'use client';

import {
  addDays,
  calendarDate,
  type DispatchBoardDto,
  type DriverDropsDto,
  type KitchenBoardDto,
  minutesToHHmm,
} from '@fernleaf/shared';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api-client';
import { formatIst, formatKitchenDate } from '@/lib/orders';
import { nameLookup, useReferenceList } from '@/lib/reference';
import { cn } from '@/lib/utils';
import { Metric, Panel, ratio } from './metric';

/** PRD §8.3: "What do I cook, by when, where are we behind?" Date defaults to today; tomorrow one click away. */
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
  if (!b) return <Skeleton className="h-96" />;

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

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['today', 'tomorrow'] as const).map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={day === d}
            onClick={() => setDay(d)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm',
              day === d ? 'bg-primary text-primary-foreground' : '',
            )}
          >
            {d === 'today'
              ? `Today · ${formatKitchenDate(today.data!.date)}`
              : `Tomorrow · ${tomorrowDate ? formatKitchenDate(tomorrowDate) : ''}`}
          </button>
        ))}
        <Link
          href="/kitchen"
          className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'ml-auto')}
        >
          Open the board
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Meals to cook"
          value={meals(work)}
          hint={`${b.summary.orders} orders · ${b.summary.units} items`}
        />
        <Metric
          label="Done"
          value={meals(work.filter((u) => u.prepDoneAt))}
          hint={ratio(b.summary.done, b.summary.units) + ' of items'}
        />
        <Metric
          label="Late"
          value={b.summary.late}
          tone={b.summary.late > 0 ? 'red' : undefined}
          hint="items past their ready-by time"
        />
        <Metric
          label="At risk"
          value={b.summary.atRisk}
          tone={b.summary.atRisk > 0 ? 'amber' : undefined}
          hint="due within the warning window"
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Production by station (meals)">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="text-left font-normal">Station</th>
                <th className="text-right font-normal">Not started</th>
                <th className="text-right font-normal">Cooking</th>
                <th className="text-right font-normal">Done</th>
              </tr>
            </thead>
            <tbody>
              {stations.map((s) => (
                <tr key={s.name}>
                  <td>{s.name}</td>
                  <td className="text-right tabular-nums">{s.queued}</td>
                  <td className="text-right tabular-nums">{s.cooking}</td>
                  <td className="text-right tabular-nums">{s.done}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Next deadlines">
          {deadlines.length === 0 && <p className="text-muted-foreground">Nothing outstanding.</p>}
          <ul className="space-y-2">
            {deadlines.map((dl) => (
              <li key={dl.at}>
                <div className="font-medium">Ready by {formatIst(dl.at)}</div>
                <div className="text-xs text-muted-foreground">
                  {dl.per.map(([n, m]) => `${n} ${m}`).join(' · ')}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Allergen watch">
          {clashes.length === 0 ? (
            <p className="text-muted-foreground">
              No dish clashes with an employee’s recorded allergy.
            </p>
          ) : (
            <ul className="space-y-1 text-xs">
              {clashes.map((u) => (
                <li key={u.id} className="flex items-start gap-1">
                  <AlertTriangle className="mt-0.5 size-3 shrink-0 text-red-600" aria-hidden />
                  <span>
                    {u.order.employeeName}: {u.dish.name} contains{' '}
                    {u.allergenIds.map((a) => allergens.get(a)).join(', ')} (#{u.order.number})
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex flex-wrap gap-1">
            {[...allergenMeals.entries()]
              .sort((a, c) => c[1] - a[1])
              .map(([a, m]) => (
                <Badge key={a} variant="outline">
                  {allergens.get(a) ?? 'Allergen'} {m}
                </Badge>
              ))}
          </div>
        </Panel>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Prep summary">
          {b.prep.length === 0 && <p className="text-muted-foreground">Nothing to cook.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {b.prep.map((s) => (
              <div key={s.stationName}>
                <div className="font-medium">{s.stationName}</div>
                {s.dishes.map((dish) => (
                  <div key={dish.dishName} className="text-xs">
                    <span className="tabular-nums">{dish.quantity}</span> × {dish.dishName}
                    <span className="text-muted-foreground">
                      {' '}
                      ({dish.combinations.map((c) => `${c.quantity} ${c.label}`).join('; ')})
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Panel>
        <Panel title={day === 'today' ? 'Tomorrow' : 'Still open for this day'}>
          <TomorrowBlock board={day === 'today' ? tomorrow.data : b} />
          {doNotCook.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-medium">Do not cook (cancelled after work started)</div>
              <ul className="text-xs text-muted-foreground">
                {doNotCook.map((u) => (
                  <li key={u.id}>
                    #{u.order.number} {u.quantity} × {u.dish.name}
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

function TomorrowBlock({ board }: { board: KitchenBoardDto | undefined }) {
  if (!board) return <Skeleton className="h-20" />;
  const byStation = new Map<string, number>();
  for (const u of board.slots.flatMap((s) => s.units).filter((x) => !x.doNotCook)) {
    const name = board.stations.find((st) => st.id === u.stationId)?.name ?? 'Unassigned';
    byStation.set(name, (byStation.get(name) ?? 0) + u.quantity);
  }
  return (
    <div className="space-y-2">
      <div>
        <div className="text-xs text-muted-foreground">
          Confirmed meals by station ({formatKitchenDate(board.date)})
        </div>
        {byStation.size === 0 ? (
          <p className="text-muted-foreground">None confirmed yet.</p>
        ) : (
          <p>{[...byStation.entries()].map(([n, m]) => `${n} ${m}`).join(' · ')}</p>
        )}
      </div>
      {!board.pending.cutoffPassed && board.pending.placedMealsByStation.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground">
            May still change (placed, cut-off {formatIst(board.pending.cutoffAt, true)})
          </div>
          <p>
            {board.pending.placedMealsByStation
              .map((s) => `${s.stationName} ${s.meals}`)
              .join(' · ')}
          </p>
        </div>
      )}
    </div>
  );
}

/** PRD §8.4: "What leaves next, who drives it, what's late?" */
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
  if (!d) return <Skeleton className="h-96" />;
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
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link href="/dispatch" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
          Open the board
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Waiting on kitchen" value={d.summary.COOKING} />
        <Metric
          label="Ready to stage"
          value={d.summary.KITCHEN_READY}
          tone={d.summary.KITCHEN_READY > 0 ? 'amber' : undefined}
        />
        <Metric label="Dispatch-ready" value={d.summary.DISPATCH_READY} />
        <Metric label="Out" value={d.summary.OUT_FOR_DELIVERY} />
        <Metric label="Delivered" value={d.summary.DELIVERED} />
        <Metric
          label="On time today"
          value={ratio(delivered.filter((x) => x.deliveredOnTime).length, delivered.length)}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={`Late / at risk (${lateDrops.length})`}>
          {lateDrops.length === 0 && <p className="text-muted-foreground">Nothing late.</p>}
          <ul className="space-y-1">
            {lateDrops.map((x) => (
              <li key={x.id} className="flex justify-between gap-2">
                <span>
                  {x.company.name} · {minutesToHHmm(x.deliveryTimeMinutes)}
                </span>
                <Badge variant={x.timeliness === 'LATE' ? 'destructive' : 'outline'}>
                  {x.timeliness === 'LATE' ? 'LATE' : 'AT RISK'}
                </Badge>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Next departures">
          {next.length === 0 && <p className="text-muted-foreground">Everything has left.</p>}
          <ul className="space-y-1">
            {next.map((x) => (
              <li key={x.id} className="flex justify-between gap-2">
                <span>
                  {formatIst(x.plannedDispatchReadyAt)} · {x.company.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {x.readiness.ready}/{x.readiness.total} cooked · {x.driver?.name ?? 'No driver'}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={`No driver (${noDriver.length})`}>
          {noDriver.length === 0 ? (
            <p className="text-muted-foreground">Every drop today and tomorrow has a driver.</p>
          ) : (
            <ul className="space-y-1">
              {noDriver.map((x) => (
                <li key={x.id}>
                  {formatKitchenDate(x.deliveryDate)} {minutesToHHmm(x.deliveryTimeMinutes)} ·{' '}
                  {x.company.name}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <Panel title="Driver load today">
        {drivers.length === 0 && <p className="text-muted-foreground">No drops assigned today.</p>}
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="text-left font-normal">Driver</th>
              <th className="text-right font-normal">Assigned</th>
              <th className="text-right font-normal">Out</th>
              <th className="text-right font-normal">Delivered</th>
              <th className="text-right font-normal">On time</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((x) => (
              <tr key={x.name}>
                <td>{x.name}</td>
                <td className="text-right tabular-nums">{x.assigned}</td>
                <td className="text-right tabular-nums">{x.out}</td>
                <td className="text-right tabular-nums">{x.delivered}</td>
                <td className="text-right tabular-nums">{ratio(x.onTime, x.delivered)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

/** PRD §8.5: "Where do I go next?" */
export function DriverSection() {
  const q = useQuery({
    queryKey: ['driver-drops'],
    queryFn: () => api<DriverDropsDto>('/driver/drops'),
    refetchInterval: 30_000,
  });
  const d = q.data;
  if (!d) return <Skeleton className="h-48" />;
  const delivered = d.drops.filter((x) => x.deliveredAt);
  const next = d.drops.find((x) => !x.deliveredAt);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Metric
          label="My drops today"
          value={d.drops.length}
          hint={`${delivered.length} delivered · ${d.drops.length - delivered.length} to go`}
        />
        <Metric
          label="On time today"
          value={ratio(delivered.filter((x) => x.deliveredOnTime).length, delivered.length)}
        />
      </div>
      <Panel title="Next stop">
        {next ? (
          <div className="space-y-1">
            <div className="text-lg font-semibold">
              {minutesToHHmm(next.deliveryTimeMinutes)} · {next.company.name}
            </div>
            <div>
              {next.address.label}: {next.address.line1}, {next.address.city}
            </div>
            <div className="text-muted-foreground">
              {next.boxes} box{next.boxes === 1 ? '' : 'es'} · {next.driverInstructions}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">No more stops today.</p>
        )}
      </Panel>
      <Link href="/driver" className={buttonVariants({ size: 'lg', className: 'w-full' })}>
        Open my deliveries
      </Link>
    </div>
  );
}
