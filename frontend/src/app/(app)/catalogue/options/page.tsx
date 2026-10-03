'use client';

import { formatUsd, type OptionDto, optionInputSchema, type Paginated } from '@fernleaf/shared';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ChipSelect } from '@/components/chip-select';
import { MoneyInput } from '@/components/money-input';
import { RequireAbility } from '@/components/require-ability';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { nameLookup, useReferenceList } from '@/lib/reference';

const PAGE_SIZE = 25;

export default function OptionsPage() {
  return (
    <RequireAbility action="read" subject="Catalogue">
      <OptionList />
    </RequireAbility>
  );
}

function OptionList() {
  const ability = useAbility();
  const canManage = ability.can('manage', 'Catalogue');
  // Costs and size extras are redacted by the API for roles without money access (BUG-004).
  const canSeeMoney = ability.can('read', 'Money');
  const sizes = useReferenceList('portion-sizes');
  const sizeName = nameLookup(sizes.data);
  const [q, setQ] = useState('');
  const [active, setActive] = useState('true');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<OptionDto | 'new' | null>(null);

  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (q) params.set('q', q);
  if (active) params.set('active', active);
  const options = useQuery({
    queryKey: ['options', params.toString()],
    queryFn: () => api<Paginated<OptionDto>>(`/options?${params}`),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Options</h1>
          <p className="text-sm text-muted-foreground">
            Reusable choices (proteins, sides, sauces). One option can appear in many dishes&apos;
            groups.
          </p>
        </div>
        {canManage && editing === null && (
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" aria-hidden /> New option
          </Button>
        )}
      </div>

      {editing !== null && (
        <OptionForm
          key={editing === 'new' ? 'new' : editing.id}
          option={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              className="max-w-xs"
              placeholder="Search options"
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
                <TableHead>Option</TableHead>
                {canSeeMoney && <TableHead className="text-right">Cost</TableHead>}
                <TableHead>Sizes</TableHead>
                <TableHead>Used in</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {options.data?.items.map((option) => (
                <TableRow key={option.id} className={option.isActive ? undefined : 'opacity-60'}>
                  <TableCell>
                    <span className="font-medium">{option.name}</span>
                    {!option.isActive && (
                      <span className="ml-2 text-xs text-muted-foreground">inactive</span>
                    )}
                  </TableCell>
                  {canSeeMoney && (
                    <TableCell className="text-right tabular-nums">
                      {formatUsd(option.costPriceCents)}
                    </TableCell>
                  )}
                  <TableCell className="space-x-1">
                    {option.portionExtras.map((p) => (
                      <Badge key={p.portionSizeId} variant="outline">
                        {sizeName.get(p.portionSizeId) ?? 'Size'}
                        {canSeeMoney && ` +${formatUsd(p.extraChargeCents)}`}
                      </Badge>
                    ))}
                  </TableCell>
                  <TableCell>
                    {option.usedInGroups === 0 ? (
                      <Badge variant="outline">Unused</Badge>
                    ) : (
                      `${option.usedInGroups} group${option.usedInGroups === 1 ? '' : 's'}`
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {canManage && (
                      <Button variant="ghost" size="sm" onClick={() => setEditing(option)}>
                        Edit
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {options.data?.items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={canSeeMoney ? 5 : 4}
                    className="text-center text-muted-foreground"
                  >
                    No options match.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {options.data && options.data.totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 text-sm">
              <span className="text-muted-foreground">
                Page {options.data.page} of {options.data.totalPages}
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
                disabled={page >= options.data.totalPages}
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

/** FR-CAT-03/05: an option's cost, tags and the extra it charges per size. */
function OptionForm({ option, onClose }: { option?: OptionDto; onClose: () => void }) {
  const queryClient = useQueryClient();
  const allergens = useReferenceList('allergens');
  const tags = useReferenceList('dietary-tags');
  const sizes = useReferenceList('portion-sizes');
  const [name, setName] = useState(option?.name ?? '');
  const [description, setDescription] = useState(option?.description ?? '');
  const [costCents, setCostCents] = useState<number | null>(option?.costPriceCents ?? null);
  const [allergenIds, setAllergenIds] = useState(option?.allergenIds ?? []);
  const [dietaryTagIds, setDietaryTagIds] = useState(option?.dietaryTagIds ?? []);
  const [extras, setExtras] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(
      (option?.portionExtras ?? []).map((p) => [p.portionSizeId, p.extraChargeCents]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function send(body: Record<string, unknown>, ok: string) {
    setSaving(true);
    setError(null);
    try {
      await api(option ? `/options/${option.id}` : '/options', {
        method: option ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
      toast.success(ok);
      void queryClient.invalidateQueries({ queryKey: ['options'] });
      void queryClient.invalidateQueries({ queryKey: ['dish'] });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the option');
    } finally {
      setSaving(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const sizeIds = Object.keys(extras);
    if (sizeIds.some((id) => extras[id] === null)) {
      setError('Enter an extra charge for every size you ticked (0.00 is fine)');
      return;
    }
    const parsed = optionInputSchema.safeParse({
      name,
      description,
      costPriceCents: costCents ?? -1,
      allergenIds,
      dietaryTagIds,
      portionExtras: sizeIds.map((portionSizeId) => ({
        portionSizeId,
        extraChargeCents: extras[portionSizeId],
      })),
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(
        issue?.path[0] === 'costPriceCents'
          ? 'Enter the cost, e.g. 0.75'
          : (issue?.message ?? 'Check the form'),
      );
      return;
    }
    void send(parsed.data, option ? 'Option saved' : 'Option created');
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>{option ? `Edit ${option.name}` : 'New option'}</CardTitle>
        {option && (
          <Button
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() =>
              void send(
                { isActive: !option.isActive },
                option.isActive ? 'Option deactivated' : 'Option reactivated',
              )
            }
          >
            {option.isActive ? 'Deactivate' : 'Reactivate'}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="opt-name">Name</Label>
              <Input id="opt-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="opt-cost">Cost price</Label>
              <MoneyInput id="opt-cost" valueCents={costCents} onChangeCents={setCostCents} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="opt-desc">Description</Label>
              <Input
                id="opt-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Allergens</Label>
            <ChipSelect
              label="Allergens"
              items={allergens.data}
              value={allergenIds}
              onChange={setAllergenIds}
            />
          </div>
          <div className="space-y-2">
            <Label>Dietary tags</Label>
            <ChipSelect
              label="Dietary tags"
              items={tags.data}
              value={dietaryTagIds}
              onChange={setDietaryTagIds}
            />
          </div>
          <div className="space-y-2">
            <Label>Size extras (charged on top of the dish price when this size is picked)</Label>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(sizes.data ?? [])
                .filter((s) => s.isActive || s.id in extras)
                .map((size) => {
                  const on = size.id in extras;
                  return (
                    <div key={size.id} className="flex items-center gap-2 rounded-md border p-2">
                      <label className="flex min-w-24 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={on}
                          onChange={(e) => {
                            const next = { ...extras };
                            if (e.target.checked) next[size.id] = 0;
                            else delete next[size.id];
                            setExtras(next);
                          }}
                        />
                        {size.name}
                      </label>
                      {on && (
                        <MoneyInput
                          valueCents={extras[size.id] ?? null}
                          onChangeCents={(c) => setExtras({ ...extras, [size.id]: c })}
                        />
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save option'}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
