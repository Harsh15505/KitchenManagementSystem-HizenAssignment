'use client';

import { type CompanyListItem, type Paginated } from '@fernleaf/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
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
import { api } from '@/lib/api-client';
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
          <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
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
                </TableRow>
              ))}
              {companies.data?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
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
