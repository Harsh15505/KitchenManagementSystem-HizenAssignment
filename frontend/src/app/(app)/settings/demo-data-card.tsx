'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError, api } from '@/lib/api-client';
import { useAbility } from '@/lib/auth';
import { formatIst, formatKitchenDate } from '@/lib/orders';

interface DemoStatus {
  autopilotEnabled: boolean;
  orders: number;
  days: number;
  firstDate: string | null;
  lastDate: string | null;
  lastGeneratedAt: string | null;
}

/** FR-DAT-01..04: the rolling demo window, the autopilot switch lives in the form above. */
export function DemoDataCard() {
  const canManage = useAbility().can('manage', 'DemoData');
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: ['demo-status'],
    queryFn: () => api<DemoStatus>('/demo/status'),
    enabled: canManage,
  });
  const [busy, setBusy] = useState(false);
  if (!canManage) return null;
  const s = status.data;

  async function regenerate() {
    if (
      !window.confirm(
        'Delete all generated orders, drops and demo invoices, and build the window again? Orders created by staff are kept.',
      )
    )
      return;
    setBusy(true);
    try {
      const result = await api<{ orders: number }>('/demo/regenerate', { method: 'POST' });
      toast.success(`Regenerated ${result.orders} demo orders`);
      void queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Regeneration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Demo data</CardTitle>
        <CardDescription>
          Generated orders keep every screen realistic on any day: delivered history, live work
          today, and open orders ahead. The autopilot moves today’s orders along their plans unless
          a person takes one over.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {s && (
          <div className="flex flex-wrap gap-2">
            <Badge variant={s.autopilotEnabled ? 'default' : 'secondary'}>
              Generator and autopilot {s.autopilotEnabled ? 'on' : 'off'}
            </Badge>
            <Badge variant="outline">{s.orders} generated orders</Badge>
            {s.firstDate && s.lastDate && (
              <Badge variant="outline">
                {formatKitchenDate(s.firstDate)} – {formatKitchenDate(s.lastDate)}
              </Badge>
            )}
            {s.lastGeneratedAt && (
              <Badge variant="outline">last generated {formatIst(s.lastGeneratedAt, true)}</Badge>
            )}
          </div>
        )}
        <Button variant="outline" disabled={busy} onClick={() => void regenerate()}>
          {busy ? 'Regenerating… (about a minute)' : 'Regenerate demo data'}
        </Button>
      </CardContent>
    </Card>
  );
}
