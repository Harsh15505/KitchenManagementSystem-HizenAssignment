'use client';

import { type DishDetail, dishInputSchema, type FieldErrors } from '@fernleaf/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ChipSelect } from '@/components/chip-select';
import { MoneyInput } from '@/components/money-input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { ApiError, api } from '@/lib/api-client';
import { useAbility } from '@/lib/auth';
import { useReferenceList } from '@/lib/reference';

interface FormState {
  sku: string;
  name: string;
  description: string;
  imageUrl: string;
  temperature: 'HOT' | 'COLD';
  costPriceCents: number | null;
  kitchenStationId: string;
  minOrderQty: string;
  allergenIds: string[];
  dietaryTagIds: string[];
}

const fromDish = (d?: DishDetail): FormState => ({
  sku: d?.sku ?? '',
  name: d?.name ?? '',
  description: d?.description ?? '',
  imageUrl: d?.imageUrl ?? '',
  temperature: d?.temperature ?? 'HOT',
  costPriceCents: d?.costPriceCents ?? null,
  kitchenStationId: d?.station?.id ?? '',
  minOrderQty: d?.minOrderQty ? String(d.minOrderQty) : '',
  allergenIds: d?.allergenIds ?? [],
  dietaryTagIds: d?.dietaryTagIds ?? [],
});

/** FR-CAT-01: every field of a dish. Validated with the same schema the API uses. */
export function DishForm({ dish }: { dish?: DishDetail }) {
  const ability = useAbility();
  const canManage = ability.can('manage', 'Catalogue');
  const canSeeMoney = ability.can('read', 'Money');
  const router = useRouter();
  const queryClient = useQueryClient();
  const allergens = useReferenceList('allergens');
  const tags = useReferenceList('dietary-tags');
  const stations = useReferenceList('kitchen-stations');
  const [form, setForm] = useState<FormState>(() => fromDish(dish));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function save(body: Record<string, unknown>, okMessage: string) {
    setSaving(true);
    try {
      const saved = await api<DishDetail>(dish ? `/dishes/${dish.id}` : '/dishes', {
        method: dish ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
      toast.success(okMessage);
      void queryClient.invalidateQueries({ queryKey: ['dishes'] });
      queryClient.setQueryData(['dish', saved.id], saved);
      if (!dish) router.replace(`/catalogue/dishes/${saved.id}`);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors ?? {});
        toast.error(error.message);
      }
    } finally {
      setSaving(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const candidate = {
      sku: form.sku.trim() || undefined,
      name: form.name,
      description: form.description,
      imageUrl: form.imageUrl.trim() || null,
      temperature: form.temperature,
      costPriceCents: form.costPriceCents ?? -1,
      kitchenStationId: form.kitchenStationId || null,
      minOrderQty: form.minOrderQty ? Number(form.minOrderQty) : null,
      allergenIds: form.allergenIds,
      dietaryTagIds: form.dietaryTagIds,
    };
    const parsed = dishInputSchema.safeParse(candidate);
    // A saved dish keeps an SKU (orders record it), so it can be changed but not cleared.
    const missingSku = dish && !candidate.sku;
    if (!parsed.success || missingSku) {
      const next: FieldErrors = {};
      if (!parsed.success)
        for (const issue of parsed.error.issues)
          (next[issue.path.join('.')] ??= []).push(issue.message);
      if (missingSku) next.sku = ['A dish needs an SKU'];
      setErrors(next);
      return;
    }
    setErrors({});
    void save(parsed.data, dish ? 'Dish saved' : 'Dish created');
  }

  const err = (field: string) =>
    errors[field] ? <p className="text-sm text-destructive">{errors[field]?.[0]}</p> : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>{dish ? dish.name : 'New dish'}</CardTitle>
        {dish && canManage && (
          <Button
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() =>
              void save(
                { isActive: !dish.isActive },
                dish.isActive ? 'Dish deactivated' : 'Dish reactivated',
              )
            }
          >
            {dish.isActive ? 'Deactivate' : 'Reactivate'}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <fieldset disabled={!canManage || saving} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sku">{dish ? 'SKU' : 'SKU (optional)'}</Label>
              <Input
                id="sku"
                value={form.sku}
                placeholder={dish ? undefined : 'Generated for you'}
                onChange={(e) => set('sku', e.target.value)}
                aria-invalid={!!errors.sku}
              />
              {err('sku')}
              {!dish && (
                <p className="text-xs text-muted-foreground">
                  Leave blank and we&apos;ll assign one from the name, like FL-PAN-001.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                aria-invalid={!!errors.name}
              />
              {err('name')}
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </div>
            {canSeeMoney && (
              <div className="space-y-1.5">
                <Label htmlFor="cost">Cost price</Label>
                <MoneyInput
                  id="cost"
                  valueCents={form.costPriceCents}
                  onChangeCents={(c) => set('costPriceCents', c)}
                  invalid={!!errors.costPriceCents}
                />
                {errors.costPriceCents && (
                  <p className="text-sm text-destructive">Enter the cost, e.g. 1.60</p>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="temperature">Temperature</Label>
              <NativeSelect
                id="temperature"
                className="w-full"
                value={form.temperature}
                onChange={(e) => set('temperature', e.target.value as 'HOT' | 'COLD')}
              >
                <NativeSelectOption value="HOT">Hot</NativeSelectOption>
                <NativeSelectOption value="COLD">Cold</NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="station">Kitchen station</Label>
              <NativeSelect
                id="station"
                className="w-full"
                value={form.kitchenStationId}
                onChange={(e) => set('kitchenStationId', e.target.value)}
              >
                <NativeSelectOption value="">Unassigned</NativeSelectOption>
                {stations.data
                  ?.filter((s) => s.isActive || s.id === form.kitchenStationId)
                  .map((s) => (
                    <NativeSelectOption key={s.id} value={s.id}>
                      {s.name}
                    </NativeSelectOption>
                  ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="minQty">Minimum order quantity (optional)</Label>
              <Input
                id="minQty"
                type="number"
                min={1}
                value={form.minOrderQty}
                onChange={(e) => set('minOrderQty', e.target.value)}
              />
              {err('minOrderQty')}
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="image">Image URL (optional)</Label>
              <Input
                id="image"
                value={form.imageUrl}
                onChange={(e) => set('imageUrl', e.target.value)}
                aria-invalid={!!errors.imageUrl}
              />
              {err('imageUrl')}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Allergens</Label>
              <ChipSelect
                label="Allergens"
                items={allergens.data}
                value={form.allergenIds}
                onChange={(v) => set('allergenIds', v)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Dietary tags</Label>
              <ChipSelect
                label="Dietary tags"
                items={tags.data}
                value={form.dietaryTagIds}
                onChange={(v) => set('dietaryTagIds', v)}
              />
            </div>
          </fieldset>
          {canManage && (
            <Button type="submit" className="mt-6" disabled={saving}>
              {saving ? 'Saving…' : dish ? 'Save dish' : 'Create dish'}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
