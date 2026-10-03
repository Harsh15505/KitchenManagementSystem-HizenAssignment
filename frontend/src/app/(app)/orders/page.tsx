'use client';

import {
  type CompanyListItem,
  formatOrderNumber,
  formatUsd,
  minutesToHHmm,
  ORDER_STATUSES,
  type OrderListItem,
  type Paginated,
} from '@fernleaf/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Lock, Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { RequireAbility } from '@/components/require-ability';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api-client';
import { useAbility } from '@/lib/auth';
import { formatKitchenDate, STAGE_LABEL, STATUS_LABEL, STATUS_VARIANT } from '@/lib/orders';
import { cn } from '@/lib/utils';

export default function OrdersPage() {
  return (
    <RequireAbility action="read" subject="Order">
      {/* useSearchParams needs a Suspense boundary in the App Router. */}
      <Suspense fallback={<Skeleton className="h-96" />}>
        <OrderList />
      </Suspense>
    </RequireAbility>
  );
}

/** FR-ORD-06: server pagination, sort, search and filters, all kept in the URL. */
function OrderList() {
  const ability = useAbility();
  const canSeeMoney = ability.can('read', 'Money');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const get = (k: string) => params.get(k) ?? '';
  const statuses = get('status').split(',').filter(Boolean);
  const page = Number(get('page') || 1);
  const sort = get('sort') || '-deliveryDate';

  const set = (patch: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (resetPage && !('page' in patch)) next.delete('page');
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const apiParams = new URLSearchParams(params.toString());
  apiParams.set('pageSize', '25');
  const orders = useQuery({
    queryKey: ['orders', apiParams.toString()],
    queryFn: () => api<Paginated<OrderListItem>>(`/orders?${apiParams}`),
    placeholderData: keepPreviousData,
  });
  const companies = useQuery({
    queryKey: ['companies', 'order-filter'],
    queryFn: () => api<Paginated<CompanyListItem>>('/companies?pageSize=100'),
    enabled: ability.can('read', 'Company'),
  });

  const sortHeader = (key: string, label: string, className?: string) => {
    const active = sort.replace('-', '') === key;
    const desc = sort.startsWith('-');
    return (
      <TableHead className={className}>
        <button
          type="button"
          className="hover:underline"
          onClick={() => set({ sort: active && !desc ? `-${key}` : key })}
        >
          {label}
          {active ? (desc ? ' ↓' : ' ↑') : ''}
        </button>
      </TableHead>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Every order, past and future. Filters are kept in the address bar.
          </p>
        </div>
        {ability.can('create', 'Order') && (
          <Link href="/orders/new" className={buttonVariants()}>
            <Plus className="size-4" aria-hidden /> New order
          </Link>
        )}
      </div>
      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <Input
              className="max-w-xs"
              placeholder="Order no., employee or company"
              defaultValue={get('q')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') set({ q: e.currentTarget.value.trim() || null });
              }}
              onBlur={(e) => {
                if (e.currentTarget.value.trim() !== get('q'))
                  set({ q: e.currentTarget.value.trim() || null });
              }}
            />
            <label className="text-xs text-muted-foreground">
              From
              <Input
                type="date"
                className="w-40"
                value={get('dateFrom')}
                onChange={(e) => set({ dateFrom: e.target.value || null })}
              />
            </label>
            <label className="text-xs text-muted-foreground">
              To
              <Input
                type="date"
                className="w-40"
                value={get('dateTo')}
                onChange={(e) => set({ dateTo: e.target.value || null })}
              />
            </label>
            {companies.data && (
              <NativeSelect
                aria-label="Company"
                value={get('companyId')}
                onChange={(e) => set({ companyId: e.target.value || null })}
              >
                <NativeSelectOption value="">All companies</NativeSelectOption>
                {companies.data.items.map((c) => (
                  <NativeSelectOption key={c.id} value={c.id}>
                    {c.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
            <NativeSelect
              aria-label="Invoiced"
              value={get('invoiced')}
              onChange={(e) => set({ invoiced: e.target.value || null })}
            >
              <NativeSelectOption value="">Invoiced or not</NativeSelectOption>
              <NativeSelectOption value="true">Invoiced</NativeSelectOption>
              <NativeSelectOption value="false">Not invoiced</NativeSelectOption>
            </NativeSelect>
            {params.toString() && (
              <Button variant="ghost" size="sm" onClick={() => router.replace(pathname)}>
                Clear filters
              </Button>
            )}
          </div>
          <div role="group" aria-label="Status" className="flex flex-wrap gap-1.5">
            {ORDER_STATUSES.map((s) => {
              const on = statuses.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    set({
                      status:
                        (on ? statuses.filter((x) => x !== s) : [...statuses, s]).join(',') || null,
                    })
                  }
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-xs',
                    on ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
                  )}
                >
                  {STATUS_LABEL[s]}
                </button>
              );
            })}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                {sortHeader('number', 'Order')}
                {sortHeader('deliveryDate', 'Delivery')}
                <TableHead>Employee</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Items</TableHead>
                {canSeeMoney && sortHeader('total', 'Total', 'text-right')}
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.data?.items.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <Link
                      href={`/orders/${o.id}`}
                      className="font-mono text-sm font-medium hover:underline"
                    >
                      {formatOrderNumber(o.number)}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatKitchenDate(o.deliveryDate)} · {minutesToHHmm(o.deliveryTimeMinutes)}
                    {o.locked && (o.status === 'DRAFT' || o.status === 'PLACED') && (
                      <Lock
                        className="ml-1 inline size-3 text-amber-600"
                        aria-label="Cut-off passed, awaiting processing"
                      />
                    )}
                  </TableCell>
                  <TableCell>{o.employee.name}</TableCell>
                  <TableCell>{o.company.name}</TableCell>
                  <TableCell className="space-x-1 whitespace-nowrap">
                    <Badge variant={STATUS_VARIANT[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                    {o.stage && o.stage !== 'DELIVERED' && (
                      <Badge variant="outline">{STAGE_LABEL[o.stage]}</Badge>
                    )}
                    {o.invoiced && <Badge variant="outline">Invoiced</Badge>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{o.itemCount}</TableCell>
                  {canSeeMoney && (
                    <TableCell className="text-right tabular-nums">
                      {formatUsd(o.totalCents)}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {orders.data?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No orders match.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {orders.data && (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">{orders.data.total} orders</span>
              {orders.data.totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    Page {orders.data.page} of {orders.data.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => set({ page: String(page - 1) }, false)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= orders.data.totalPages}
                    onClick={() => set({ page: String(page + 1) }, false)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
