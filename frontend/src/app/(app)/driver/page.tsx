'use client';

import { type DriverDropsDto, type DropDto, minutesToHHmm } from '@fernleaf/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, CheckCircle2, MapPin, Package } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { RequireAbility } from '@/components/require-ability';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, api } from '@/lib/api-client';
import { formatIst, formatKitchenDate } from '@/lib/orders';
import { cn } from '@/lib/utils';

export default function DriverPage() {
  return (
    <RequireAbility action="deliver" subject="Drop">
      <MyDeliveries />
    </RequireAbility>
  );
}

const STATUS: Record<DropDto['stage'], string> = {
  COOKING: 'Being cooked',
  KITCHEN_READY: 'Being packed',
  DISPATCH_READY: 'Packed, waiting for you',
  OUT_FOR_DELIVERY: 'On the way',
  DELIVERED: 'Delivered',
};

/** FR-DSP-04: the driver's own drops for today, next stop first, on a phone. */
function MyDeliveries() {
  const drops = useQuery({
    queryKey: ['driver-drops'],
    queryFn: () => api<DriverDropsDto>('/driver/drops'),
    refetchInterval: 30_000,
  });
  const [delivering, setDelivering] = useState<DropDto | null>(null);
  const data = drops.data;
  const pending = data?.drops.filter((d) => d.stage !== 'DELIVERED') ?? [];
  const next = pending.find((d) => d.stage === 'OUT_FOR_DELIVERY') ?? pending[0];

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My deliveries</h1>
        <p className="text-sm text-muted-foreground">
          {data
            ? `${formatKitchenDate(data.date)} · ${pending.length} to go, ${data.drops.length - pending.length} done`
            : 'Loading…'}
        </p>
      </div>
      {!data && <Skeleton className="h-64" />}
      {data && data.drops.length === 0 && (
        <p className="text-sm text-muted-foreground">No deliveries assigned to you today.</p>
      )}
      {next && (
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Next stop
          </p>
          <DropCard drop={next} hero onDeliver={() => setDelivering(next)} />
        </div>
      )}
      {data?.drops
        .filter((d) => d.id !== next?.id)
        .map((d) => (
          <DropCard key={d.id} drop={d} onDeliver={() => setDelivering(d)} />
        ))}
      {delivering && <DeliverSheet drop={delivering} onClose={() => setDelivering(null)} />}
    </div>
  );
}

function DropCard({
  drop,
  hero,
  onDeliver,
}: {
  drop: DropDto;
  hero?: boolean;
  onDeliver: () => void;
}) {
  const address = [
    drop.address.line1,
    drop.address.line2,
    `${drop.address.city} ${drop.address.postalCode}`,
  ]
    .filter(Boolean)
    .join(', ');
  const done = drop.stage === 'DELIVERED';
  return (
    <Card className={cn(hero && 'border-2 border-primary', done && 'opacity-70')}>
      <CardContent className="space-y-2 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-lg font-semibold">{minutesToHHmm(drop.deliveryTimeMinutes)}</div>
            <div className="font-medium">{drop.company.name}</div>
          </div>
          <Badge
            variant={done ? 'secondary' : drop.stage === 'OUT_FOR_DELIVERY' ? 'default' : 'outline'}
          >
            {STATUS[drop.stage]}
          </Badge>
        </div>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address}, India`)}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-start gap-1 text-sm underline"
        >
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {drop.address.label}: {address}
          </span>
        </a>
        {(drop.address.accessNotes || drop.driverInstructions) && (
          <p className="text-sm">
            {[drop.address.accessNotes, drop.driverInstructions].filter(Boolean).join(' · ')}
          </p>
        )}
        <p className="flex items-center gap-1 text-sm">
          <Package className="size-4" aria-hidden /> {drop.boxes} box{drop.boxes === 1 ? '' : 'es'}{' '}
          · {[...new Set(drop.orders.map((o) => o.packaging))].join(', ')}
        </p>
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            For {drop.orders.length} {drop.orders.length === 1 ? 'person' : 'people'}
          </summary>
          <ul className="mt-1 space-y-0.5">
            {drop.orders.map((o) => (
              <li key={o.id}>
                {o.employeeName} · {o.itemCount} item{o.itemCount === 1 ? '' : 's'} (#{o.number})
              </li>
            ))}
          </ul>
        </details>
        {drop.stage === 'OUT_FOR_DELIVERY' && (
          <Button size="lg" className="w-full" onClick={onDeliver}>
            <CheckCircle2 className="size-5" aria-hidden /> Mark delivered
          </Button>
        )}
        {done && (
          <p className="text-sm text-muted-foreground">
            Delivered {drop.deliveredAt ? formatIst(drop.deliveredAt) : ''}
            {drop.deliveredOnTime === false ? ' (late)' : ''}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Shrinks a camera photo in the browser so the upload stays small (T-705). */
async function compress(file: File): Promise<{ mimeType: 'image/jpeg'; dataBase64: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
  return { mimeType: 'image/jpeg', dataBase64: dataUrl.slice(dataUrl.indexOf(',') + 1) };
}

function DeliverSheet({ drop, onClose }: { drop: DropDto; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const photo = file ? await compress(file) : undefined;
      const result = await api<{ onTime: boolean }>(`/driver/drops/${drop.id}/delivered`, {
        method: 'POST',
        body: JSON.stringify({ note: note.trim() || undefined, photo }),
      });
      toast.success(result.onTime ? 'Delivered on time' : 'Delivered (late)');
      void queryClient.invalidateQueries({ queryKey: ['driver-drops'] });
      onClose();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'That didn’t save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Mark delivered"
    >
      <div className="w-full space-y-4 rounded-t-2xl bg-background p-4 sm:max-w-md sm:rounded-2xl">
        <div>
          <h2 className="text-lg font-semibold">Delivered to {drop.company.name}?</h2>
          <p className="text-sm text-muted-foreground">
            {drop.address.label} · {drop.boxes} box{drop.boxes === 1 ? '' : 'es'}
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="dl-note">Note (optional)</Label>
          <textarea
            id="dl-note"
            rows={2}
            className="w-full rounded-md border bg-background p-2 text-sm"
            placeholder="Handed to the pantry lead"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dl-photo" className="flex items-center gap-1">
            <Camera className="size-4" aria-hidden /> Photo (optional)
          </Label>
          <input
            id="dl-photo"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="flex gap-2">
          <Button size="lg" className="flex-1" disabled={saving} onClick={() => void submit()}>
            {saving ? 'Saving…' : 'Confirm delivery'}
          </Button>
          <Button size="lg" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
