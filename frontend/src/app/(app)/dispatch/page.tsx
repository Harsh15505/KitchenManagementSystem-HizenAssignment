'use client';

import {
  DROP_STAGES,
  type DispatchBoardDto,
  type DropDto,
  type DropStage,
  minutesToHHmm,
} from '@fernleaf/shared';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Package, Truck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { RequireAbility } from '@/components/require-ability';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, api } from '@/lib/api-client';
import { useAbility } from '@/lib/auth';
import { formatIst, formatKitchenDate } from '@/lib/orders';
import { cn } from '@/lib/utils';

const STAGE_TEXT: Record<DropStage, string> = {
  COOKING: 'In the kitchen',
  KITCHEN_READY: 'Cooked, to pack',
  DISPATCH_READY: 'Packed',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
};

export default function DispatchPage() {
  return (
    <RequireAbility action="read" subject="DispatchBoard">
      <DispatchBoard />
    </RequireAbility>
  );
}

/** FR-DSP-01..03: drops for a day, their readiness, driver and next step. Refreshes every 15 s. */
function DispatchBoard() {
  const ability = useAbility();
  const queryClient = useQueryClient();
  const [date, setDate] = useState('');
  const [stage, setStage] = useState<DropStage | ''>('');
  const [driver, setDriver] = useState('');
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  if (stage) params.set('stage', stage);
  if (driver) params.set('driverId', driver);
  const board = useQuery({
    queryKey: ['dispatch-board', params.toString()],
    queryFn: () => api<DispatchBoardDto>(`/dispatch/board?${params}`),
    refetchInterval: 15_000,
    placeholderData: keepPreviousData,
  });

  async function act(drop: DropDto, path: string, method: string, body: unknown, ok: string) {
    try {
      await api(`/dispatch/drops/${drop.id}/${path}`, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      toast.success(ok);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'That didn’t save');
    }
    void queryClient.invalidateQueries({ queryKey: ['dispatch-board'] });
  }

  const data = board.data;
  const groups = new Map<string, DropDto[]>();
  for (const d of data?.drops ?? [])
    groups.set(d.deliveryAt, [...(groups.get(d.deliveryAt) ?? []), d]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dispatch board</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${formatKitchenDate(data.date)} · updated ${formatIst(data.now)}` : 'Loading…'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            type="date"
            aria-label="Delivery date"
            className="w-40"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <NativeSelect
            aria-label="Driver"
            value={driver}
            onChange={(e) => setDriver(e.target.value)}
          >
            <NativeSelectOption value="">All drivers</NativeSelectOption>
            <NativeSelectOption value="unassigned">No driver</NativeSelectOption>
            {data?.drivers.map((d) => (
              <NativeSelectOption key={d.id} value={d.id}>
                {d.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
      {data && (
        <div role="group" aria-label="Stage" className="flex flex-wrap gap-2">
          <Chip label={`All ${data.summary.drops}`} active={!stage} onClick={() => setStage('')} />
          {DROP_STAGES.map((s) => (
            <Chip
              key={s}
              label={`${STAGE_TEXT[s]} ${data.summary[s]}`}
              active={stage === s}
              onClick={() => setStage(s)}
            />
          ))}
          {data.summary.late > 0 && <Badge variant="destructive">{data.summary.late} late</Badge>}
          {data.summary.atRisk > 0 && (
            <Badge className="bg-amber-500 text-white">{data.summary.atRisk} at risk</Badge>
          )}
          {data.summary.unassigned > 0 && (
            <Badge variant="outline">{data.summary.unassigned} without a driver</Badge>
          )}
        </div>
      )}
      {!data && <Skeleton className="h-96" />}
      {data && data.drops.length === 0 && (
        <p className="text-sm text-muted-foreground">No drops match.</p>
      )}
      {[...groups.entries()].map(([at, drops]) => (
        <section key={at} className="space-y-2">
          <h2 className="text-sm font-semibold">Deliver at {formatIst(at)}</h2>
          <div className="grid gap-2 lg:grid-cols-2">
            {drops.map((d) => (
              <DropCard
                key={d.id}
                drop={d}
                drivers={data?.drivers ?? []}
                canAssign={ability.can('assignDriver', 'Drop')}
                canMove={ability.can('markReady', 'Drop')}
                onAct={(path, method, body, ok) => void act(d, path, method, body, ok)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-sm',
        active ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
      )}
    >
      {label}
    </button>
  );
}

function DropCard({
  drop,
  drivers,
  canAssign,
  canMove,
  onAct,
}: {
  drop: DropDto;
  drivers: Array<{ id: string; name: string }>;
  canAssign: boolean;
  canMove: boolean;
  onAct: (path: string, method: string, body: unknown, ok: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const live = drop.stage !== 'DELIVERED';
  return (
    <div
      className={cn(
        'space-y-2 rounded-lg border-2 p-3',
        live && drop.timeliness === 'LATE' && 'border-red-500',
        live && drop.timeliness === 'AT_RISK' && 'border-amber-400',
        !live && 'bg-muted/30',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-semibold">
            {drop.company.name} · {drop.address.label}
          </div>
          <div className="text-xs text-muted-foreground">
            {minutesToHHmm(drop.deliveryTimeMinutes)} delivery · leaves by{' '}
            {formatIst(drop.plannedDispatchReadyAt)} · {drop.boxes} boxes
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant={drop.stage === 'DELIVERED' ? 'secondary' : 'default'}>
            {STAGE_TEXT[drop.stage]}
          </Badge>
          {live && drop.timeliness === 'LATE' && <Badge variant="destructive">LATE</Badge>}
          {live && drop.timeliness === 'AT_RISK' && (
            <Badge className="bg-amber-500 text-white">AT RISK</Badge>
          )}
          {drop.deliveredOnTime === false && <Badge variant="destructive">Delivered late</Badge>}
          {drop.deliveredOnTime === true && <Badge variant="outline">On time</Badge>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className={cn(
            'tabular-nums',
            drop.readiness.ready < drop.readiness.total && 'text-amber-700',
          )}
        >
          Cooked {drop.readiness.ready}/{drop.readiness.total}
        </span>
        <span className="text-muted-foreground">·</span>
        {canAssign && !drop.outForDeliveryAt ? (
          <NativeSelect
            aria-label="Driver"
            value={drop.driver?.id ?? ''}
            onChange={(e) =>
              onAct(
                'driver',
                'PUT',
                { driverId: e.target.value || null },
                e.target.value ? 'Driver assigned' : 'Driver removed',
              )
            }
          >
            <NativeSelectOption value="">No driver</NativeSelectOption>
            {drivers.map((d) => (
              <NativeSelectOption key={d.id} value={d.id}>
                {d.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ) : (
          <span>{drop.driver?.name ?? 'No driver'}</span>
        )}
        <span className="ml-auto flex gap-2">
          {canMove && drop.stage === 'KITCHEN_READY' && (
            <Button size="sm" onClick={() => onAct('ready', 'POST', undefined, 'Drop packed')}>
              <Package className="size-4" aria-hidden /> Mark packed
            </Button>
          )}
          {canMove && drop.stage === 'DISPATCH_READY' && (
            <Button
              size="sm"
              disabled={!drop.driver}
              onClick={() => onAct('out', 'POST', undefined, 'Drop sent out')}
            >
              <Truck className="size-4" aria-hidden /> Send out
            </Button>
          )}
          {canMove && drop.stage === 'OUT_FOR_DELIVERY' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                onAct('delivered', 'POST', { note: 'Recorded by dispatch' }, 'Marked delivered')
              }
            >
              Mark delivered
            </Button>
          )}
        </span>
      </div>
      {(drop.deliveryNote || drop.hasPhoto) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {drop.deliveryNote && <span>“{drop.deliveryNote}”</span>}
          {drop.hasPhoto && (
            <a
              href={`/api/drops/${drop.id}/photo`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline"
            >
              <Camera className="size-3" aria-hidden /> Photo
            </a>
          )}
        </div>
      )}
      <button
        type="button"
        className="text-xs text-muted-foreground underline"
        onClick={() => setOpen(!open)}
      >
        {open ? 'Hide' : 'Show'} {drop.orders.length} order{drop.orders.length === 1 ? '' : 's'}
      </button>
      {open && (
        <ul className="space-y-0.5 text-xs">
          {drop.orders.map((o) => (
            <li key={o.id} className="flex justify-between gap-2">
              <Link href={`/orders/${o.id}`} className="hover:underline">
                #{o.number} {o.employeeName}
              </Link>
              <span className={o.kitchenReady ? 'text-green-700' : 'text-amber-700'}>
                {o.itemCount} items · {o.packaging} · {o.kitchenReady ? 'cooked' : 'cooking'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
