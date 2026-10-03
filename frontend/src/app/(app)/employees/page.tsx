'use client';

import type { EmployeeDto, Paginated } from '@fernleaf/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { RequireAbility } from '@/components/require-ability';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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

export default function EmployeesPage() {
  return (
    <RequireAbility action="read" subject="Employee">
      <EmployeeSearch />
    </RequireAbility>
  );
}

/** Global employee search across companies; editing happens on the company page. */
function EmployeeSearch() {
  const canReadCompanies = useAbility().can('read', 'Company');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (q) params.set('q', q);
  const employees = useQuery({
    queryKey: ['employees', 'all', params.toString()],
    queryFn: () => api<Paginated<EmployeeDto>>(`/employees?${params}`),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
        <p className="text-sm text-muted-foreground">
          Everyone who can order, across all companies. Open the company to edit or move someone.
        </p>
      </div>
      <Card>
        <CardContent className="space-y-4">
          <Input
            className="max-w-xs"
            placeholder="Search name or email"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.data?.items.map((e) => (
                <TableRow key={e.id} className={e.isActive ? undefined : 'opacity-60'}>
                  <TableCell className="font-medium">
                    {e.name} {e.isOwner && <Badge className="ml-1">Owner</Badge>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.email}</TableCell>
                  <TableCell>
                    {canReadCompanies ? (
                      <Link href={`/companies/${e.company.id}`} className="hover:underline">
                        {e.company.name}
                      </Link>
                    ) : (
                      e.company.name
                    )}
                  </TableCell>
                  <TableCell>{e.isActive ? 'Active' : 'Inactive'}</TableCell>
                </TableRow>
              ))}
              {employees.data?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No employees match.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {employees.data && employees.data.totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 text-sm">
              <span className="text-muted-foreground">
                Page {employees.data.page} of {employees.data.totalPages}
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
                disabled={page >= employees.data.totalPages}
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
