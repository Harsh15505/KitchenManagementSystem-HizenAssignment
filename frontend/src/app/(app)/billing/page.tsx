'use client';

import { type BillingSummaryRow, formatInvoiceNumber, formatUsd } from '@fernleaf/shared';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { RequireAbility } from '@/components/require-ability';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { formatIst } from '@/lib/orders';

export default function BillingPage() {
  return (
    <RequireAbility action="read" subject="Invoice">
      <BillingSummary />
    </RequireAbility>
  );
}

/** FR-BIL-02: what each company owes and hasn't been invoiced for yet. */
function BillingSummary() {
  const canManage = useAbility().can('manage', 'Invoice');
  const summary = useQuery({
    queryKey: ['billing-summary'],
    queryFn: () => api<BillingSummaryRow[]>('/billing/summary'),
  });
  const rows = summary.data ?? [];
  const totals = rows.reduce(
    (t, r) => ({
      uninvoiced: t.uninvoiced + r.uninvoicedOrdersCents + r.uninvoicedAdjustmentsCents,
      outstanding: t.outstanding + r.outstandingCents,
    }),
    { uninvoiced: 0, outstanding: 0 },
  );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Billing</h1>
          <p className="text-sm text-muted-foreground">
            Confirmed and delivered orders are owed in full. Invoices never change; later money
            changes become credits on the next invoice.
          </p>
        </div>
        <Link href="/billing/invoices" className={buttonVariants({ variant: 'outline' })}>
          All invoices
        </Link>
      </div>
      {summary.data && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Not yet invoiced</div>
              <div className="text-2xl font-semibold tabular-nums">
                {formatUsd(totals.uninvoiced)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Invoiced, awaiting payment</div>
              <div className="text-2xl font-semibold tabular-nums">
                {formatUsd(totals.outstanding)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      <Card>
        <CardContent>
          {!summary.data && <Skeleton className="h-48" />}
          {summary.data && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead className="text-right">Uninvoiced orders</TableHead>
                  <TableHead className="text-right">Credits to bill</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Last invoice</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.company.id}>
                    <TableCell className="font-medium">{r.company.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.uninvoicedOrders} · {formatUsd(r.uninvoicedOrdersCents)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.uninvoicedAdjustments > 0
                        ? `${r.uninvoicedAdjustments} · ${formatUsd(r.uninvoicedAdjustmentsCents)}`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatUsd(r.outstandingCents)}
                    </TableCell>
                    <TableCell>
                      {r.lastInvoice ? (
                        <Link
                          href={`/billing/invoices/${r.lastInvoice.id}`}
                          className="hover:underline"
                        >
                          {formatInvoiceNumber(r.lastInvoice.number)} ·{' '}
                          {formatIst(r.lastInvoice.issuedAt, true).split(',').slice(0, 2).join(',')}{' '}
                          <Badge
                            variant={r.lastInvoice.status === 'PAID' ? 'secondary' : 'outline'}
                          >
                            {r.lastInvoice.status === 'PAID' ? 'Paid' : 'Issued'}
                          </Badge>
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">None yet</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage && r.uninvoicedOrders + r.uninvoicedAdjustments > 0 && (
                        <Link
                          href={`/billing/companies/${r.company.id}`}
                          className={buttonVariants({ size: 'sm' })}
                        >
                          Create invoice
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
