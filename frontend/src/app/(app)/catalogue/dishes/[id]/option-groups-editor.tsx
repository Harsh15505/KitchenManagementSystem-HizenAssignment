'use client';

import {
  type DishDetail,
  type OptionDto,
  type OptionGroupDto,
  type OptionGroupInput,
  optionGroupInputSchema,
  type Paginated,
} from '@fernleaf/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Pencil, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ChipSelect } from '@/components/chip-select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { ApiError, api } from '@/lib/api-client';
import { useAbility } from '@/lib/auth';
import { useReferenceList } from '@/lib/reference';

/** FR-CAT-04/05: the questions a dish asks ("Choose your protein") and what each offers. */
export function OptionGroupsEditor({ dish }: { dish: DishDetail }) {
  const canManage = useAbility().can('manage', 'Catalogue');
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<OptionGroupDto | 'new' | null>(null);

  const refresh = (updated?: DishDetail) => {
    if (updated) queryClient.setQueryData(['dish', dish.id], updated);
    else void queryClient.invalidateQueries({ queryKey: ['dish', dish.id] });
  };
  const fail = (error: unknown) =>
    toast.error(error instanceof ApiError ? error.message : 'Something went wrong');

  async function move(index: number, delta: number) {
    const ids = dish.groups.map((g) => g.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    try {
      refresh(
        await api<DishDetail>(`/dishes/${dish.id}/option-groups/order`, {
          method: 'PUT',
          body: JSON.stringify({ ids }),
        }),
      );
    } catch (error) {
      fail(error);
    }
  }

  async function remove(group: OptionGroupDto) {
    try {
      await api<void>(`/option-groups/${group.id}`, { method: 'DELETE' });
      toast.success(`Removed "${group.name}". Past orders keep its name.`);
      refresh();
    } catch (error) {
      fail(error);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Option groups</CardTitle>
          <CardDescription>
            Each order line is split into combinations; every combination must answer every required
            group.
          </CardDescription>
        </div>
        {canManage && editing === null && (
          <Button size="sm" onClick={() => setEditing('new')}>
            Add group
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {editing === 'new' && (
          <GroupForm
            dishId={dish.id}
            onDone={(updated) => {
              setEditing(null);
              refresh(updated);
            }}
            onCancel={() => setEditing(null)}
          />
        )}
        {dish.groups.map((group, index) =>
          editing !== 'new' && editing?.id === group.id ? (
            <GroupForm
              key={group.id}
              dishId={dish.id}
              group={group}
              onDone={() => {
                setEditing(null);
                refresh();
              }}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <div
              key={group.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{group.name}</span>
                  <Badge variant={group.isRequired ? 'default' : 'secondary'}>
                    {group.isRequired ? 'Required' : 'Optional'}
                  </Badge>
                  <Badge variant="outline">
                    {group.maxSelections === 1 ? 'Pick one' : `Up to ${group.maxSelections}`}
                  </Badge>
                  {group.usesPortions && (
                    <Badge variant="outline">
                      Sizes: {group.portionSizes.map((p) => p.name).join(', ')}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {group.options
                    .map((o) => (o.isActive ? o.name : `${o.name} (inactive)`))
                    .join(' · ')}
                </p>
              </div>
              {canManage && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Move up"
                    disabled={index === 0}
                    onClick={() => void move(index, -1)}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Move down"
                    disabled={index === dish.groups.length - 1}
                    onClick={() => void move(index, 1)}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Edit ${group.name}`}
                    onClick={() => setEditing(group)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${group.name}`}
                    onClick={() => void remove(group)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          ),
        )}
        {dish.groups.length === 0 && editing !== 'new' && (
          <p className="text-sm text-muted-foreground">
            No option groups: the dish is ordered as is.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function GroupForm({
  dishId,
  group,
  onDone,
  onCancel,
}: {
  dishId: string;
  group?: OptionGroupDto;
  onDone: (updated?: DishDetail) => void;
  onCancel: () => void;
}) {
  const sizes = useReferenceList('portion-sizes');
  const options = useQuery({
    queryKey: ['options', 'all-active'],
    queryFn: () => api<Paginated<OptionDto>>('/options?pageSize=100&active=true'),
  });
  const [form, setForm] = useState<OptionGroupInput>({
    name: group?.name ?? '',
    isRequired: group?.isRequired ?? true,
    maxSelections: group?.maxSelections ?? 1,
    usesPortions: group?.usesPortions ?? false,
    portionSizeIds: group?.portionSizes.map((p) => p.id) ?? [],
    optionIds: group?.options.map((o) => o.id) ?? [],
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const optionName = new Map((options.data?.items ?? []).map((o) => [o.id, o.name]));
  for (const o of group?.options ?? []) if (!optionName.has(o.id)) optionName.set(o.id, o.name);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = optionGroupInputSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the group');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (group) {
        await api(`/option-groups/${group.id}`, {
          method: 'PUT',
          body: JSON.stringify(parsed.data),
        });
        onDone();
      } else {
        onDone(
          await api<DishDetail>(`/dishes/${dishId}/option-groups`, {
            method: 'POST',
            body: JSON.stringify(parsed.data),
          }),
        );
      }
      toast.success('Option group saved');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the group');
    } finally {
      setSaving(false);
    }
  }

  const available = (options.data?.items ?? []).filter((o) => !form.optionIds.includes(o.id));

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border bg-muted/30 p-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="group-name">Question</Label>
          <Input
            id="group-name"
            placeholder="Choose your protein"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="group-max">Max selections</Label>
          <Input
            id="group-max"
            type="number"
            min={1}
            max={10}
            value={form.maxSelections}
            onChange={(e) => setForm({ ...form, maxSelections: Number(e.target.value) })}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="size-4"
            checked={form.isRequired}
            onChange={(e) => setForm({ ...form, isRequired: e.target.checked })}
          />
          Required
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="size-4"
            checked={form.usesPortions}
            onChange={(e) => setForm({ ...form, usesPortions: e.target.checked })}
          />
          Sold in sizes
        </label>
      </div>
      {form.usesPortions && (
        <div className="space-y-2">
          <Label>Sizes this group sells (every option must have a price for each)</Label>
          <ChipSelect
            label="Sizes"
            items={sizes.data}
            value={form.portionSizeIds}
            onChange={(v) => setForm({ ...form, portionSizeIds: v })}
          />
        </div>
      )}
      <div className="space-y-2">
        <Label>Options offered, in order</Label>
        <ol className="space-y-1">
          {form.optionIds.map((id, index) => (
            <li
              key={id}
              className="flex items-center justify-between rounded-md border bg-background px-3 py-1.5 text-sm"
            >
              <span>
                {index + 1}. {optionName.get(id) ?? 'Unknown option'}
              </span>
              <span className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Move up"
                  disabled={index === 0}
                  onClick={() => {
                    const next = [...form.optionIds];
                    [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
                    setForm({ ...form, optionIds: next });
                  }}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Remove"
                  onClick={() =>
                    setForm({ ...form, optionIds: form.optionIds.filter((x) => x !== id) })
                  }
                >
                  <X className="size-4" />
                </Button>
              </span>
            </li>
          ))}
        </ol>
        <NativeSelect
          aria-label="Add an option"
          value=""
          onChange={(e) =>
            e.target.value && setForm({ ...form, optionIds: [...form.optionIds, e.target.value] })
          }
        >
          <NativeSelectOption value="">+ Add an option…</NativeSelectOption>
          {available.map((o) => (
            <NativeSelectOption key={o.id} value={o.id}>
              {o.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save group'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
