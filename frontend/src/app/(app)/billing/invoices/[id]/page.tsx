'use client';

import { formatInvoiceNumber, formatUsd, type InvoiceDetail } from '@fernleaf/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { RequireAbility } from '@/components/require-ability';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiError, api } from '@/lib/api-client';
import { useAbility } from '@/lib/auth';
import { formatIst, formatKitchenDate } from '@/lib/orders';

export default function InvoicePage() {
  return (
    <RequireAbility action="read" subject="Invoice">
      <InvoiceView />
    </RequireAbility>
  );
}

function InvoiceView() {
  const { id } = useParams<{ id: string }>();
  const canManage = useAbility().can('manage', 'Invoice');
  const queryClient = useQueryClient();
  const invoice = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api<InvoiceDetail>(`/invoices/${id}`),
  });
  const inv = invoice.data;

  async function markPaid() {
    try {
      await api(`/invoices/${id}/paid`, { method: 'POST' });
      toast.success('Marked paid');
      void queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      void queryClient.invalidateQueries({ queryKey: ['billing-summary'] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not mark it paid');
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <Link
        href="/billing/invoices"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline print:hidden"
      >
        <ArrowLeft className="size-4" aria-hidden /> Invoices
      </Link>
      {!inv && <Skeleton className="h-96" />}
      {inv && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2 page-title">
                <span className="font-mono">{formatInvoiceNumber(inv.number)}</span>
                <Badge variant={inv.status === 'PAID' ? 'secondary' : 'outline'}>
                  {inv.status === 'PAID' ? 'Paid' : 'Issued'}
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground">
                Fernleaf Kitchen → {inv.company.name} · issued {formatIst(inv.issuedAt, true)}
                {inv.paidAt ? ` · paid ${formatIst(inv.paidAt, true)}` : ''}
              </p>
            </div>
            <div className="flex gap-2 print:hidden">
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="size-4" aria-hidden /> Print
              </Button>
              {canManage && inv.status === 'ISSUED' && (
                <Button onClick={() => void markPaid()}>Mark paid</Button>
              )}
            </div>
          </div>
          <Card>
            <CardContent className="grid gap-4 pt-6 text-sm sm:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground">Bill to</div>
                <div className="font-medium">{inv.billing.name}</div>
                <div>{inv.billing.email}</div>
                {inv.billing.phone && <div>{inv.billing.phone}</div>}
                {inv.billing.address && (
                  <div className="text-muted-foreground">{inv.billing.address}</div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Period</div>
                <div>
                  {formatKitchenDate(inv.periodStart)} – {formatKitchenDate(inv.periodEnd)}
                </div>
                {inv.notes && <div className="mt-2 text-muted-foreground">{inv.notes}</div>}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inv.lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        {l.orderId ? (
                          <Link
                            href={`/orders/${l.orderId}`}
                            className="hover:underline print:no-underline"
                          >
                            {l.description}
                          </Link>
                        ) : (
                          l.description
                        )}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${l.amountCents < 0 ? 'text-green-700' : ''}`}
                      >
                        {formatUsd(l.amountCents)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold">
                      Total ({inv.lines.length} lines)
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatUsd(inv.totalCents)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
