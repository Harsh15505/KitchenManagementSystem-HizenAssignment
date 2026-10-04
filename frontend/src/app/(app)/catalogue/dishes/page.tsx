'use client';

import { type DishListItem, formatUsd, type Paginated } from '@fernleaf/shared';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Power } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { DishImage } from '@/components/dish-image';
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
import { ApiError, api } from '@/lib/api-client';
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
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
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

  /** Dishes are never deleted (past orders keep showing them): they are switched off and on. */
  async function toggleActive(dish: DishListItem) {
    setBusyId(dish.id);
    try {
      await api(`/dishes/${dish.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !dish.isActive }),
      });
      toast.success(dish.isActive ? `${dish.name} deactivated` : `${dish.name} reactivated`);
      void queryClient.invalidateQueries({ queryKey: ['dishes'] });
      void queryClient.invalidateQueries({ queryKey: ['dish', dish.id] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'That did not save');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Dishes</h1>
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
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {dishes.data?.items.map((dish) => (
                <TableRow key={dish.id} className={dish.isActive ? undefined : 'opacity-60'}>
                  <TableCell className="font-mono text-xs">{dish.sku}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <DishImage
                        src={dish.imageUrl}
                        alt=""
                        className="size-10 shrink-0 rounded-md"
                      />
                      <div>
                        <Link
                          href={`/catalogue/dishes/${dish.id}`}
                          className="font-medium hover:underline"
                        >
                          {dish.name}
                        </Link>
                        {!dish.isActive && (
                          <span className="ml-2 text-xs text-muted-foreground">inactive</span>
                        )}
                      </div>
                    </div>
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
                  {canManage && (
                    <TableCell className="text-right whitespace-nowrap">
                      <Link
                        href={`/catalogue/dishes/${dish.id}`}
                        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                        aria-label={`Edit ${dish.name}`}
                      >
                        <Pencil className="size-3.5" aria-hidden /> Edit
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busyId === dish.id}
                        aria-label={`${dish.isActive ? 'Deactivate' : 'Reactivate'} ${dish.name}`}
                        onClick={() => void toggleActive(dish)}
                      >
                        <Power className="size-3.5" aria-hidden />{' '}
                        {dish.isActive ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {dishes.data?.items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={(canSeeMoney ? 6 : 5) + (canManage ? 1 : 0)}
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
