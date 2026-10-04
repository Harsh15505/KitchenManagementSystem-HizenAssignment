'use client';

import { type CompanyListItem, type Paginated } from '@fernleaf/shared';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Power } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { RequireAbility } from '@/components/require-ability';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { describeDays } from '@/components/weekday-picker';
import { ApiError, api } from '@/lib/api-client';
import { useAbility } from '@/lib/auth';

export default function CompaniesPage() {
  return (
    <RequireAbility action="read" subject="Company">
      <CompanyList />
    </RequireAbility>
  );
}

function CompanyList() {
  const canManage = useAbility().can('manage', 'Company');
  const [q, setQ] = useState('');
  const [active, setActive] = useState('true');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  /** Companies are never deleted (orders and invoices belong to them): switched off and on. */
  async function toggleActive(c: CompanyListItem) {
    setBusyId(c.id);
    try {
      await api(`/companies/${c.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !c.isActive }),
      });
      toast.success(c.isActive ? `${c.name} deactivated` : `${c.name} reactivated`);
      void queryClient.invalidateQueries({ queryKey: ['companies'] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'That did not save');
    } finally {
      setBusyId(null);
    }
  }
  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (q) params.set('q', q);
  if (active) params.set('active', active);
  const companies = useQuery({
    queryKey: ['companies', params.toString()],
    queryFn: () => api<Paginated<CompanyListItem>>(`/companies?${params}`),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Companies</h1>
          <p className="text-sm text-muted-foreground">
            Client companies, their domains, calendars and delivery defaults.
          </p>
        </div>
        {canManage && (
          <Link href="/companies/new" className={buttonVariants()}>
            <Plus className="size-4" aria-hidden /> New company
          </Link>
        )}
      </div>
      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              className="max-w-xs"
              placeholder="Search name or domain"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
            <NativeSelect
              aria-label="Status"
              value={active}
              onChange={(e) => setActive(e.target.value)}
            >
              <NativeSelectOption value="true">Active</NativeSelectOption>
              <NativeSelectOption value="false">Inactive</NativeSelectOption>
              <NativeSelectOption value="">All</NativeSelectOption>
            </NativeSelect>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Domains</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Delivers</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="text-right">Employees</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.data?.items.map((c) => (
                <TableRow key={c.id} className={c.isActive ? undefined : 'opacity-60'}>
                  <TableCell>
                    <Link href={`/companies/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                    {!c.isActive && <span className="ml-2 text-xs">inactive</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.domains.map((d) => `@${d}`).join(', ')}
                  </TableCell>
                  <TableCell>
                    {c.priceTier ? c.priceTier.name : <Badge variant="outline">Default</Badge>}
                  </TableCell>
                  <TableCell>{describeDays(c.workingDays)}</TableCell>
                  <TableCell>{c.owner?.name ?? '-'}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.employeeCount}</TableCell>
                  {canManage && (
                    <TableCell className="text-right whitespace-nowrap">
                      <Link
                        href={`/companies/${c.id}`}
                        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                        aria-label={`Edit ${c.name}`}
                      >
                        <Pencil className="size-3.5" aria-hidden /> Edit
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busyId === c.id}
                        aria-label={`${c.isActive ? 'Deactivate' : 'Reactivate'} ${c.name}`}
                        onClick={() => void toggleActive(c)}
                      >
                        <Power className="size-3.5" aria-hidden />{' '}
                        {c.isActive ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {companies.data?.items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={canManage ? 7 : 6}
                    className="text-center text-muted-foreground"
                  >
                    No companies match.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {companies.data && companies.data.totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 text-sm">
              <span className="text-muted-foreground">
                Page {companies.data.page} of {companies.data.totalPages}
              </span>
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
                disabled={page >= companies.data.totalPages}
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
