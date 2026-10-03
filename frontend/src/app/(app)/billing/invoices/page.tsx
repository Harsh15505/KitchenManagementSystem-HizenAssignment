'use client';

import {
  formatInvoiceNumber,
  formatUsd,
  type InvoiceListItem,
  type Paginated,
} from '@fernleaf/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { RequireAbility } from '@/components/require-ability';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api-client';
import { formatIst, formatKitchenDate } from '@/lib/orders';

export default function InvoicesPage() {
  return (
    <RequireAbility action="read" subject="Invoice">
      <InvoiceList />
    </RequireAbility>
  );
}

function InvoiceList() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (status) params.set('status', status);
  const invoices = useQuery({
    queryKey: ['invoices', params.toString()],
    queryFn: () => api<Paginated<InvoiceListItem>>(`/invoices?${params}`),
    placeholderData: keepPreviousData,
  });
  return (
    <div className="space-y-6">
      <Link
        href="/billing"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden /> Billing
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
        <NativeSelect
          aria-label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <NativeSelectOption value="">All</NativeSelectOption>
          <NativeSelectOption value="ISSUED">Issued (unpaid)</NativeSelectOption>
          <NativeSelectOption value="PAID">Paid</NativeSelectOption>
        </NativeSelect>
      </div>
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.data?.items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>
                    <Link
                      href={`/billing/invoices/${i.id}`}
                      className="font-mono font-medium hover:underline"
                    >
                      {formatInvoiceNumber(i.number)}
                    </Link>
                  </TableCell>
                  <TableCell>{i.company.name}</TableCell>
                  <TableCell>
                    {formatKitchenDate(i.periodStart)} – {formatKitchenDate(i.periodEnd)}
                  </TableCell>
                  <TableCell>{formatIst(i.issuedAt, true)}</TableCell>
                  <TableCell>
                    <Badge variant={i.status === 'PAID' ? 'secondary' : 'outline'}>
                      {i.status === 'PAID' ? 'Paid' : 'Issued'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatUsd(i.totalCents)}
                  </TableCell>
                </TableRow>
              ))}
              {invoices.data?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No invoices.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {invoices.data && invoices.data.totalPages > 1 && (
            <div className="flex justify-end gap-2 pt-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= invoices.data.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
