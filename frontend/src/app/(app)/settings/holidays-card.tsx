'use client';

import type { KitchenHolidayDto } from '@fernleaf/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ApiError, api } from '@/lib/api-client';
import { useAbility } from '@/lib/auth';

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));

export function HolidaysCard() {
  const canEdit = useAbility().can('update', 'Settings');
  const queryClient = useQueryClient();
  const holidays = useQuery({
    queryKey: ['kitchen-holidays'],
    queryFn: () => api<KitchenHolidayDto[]>('/settings/kitchen-holidays'),
  });
  const [date, setDate] = useState('');
  const [name, setName] = useState('');

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['kitchen-holidays'] });
  const onError = (error: unknown) =>
    toast.error(
      error instanceof ApiError
        ? (Object.values(error.fieldErrors ?? {})[0]?.[0] ?? error.message)
        : 'Something went wrong',
    );

  const add = useMutation({
    mutationFn: () =>
      api<KitchenHolidayDto>('/settings/kitchen-holidays', {
        method: 'POST',
        body: JSON.stringify({ date, name }),
      }),
    onSuccess: () => {
      setDate('');
      setName('');
      toast.success('Holiday added');
      void refresh();
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api<void>(`/settings/kitchen-holidays/${id}`, { method: 'DELETE' }),
    onSuccess: () => void refresh(),
    onError,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kitchen holidays</CardTitle>
        <CardDescription>
          No deliveries on these dates, and they are skipped when counting cut-off days.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y text-sm">
          {holidays.data?.map((h) => (
            <li key={h.id} className="flex items-center justify-between py-2">
              <span>
                <span className="font-medium">{formatDate(h.date)}</span>
                <span className="text-muted-foreground"> · {h.name}</span>
              </span>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove ${h.name}`}
                  onClick={() => remove.mutate(h.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </li>
          ))}
          {holidays.data?.length === 0 && (
            <li className="py-2 text-muted-foreground">No kitchen holidays set.</li>
          )}
        </ul>
        {canEdit && (
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate();
            }}
          >
            <Input
              type="date"
              className="w-40"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <Input
              className="min-w-40 flex-1"
              placeholder="Name, e.g. Diwali"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Button type="submit" disabled={add.isPending}>
              Add
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
