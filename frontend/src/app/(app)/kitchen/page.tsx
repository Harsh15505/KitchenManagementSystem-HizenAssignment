'use client';

import { type KitchenBoardDto, type KitchenUnitDto } from '@fernleaf/shared';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Ban, Check, Flame, Play, Snowflake } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { CountUp } from '@/components/count-up';
import { RequireAbility } from '@/components/require-ability';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, api } from '@/lib/api-client';
import { useAbility } from '@/lib/auth';
import { formatIst, formatKitchenDate } from '@/lib/orders';
import { nameLookup, useReferenceList } from '@/lib/reference';
import { cn } from '@/lib/utils';

export default function KitchenPage() {
  return (
    <RequireAbility action="read" subject="KitchenBoard">
      <KitchenBoard />
    </RequireAbility>
  );
}

/** FR-KIT-01..08: what to cook, at which station, by when. Refreshes every 15 s. */
function KitchenBoard() {
  const ability = useAbility();
  const canWork = ability.can('work', 'PrepUnit');
  const canForce = ability.can('forceComplete', 'Order');
  const queryClient = useQueryClient();
  const allergens = nameLookup(useReferenceList('allergens').data);
  const [date, setDate] = useState('');
  const [station, setStation] = useState<string | undefined>(undefined);
  const [view, setView] = useState<'board' | 'prep'>('board');
  const [busy, setBusy] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (date) params.set('date', date);
  if (station) params.set('stationId', station);
  const key = ['kitchen-board', params.toString()];
  const board = useQuery({
    queryKey: key,
    queryFn: () => api<KitchenBoardDto>(`/kitchen/board?${params}`),
    refetchInterval: 15_000,
    placeholderData: keepPreviousData,
  });

  async function act(unit: KitchenUnitDto, action: 'start' | 'done') {
    setBusy(unit.id);
    // Optimistic: show the change at once; the refetch below settles the truth.
    const nowIso = new Date().toISOString();
    queryClient.setQueryData<KitchenBoardDto>(
      key,
      (b) =>
        b && {
          ...b,
          slots: b.slots.map((s) => ({
            ...s,
            units: s.units.map((u) =>
              u.id === unit.id
                ? {
                    ...u,
                    prepStartedAt: u.prepStartedAt ?? nowIso,
                    prepDoneAt: action === 'done' ? nowIso : u.prepDoneAt,
                    timeliness: action === 'done' ? 'DONE' : u.timeliness,
                  }
                : u,
            ),
          })),
        },
    );
    try {
      const result = await api<{ orderReady?: boolean }>(`/kitchen/units/${unit.id}/${action}`, {
        method: 'POST',
      });
      if (result.orderReady) toast.success(`Order #${unit.order.number} is fully cooked`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'That didn’t save');
    } finally {
      setBusy(null);
      void queryClient.invalidateQueries({ queryKey: ['kitchen-board'] });
    }
  }

  async function forceComplete(unit: KitchenUnitDto) {
    if (!window.confirm(`Mark everything on order #${unit.order.number} as cooked?`)) return;
    try {
      await api(`/kitchen/orders/${unit.order.id}/force-complete`, { method: 'POST' });
      toast.success(`Order #${unit.order.number} force-completed`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'That didn’t save');
    }
    void queryClient.invalidateQueries({ queryKey: ['kitchen-board'] });
  }

  const data = board.data;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Kitchen board</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${formatKitchenDate(data.date)} · updated ${formatIst(data.now)}` : 'Loading…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="Delivery date"
            className="w-40"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <div className="flex rounded-full border bg-card p-1 shadow-(--shadow-card)">
            {(['board', 'prep'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cn(
                  'rounded-full px-3.5 py-1 text-sm transition-colors',
                  view === v ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted',
                )}
              >
                {v === 'board' ? 'Board' : 'Prep summary'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {data && (
        <>
          <div role="group" aria-label="Station" className="flex flex-wrap gap-2">
            <StationChip
              label="All stations"
              active={station === undefined}
              onClick={() => setStation(undefined)}
            />
            {data.stations.map((s) => (
              <StationChip
                key={s.id ?? 'none'}
                label={`${s.name} ${s.remaining}/${s.total}`}
                active={station === (s.id ?? 'unassigned')}
                onClick={() => setStation(s.id ?? 'unassigned')}
                warn={s.id === null}
              />
            ))}
          </div>
          <div className="stagger grid grid-cols-3 gap-2 sm:grid-cols-6">
            <Stat label="Orders" value={data.summary.orders} />
            <Stat label="Items" value={data.summary.units} />
            <Stat label="Done" value={data.summary.done} />
            <Stat label="Cooking" value={data.summary.inProgress} />
            <Stat
              label="At risk"
              value={data.summary.atRisk}
              tone={data.summary.atRisk > 0 ? 'amber' : undefined}
            />
            <Stat
              label="Late"
              value={data.summary.late}
              tone={data.summary.late > 0 ? 'red' : undefined}
            />
          </div>
        </>
      )}

      {!data && <Skeleton className="h-96" />}
      {data && view === 'prep' && (
        <div className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.prep.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing to cook for this day.</p>
          )}
          {data.prep.map((s) => (
            <Card key={s.stationId ?? 'none'}>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle>{s.stationName}</CardTitle>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {s.meals.total - s.meals.done} left of {s.meals.total} meals
                </span>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {s.dishes.map((d) => (
                  <div key={d.dishName} className={d.remaining === 0 ? 'opacity-55' : undefined}>
                    <div className="flex justify-between gap-2 font-medium">
                      <span>{d.dishName}</span>
                      <span className="tabular-nums">
                        {d.remaining === 0 ? 'done' : `${d.remaining} left`}
                        <span className="font-normal text-muted-foreground"> / {d.quantity}</span>
                      </span>
                    </div>
                    {d.combinations.map((c) => (
                      <div
                        key={c.label}
                        className="flex justify-between gap-2 pl-3 text-muted-foreground"
                      >
                        <span>{c.label}</span>
                        <span className="tabular-nums">
                          {c.remaining} / {c.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {data && view === 'board' && (
        <div className="space-y-6">
          {data.slots.length === 0 && (
            <p className="text-sm text-muted-foreground">No confirmed orders for this day.</p>
          )}
          {data.slots.map((slot) => {
            const work = slot.units.filter((u) => !u.doNotCook);
            const open = work.filter((u) => !u.prepDoneAt).length;
            const pct = work.length === 0 ? 100 : ((work.length - open) / work.length) * 100;
            return (
              <section key={slot.plannedKitchenReadyAt} className="animate-rise space-y-3">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'size-2.5 shrink-0 rounded-full',
                      open === 0 ? 'bg-primary' : 'animate-soft-pulse bg-sidebar-primary',
                    )}
                  />
                  <h2 className="font-heading text-lg font-semibold">
                    Ready by {formatIst(slot.plannedKitchenReadyAt)}
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    {open === 0 ? 'all done' : `${open} to go`}
                  </span>
                  <div className="ml-auto hidden h-1.5 w-40 overflow-hidden rounded-full bg-muted sm:block">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {slot.units.map((u) => (
                    <UnitCard
                      key={u.id}
                      unit={u}
                      allergens={allergens}
                      busy={busy === u.id}
                      canWork={canWork}
                      canForce={canForce}
                      onAct={(a) => void act(u, a)}
                      onForce={() => void forceComplete(u)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StationChip({
  label,
  active,
  onClick,
  warn,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  warn?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-sm transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
          : warn
            ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30'
            : 'bg-card hover:bg-muted',
      )}
    >
      {label}
    </button>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'red' | 'amber' }) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-2.5 text-center shadow-(--shadow-card)',
        tone === 'red' &&
          'border-red-400 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200',
        tone === 'amber' &&
          'border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
      )}
    >
      <div className="font-heading text-2xl font-semibold tabular-nums">
        <CountUp value={value} />
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function UnitCard({
  unit,
  allergens,
  busy,
  canWork,
  canForce,
  onAct,
  onForce,
}: {
  unit: KitchenUnitDto;
  allergens: Map<string, string>;
  busy: boolean;
  canWork: boolean;
  canForce: boolean;
  onAct: (action: 'start' | 'done') => void;
  onForce: () => void;
}) {
  const done = Boolean(unit.prepDoneAt);
  return (
    <div
      className={cn(
        'lift relative space-y-2 overflow-hidden rounded-xl border bg-card p-3 pl-4 shadow-(--shadow-card)',
        'before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-border',
        unit.doNotCook && 'border-dashed bg-muted/40 opacity-80',
        !unit.doNotCook && done && 'bg-primary/[0.04] before:bg-primary',
        !unit.doNotCook && !done && unit.prepStartedAt && 'before:bg-chart-2',
        !unit.doNotCook &&
          !done &&
          unit.timeliness === 'AT_RISK' &&
          'border-amber-400 before:bg-amber-500',
        !unit.doNotCook &&
          !done &&
          unit.timeliness === 'LATE' &&
          'border-red-400 before:bg-red-500',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-heading text-lg leading-tight font-semibold">
            {unit.quantity} × {unit.dish.name}
          </div>
          {unit.choices.length > 0 && <div className="text-sm">{unit.choices.join(' · ')}</div>}
        </div>
        {unit.dish.temperature === 'HOT' ? (
          <Flame className="size-4 shrink-0 text-orange-500" aria-label="Hot" />
        ) : (
          <Snowflake className="size-4 shrink-0 text-sky-500" aria-label="Cold" />
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {unit.doNotCook && (
          <Badge variant="secondary">
            <Ban className="size-3" aria-hidden /> Do not cook ({unit.order.status.toLowerCase()})
          </Badge>
        )}
        {!unit.doNotCook && !done && unit.timeliness === 'LATE' && (
          <Badge variant="destructive">LATE</Badge>
        )}
        {!unit.doNotCook && !done && unit.timeliness === 'AT_RISK' && (
          <Badge variant="warning">AT RISK</Badge>
        )}
        {unit.allergenIds.map((id) => (
          <Badge key={id} variant="destructive">
            <AlertTriangle className="size-3" aria-hidden /> {allergens.get(id) ?? 'Allergen'}
          </Badge>
        ))}
      </div>
      <div className="text-xs text-muted-foreground">
        <Link href={`/orders/${unit.order.id}`} className="font-mono hover:underline">
          #{unit.order.number}
        </Link>{' '}
        · {unit.order.employeeName} · {unit.order.companyName} · leaves{' '}
        {formatIst(unit.plannedDispatchReadyAt)}
        {unit.order.notes && <div className="mt-1 text-foreground">Note: {unit.order.notes}</div>}
      </div>
      {!unit.doNotCook && (
        <div className="flex items-center gap-2">
          {done ? (
            <span className="flex items-center gap-1 text-sm text-primary">
              <Check className="size-4" aria-hidden /> Done {formatIst(unit.prepDoneAt!)}
            </span>
          ) : canWork ? (
            <>
              {!unit.prepStartedAt && (
                <Button size="lg" variant="outline" disabled={busy} onClick={() => onAct('start')}>
                  <Play className="size-4" aria-hidden /> Start
                </Button>
              )}
              <Button size="lg" disabled={busy} onClick={() => onAct('done')}>
                <Check className="size-4" aria-hidden /> Done
              </Button>
              {unit.prepStartedAt && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="animate-soft-pulse size-1.5 rounded-full bg-chart-2" />
                  cooking since {formatIst(unit.prepStartedAt)}
                </span>
              )}
            </>
          ) : (
            <span className="text-sm text-muted-foreground">
              {unit.prepStartedAt ? 'Cooking' : 'Queued'}
            </span>
          )}
          {canForce && !done && (
            <Button size="sm" variant="ghost" className="ml-auto" onClick={onForce}>
              Force-complete order
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
