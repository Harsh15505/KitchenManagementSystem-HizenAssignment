'use client';

import {
  REFERENCE_LABELS,
  REFERENCE_TYPES,
  type ReferenceItem,
  type ReferenceType,
} from '@fernleaf/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { RequireAbility } from '@/components/require-ability';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { cn } from '@/lib/utils';

/** FR-SET-03: admin-managed lists. Entries are deactivated, never deleted (orders reference them). */
export default function ReferencePage() {
  const [type, setType] = useState<ReferenceType>('allergens');
  return (
    <RequireAbility action="read" subject="ReferenceData">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reference data</h1>
          <p className="text-sm text-muted-foreground">
            Lists used by dishes, options and companies. Deactivate entries you no longer use; they
            stay on past orders.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist">
          {REFERENCE_TYPES.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={t === type}
              onClick={() => setType(t)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm',
                t === type ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
              )}
            >
              {REFERENCE_LABELS[t].plural}
            </button>
          ))}
        </div>
        <ReferenceList key={type} type={type} />
      </div>
    </RequireAbility>
  );
}

function ReferenceList({ type }: { type: ReferenceType }) {
  const ability = useAbility();
  const canEdit = ability.can('update', 'ReferenceData');
  const queryClient = useQueryClient();
  const key = ['reference', type];
  const items = useQuery({
    queryKey: key,
    queryFn: () => api<ReferenceItem[]>(`/reference/${type}`),
  });
  const [name, setName] = useState('');
  const label = REFERENCE_LABELS[type];

  const onError = (error: unknown) =>
    toast.error(
      error instanceof ApiError
        ? (error.fieldErrors?.name?.[0] ?? error.message)
        : 'Something went wrong',
    );
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  const add = useMutation({
    mutationFn: () =>
      api<ReferenceItem>(`/reference/${type}`, { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: (item) => {
      setName('');
      toast.success(`${item.name} added`);
      void refresh();
    },
    onError,
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<ReferenceItem> }) =>
      api<ReferenceItem>(`/reference/${type}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => void refresh(),
    onError,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{label.plural}</CardTitle>
        {!canEdit && <CardDescription>Read-only for your role.</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              {type === 'packaging-types' && <TableHead>Description</TableHead>}
              <TableHead>Status</TableHead>
              {canEdit && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.data?.map((item) => (
              <TableRow key={item.id} className={item.isActive ? undefined : 'opacity-60'}>
                <TableCell className="font-medium">
                  {canEdit ? (
                    <Input
                      defaultValue={item.name}
                      aria-label={`Name of ${item.name}`}
                      className="max-w-xs"
                      onBlur={(e) => {
                        const next = e.target.value.trim();
                        if (next && next !== item.name)
                          update.mutate({ id: item.id, body: { name: next } });
                      }}
                    />
                  ) : (
                    item.name
                  )}
                </TableCell>
                {type === 'packaging-types' && (
                  <TableCell className="text-muted-foreground">{item.description}</TableCell>
                )}
                <TableCell>
                  <Badge variant={item.isActive ? 'secondary' : 'outline'}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                {canEdit && (
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        update.mutate({ id: item.id, body: { isActive: !item.isActive } })
                      }
                    >
                      {item.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {canEdit && (
          <form
            className="flex max-w-md gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate();
            }}
          >
            <Input
              placeholder={`New ${label.singular.toLowerCase()}`}
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
