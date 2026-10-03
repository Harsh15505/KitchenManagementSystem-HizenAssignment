'use client';

import { type DishListItem, formatUsd, type Paginated } from '@fernleaf/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { RequireAbility } from '@/components/require-ability';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Button } from '@/components/ui/button';
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
import { api } from '@/lib/api-client';
import { useAbility } from '@/lib/auth';
import { useReferenceList } from '@/lib/reference';

const PAGE_SIZE = 20;

export default function DishesPage() {
  return (
    <RequireAbility action="read" subject="Catalogue">
      <DishList />
    </RequireAbility>
  );
}

function DishList() {
  const ability = useAbility();
  const canManage = ability.can('manage', 'Catalogue');
  // Costs are redacted by the API for roles without money access (BUG-004).
  const canSeeMoney = ability.can('read', 'Money');
  const stations = useReferenceList('kitchen-stations');
  const [q, setQ] = useState('');
  const [active, setActive] = useState('true');
  const [stationId, setStationId] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (q) params.set('q', q);
  if (active) params.set('active', active);
  if (stationId) params.set('stationId', stationId);

  const dishes = useQuery({
    queryKey: ['dishes', params.toString()],
    queryFn: () => api<Paginated<DishListItem>>(`/dishes?${params}`),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dishes</h1>
          <p className="text-sm text-muted-foreground">
            Dishes are deactivated, never deleted, so past orders keep showing them.
          </p>
        </div>
        {canManage && (
          <Link href="/catalogue/dishes/new" className={buttonVariants()}>
            <Plus className="size-4" aria-hidden /> New dish
          </Link>
        )}
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              className="max-w-xs"
              placeholder="Search name or SKU"
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
            <NativeSelect
              aria-label="Station"
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
            >
              <NativeSelectOption value="">All stations</NativeSelectOption>
              {stations.data?.map((s) => (
                <NativeSelectOption key={s.id} value={s.id}>
                  {s.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Dish</TableHead>
                <TableHead>Station</TableHead>
                <TableHead>Temp</TableHead>
                {canSeeMoney && <TableHead className="text-right">Cost</TableHead>}
                <TableHead>Setup</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dishes.data?.items.map((dish) => (
                <TableRow key={dish.id} className={dish.isActive ? undefined : 'opacity-60'}>
                  <TableCell className="font-mono text-xs">{dish.sku}</TableCell>
                  <TableCell>
                    <Link
                      href={`/catalogue/dishes/${dish.id}`}
                      className="font-medium hover:underline"
                    >
                      {dish.name}
                    </Link>
                    {!dish.isActive && (
                      <span className="ml-2 text-xs text-muted-foreground">inactive</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {dish.station?.name ?? (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>{dish.temperature === 'HOT' ? 'Hot' : 'Cold'}</TableCell>
                  {canSeeMoney && (
                    <TableCell className="text-right tabular-nums">
                      {formatUsd(dish.costPriceCents)}
                    </TableCell>
                  )}
                  <TableCell className="space-x-1">
                    {/* FR-CAT-06: flag incomplete setup */}
                    {!dish.station && <Badge variant="outline">No station</Badge>}
                    {dish.menuPlacements === 0 && <Badge variant="outline">Not on menu</Badge>}
                  </TableCell>
                </TableRow>
              ))}
              {dishes.data?.items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={canSeeMoney ? 6 : 5}
                    className="text-center text-muted-foreground"
                  >
                    No dishes match.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {dishes.data && dishes.data.totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 text-sm">
              <span className="text-muted-foreground">
                Page {dishes.data.page} of {dishes.data.totalPages}
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
                disabled={page >= dishes.data.totalPages}
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
