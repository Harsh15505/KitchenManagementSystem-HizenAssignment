'use client';

import { formatOrderNumber, formatUsd, type UninvoicedDto } from '@fernleaf/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ListBox, ListBoxEmpty } from '@/components/list-box';
import { RequireAbility } from '@/components/require-ability';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, api } from '@/lib/api-client';
import { formatKitchenDate } from '@/lib/orders';
import { plural } from '@/lib/utils';

export default function CompanyBillingPage() {
  return (
    <RequireAbility action="manage" subject="Invoice">
      <InvoiceBuilder />
    </RequireAbility>
  );
}

/** FR-BIL-02: choose what goes on the invoice. Default: everything delivered up to a date, plus credits. */
function InvoiceBuilder() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [upTo, setUpTo] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const data = useQuery({
    queryKey: ['uninvoiced', id],
    queryFn: () => api<UninvoicedDto>(`/billing/companies/${id}/uninvoiced`),
  });
  // Selection is derived from the defaults plus the user's toggles (no state syncing effects).
  const [toggled, setToggled] = useState<Set<string>>(new Set());
  const defaults = useMemo(() => {
    const set = new Set<string>();
    for (const o of data.data?.orders ?? [])
      if (o.status === 'DELIVERED' && (!upTo || o.deliveryDate <= upTo)) set.add(o.id);
    for (const a of data.data?.adjustments ?? []) set.add(a.id);
    return set;
  }, [data.data, upTo]);
  const selected = (rowId: string) => defaults.has(rowId) !== toggled.has(rowId);
  const toggle = (rowId: string) =>
    setToggled((t) => {
      const next = new Set(t);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });

  const orders = data.data?.orders ?? [];
  const adjustments = data.data?.adjustments ?? [];
  const pickedOrders = orders.filter((o) => selected(o.id));
  const pickedAdjustments = adjustments.filter((a) => selected(a.id));
  const total =
    pickedOrders.reduce((s, o) => s + o.totalCents, 0) +
    pickedAdjustments.reduce((s, a) => s + a.amountCents, 0);

  async function create() {
    setSaving(true);
    try {
      const invoice = await api<{ id: string }>('/invoices', {
        method: 'POST',
        body: JSON.stringify({
          companyId: id,
          orderIds: pickedOrders.map((o) => o.id),
          adjustmentIds: pickedAdjustments.map((a) => a.id),
          notes: notes.trim() || undefined,
        }),
      });
      toast.success('Invoice issued (email simulated)');
      void queryClient.invalidateQueries({ queryKey: ['billing-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['uninvoiced', id] });
      router.push(`/billing/invoices/${invoice.id}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not create the invoice');
      void queryClient.invalidateQueries({ queryKey: ['uninvoiced', id] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <Link
        href="/billing"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden /> Billing
      </Link>
      <h1 className="page-title">New invoice · {data.data?.company.name ?? '…'}</h1>
      {!data.data && <Skeleton className="h-64" />}
      {data.data && (
        <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3">
                <CardTitle>Orders ({orders.length} uninvoiced)</CardTitle>
                <div className="space-y-1">
                  <Label htmlFor="upto" className="text-xs">
                    Pre-select delivered up to
                  </Label>
                  <Input
                    id="upto"
                    type="date"
                    className="w-40"
                    value={upTo}
                    onChange={(e) => {
                      setUpTo(e.target.value);
                      setToggled(new Set());
                    }}
                  />
                </div>
              </CardHeader>
              <CardContent className="text-sm">
                {orders.length === 0 ? (
                  <ListBox>
                    <ListBoxEmpty>Nothing to invoice.</ListBoxEmpty>
                  </ListBox>
                ) : (
                  <div className="overflow-hidden rounded-xl border">
                    <div className="grid grid-cols-[1.5rem_6.5rem_7rem_1fr_auto] gap-3 border-b bg-muted/60 px-3 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      <span />
                      <span>Order</span>
                      <span>Delivery</span>
                      <span>Employee</span>
                      <span className="text-right">Amount</span>
                    </div>
                    <div className="soft-scroll max-h-[26rem] divide-y divide-border/70 overflow-y-auto">
                      {orders.map((o) => (
                        <label
                          key={o.id}
                          className="grid cursor-pointer grid-cols-[1.5rem_6.5rem_7rem_1fr_auto] items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/50"
                        >
                          <input
                            type="checkbox"
                            className="size-4"
                            checked={selected(o.id)}
                            onChange={() => toggle(o.id)}
                          />
                          <span className="font-mono text-xs">{formatOrderNumber(o.number)}</span>
                          <span className="text-xs">{formatKitchenDate(o.deliveryDate)}</span>
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate">{o.employeeName}</span>
                            {o.status === 'CONFIRMED' && (
                              <Badge variant="outline">Not delivered yet</Badge>
                            )}
                          </span>
                          <span className="text-right tabular-nums">{formatUsd(o.totalCents)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            {adjustments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Credits and adjustments</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <div className="overflow-hidden rounded-xl border divide-y divide-border/70">
                    {adjustments.map((a) => (
                      <label
                        key={a.id}
                        className="grid cursor-pointer grid-cols-[1.5rem_6.5rem_1fr_auto] items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/50"
                      >
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={selected(a.id)}
                          onChange={() => toggle(a.id)}
                        />
                        <span className="font-mono text-xs">
                          {formatOrderNumber(a.orderNumber)}
                        </span>
                        <span className="min-w-0 truncate">{a.reason}</span>
                        <span className="text-right text-green-700 tabular-nums dark:text-green-400">
                          {formatUsd(a.amountCents)}
                        </span>
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          <Card className="lg:sticky lg:top-4 lg:self-start">
            <CardHeader>
              <CardTitle>Invoice</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                {plural(pickedOrders.length, 'order')},{' '}
                {plural(pickedAdjustments.length, 'adjustment')}
              </p>
              <p className="text-2xl font-semibold tabular-nums">{formatUsd(total)}</p>
              <p className="text-xs text-muted-foreground">
                To {data.data.company.billingEmail} (email is simulated).
              </p>
              <div className="space-y-1">
                <Label htmlFor="inv-notes">Notes (optional)</Label>
                <Input id="inv-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <Button
                className="w-full"
                disabled={saving || pickedOrders.length + pickedAdjustments.length === 0}
                onClick={() => void create()}
              >
                {saving ? 'Issuing…' : 'Issue invoice'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
