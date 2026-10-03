'use client';

import type { CutoffOverviewDto, CutoffRunDto } from '@fernleaf/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { RequireAbility } from '@/components/require-ability';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiError, api } from '@/lib/api-client';
import { useAbility } from '@/lib/auth';
import { formatIst, formatKitchenDate } from '@/lib/orders';

export default function CutoffPage() {
  return (
    <RequireAbility action="read" subject="Cutoff">
      <CutoffView />
    </RequireAbility>
  );
}

const TRIGGER_LABEL: Record<CutoffRunDto['trigger'], string> = {
  SCHEDULED: 'On time',
  CATCH_UP: 'Catch-up',
  MANUAL: 'Manual',
};

/** FR-ORD-05: when each date locks, what is waiting, the run history, and "Run now". */
function CutoffView() {
  const canRun = useAbility().can('run', 'Cutoff');
  const queryClient = useQueryClient();
  const overview = useQuery({
    queryKey: ['cutoff'],
    queryFn: () => api<CutoffOverviewDto>('/cutoff'),
    refetchInterval: 60_000,
  });
  const [date, setDate] = useState('');

  async function run(deliveryDate: string) {
    try {
      const result = await api<CutoffRunDto>('/cutoff/run', {
        method: 'POST',
        body: JSON.stringify({ deliveryDate }),
      });
      toast.success(
        `${formatKitchenDate(deliveryDate)}: ${result.ordersConfirmed} confirmed, ${result.draftsCancelled} drafts cancelled`,
      );
      void queryClient.invalidateQueries({ queryKey: ['cutoff'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'The run failed');
    }
  }

  const data = overview.data;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cut-off</h1>
        <p className="text-sm text-muted-foreground">
          At each cut-off, drafts for that delivery date are cancelled and placed orders are
          confirmed, which sends them to the kitchen and makes them billable. Runs are safe to
          repeat.
        </p>
      </div>
      {data && (
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant={data.autoCutoffEnabled ? 'default' : 'destructive'}>
            Automatic processing {data.autoCutoffEnabled ? 'on' : 'off'}
          </Badge>
          {data.nextCutoff && (
            <Badge variant="outline">
              Next: {formatKitchenDate(data.nextCutoff.deliveryDate)} locks{' '}
              {formatIst(data.nextCutoff.cutoffAt, true)}
            </Badge>
          )}
          {!data.autoCutoffEnabled && (
            <Link href="/settings" className="text-sm underline">
              Turn it on in Settings
            </Link>
          )}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Waiting for processing</CardTitle>
            <CardDescription>
              Delivery dates that still have drafts or placed orders.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data?.pending.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing waiting.</p>
            )}
            <ul className="space-y-2">
              {data?.pending.map((p) => (
                <li
                  key={p.deliveryDate}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <span>
                    <span className="font-medium">{formatKitchenDate(p.deliveryDate)}</span> ·{' '}
                    {p.placed} placed, {p.drafts} drafts
                    <br />
                    <span className="text-xs text-muted-foreground">
                      {p.due ? 'Cut-off passed' : 'Locks'} {formatIst(p.cutoffAt, true)}
                    </span>
                  </span>
                  {canRun && p.due && (
                    <Button size="sm" onClick={() => void run(p.deliveryDate)}>
                      Run now
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Upcoming lock times</CardTitle>
            <CardDescription>
              Kitchen working days only; company calendars don’t move the cut-off.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {data?.upcoming.map((u) => (
                <li key={u.deliveryDate} className="flex justify-between">
                  <span>{formatKitchenDate(u.deliveryDate)}</span>
                  <span className="text-muted-foreground">locks {formatIst(u.cutoffAt, true)}</span>
                </li>
              ))}
            </ul>
            {canRun && (
              <form
                className="mt-4 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (date) void run(date);
                }}
              >
                <Input
                  type="date"
                  aria-label="Delivery date to process"
                  className="w-44"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
                <Button type="submit" variant="outline" disabled={!date}>
                  Process a date
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Run history</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Delivery date</TableHead>
                <TableHead>Ran at</TableHead>
                <TableHead>How</TableHead>
                <TableHead className="text-right">Confirmed</TableHead>
                <TableHead className="text-right">Drafts cancelled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.runs.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatKitchenDate(r.deliveryDate)}</TableCell>
                  <TableCell>{formatIst(r.startedAt, true)}</TableCell>
                  <TableCell>
                    {TRIGGER_LABEL[r.trigger]}
                    {r.triggeredBy ? ` by ${r.triggeredBy}` : ''}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.ordersConfirmed}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.draftsCancelled}</TableCell>
                </TableRow>
              ))}
              {data?.runs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No runs yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
