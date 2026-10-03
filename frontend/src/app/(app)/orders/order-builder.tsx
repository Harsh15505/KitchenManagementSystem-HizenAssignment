'use client';

import {
  type CompanyListItem,
  type EmployeeDto,
  type FieldErrors,
  formatUsd,
  type MenuDishView,
  minutesToHHmm,
  type OrderContextDto,
  type OrderDetail,
  type OrderLineInput,
  type OrderQuoteDto,
  type Paginated,
} from '@fernleaf/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Lock, Plus, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { ApiError, api } from '@/lib/api-client';
import { useAbility } from '@/lib/auth';
import { nameLookup, useReferenceList } from '@/lib/reference';

/** One combination in the builder: per group, the chosen options and (portioned groups) the size. */
interface ComboState {
  key: number;
  quantity: number;
  picks: Record<string, { optionIds: string[]; sizeId: string | null }>;
}
interface LineState {
  dishId: string;
  combos: ComboState[];
  /** Combinations kept from the saved order for a dish no longer on the menu (sent back as-is). */
  frozen?: OrderLineInput['combinations'];
  frozenName?: string;
}

let keySeq = 1;
const newCombo = (dish: MenuDishView, quantity = 1): ComboState => ({
  key: keySeq++,
  quantity,
  picks: Object.fromEntries(
    dish.groups.map((g) => [
      g.id,
      {
        optionIds: g.isRequired && g.options[0] ? [g.options[0].optionId] : [],
        sizeId: g.usesPortions ? (g.portionSizeIds[0] ?? null) : null,
      },
    ]),
  ),
});

function toLineInput(line: LineState): OrderLineInput {
  if (line.frozen) {
    return {
      dishId: line.dishId,
      quantity: line.frozen.reduce((s, c) => s + c.quantity, 0),
      combinations: line.frozen,
    };
  }
  const combinations = line.combos.map((c) => ({
    quantity: c.quantity,
    choices: Object.entries(c.picks).flatMap(([groupId, pick]) =>
      pick.optionIds.map((optionId) => ({ groupId, optionId, portionSizeId: pick.sizeId })),
    ),
  }));
  return {
    dishId: line.dishId,
    quantity: combinations.reduce((s, c) => s + c.quantity, 0),
    combinations,
  };
}

/** FR-ORD-02 (TRD §7.3): employee → date → dishes and combinations → delivery → breakdown → save. */
export function OrderBuilder({ order }: { order?: OrderDetail }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canSeeMoney = useAbility().can('read', 'Money');
  const allergens = nameLookup(useReferenceList('allergens').data);
  const sizes = nameLookup(useReferenceList('portion-sizes').data);

  const [companyId, setCompanyId] = useState(order?.company.id ?? '');
  const [employeeId, setEmployeeId] = useState(order?.employee.id ?? '');
  const [date, setDate] = useState(order?.deliveryDate ?? '');
  const [time, setTime] = useState<number | null>(order ? order.deliveryTimeMinutes : null);
  const [addressId, setAddressId] = useState<string | null>(order?.address.id ?? null);
  const [packagingId, setPackagingId] = useState<string | null>(order?.packaging.id ?? null);
  const [notes, setNotes] = useState(order?.notes ?? '');
  const [ack, setAck] = useState(order?.allergenAcknowledged ?? false);
  const [lines, setLines] = useState<LineState[]>([]);
  const [linesLoaded, setLinesLoaded] = useState(!order);
  const [lastQuote, setQuote] = useState<OrderQuoteDto | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const companies = useQuery({
    queryKey: ['companies', 'order-picker'],
    queryFn: () => api<Paginated<CompanyListItem>>('/companies?active=true&pageSize=100'),
    enabled: !order,
  });
  const employees = useQuery({
    queryKey: ['employees', 'order-picker', companyId],
    queryFn: () =>
      api<Paginated<EmployeeDto>>(`/employees?companyId=${companyId}&active=true&pageSize=100`),
    enabled: Boolean(companyId) && !order,
  });
  const context = useQuery({
    queryKey: ['order-context', employeeId],
    queryFn: () => api<OrderContextDto>(`/orders/context?employeeId=${employeeId}`),
    enabled: Boolean(employeeId),
  });
  const ctx = context.data;
  const dishes = useMemo(() => {
    const map = new Map<string, MenuDishView>();
    for (const c of ctx?.menu ?? [])
      for (const d of c.items) if (!map.has(d.dishId)) map.set(d.dishId, d);
    return map;
  }, [ctx]);

  // Edit: turn the saved lines into builder state once the menu is known (derived during render).
  if (order && ctx && !linesLoaded) {
    setLines(
      order.lines.map((l) => {
        const dish = dishes.get(l.dishId);
        const raw = l.combinations.map((c) => ({
          quantity: c.quantity,
          choices: c.choices.map((ch) => ({
            groupId: ch.groupId ?? '',
            optionId: ch.optionId,
            portionSizeId: ch.portionSizeId,
          })),
        }));
        if (!dish) return { dishId: l.dishId, combos: [], frozen: raw, frozenName: l.dishName };
        return {
          dishId: l.dishId,
          combos: l.combinations.map((c) => {
            const combo = newCombo(dish, c.quantity);
            for (const g of dish.groups)
              combo.picks[g.id] = {
                optionIds: [],
                sizeId: g.usesPortions ? (g.portionSizeIds[0] ?? null) : null,
              };
            for (const ch of c.choices) {
              if (!ch.groupId || !combo.picks[ch.groupId]) continue;
              combo.picks[ch.groupId]!.optionIds.push(ch.optionId);
              if (ch.portionSizeId) combo.picks[ch.groupId]!.sizeId = ch.portionSizeId;
            }
            return combo;
          }),
        };
      }),
    );
    setLinesLoaded(true);
  }

  const selectedDate = ctx?.dates.find((d) => d.date === date);
  const body =
    employeeId && date && lines.length > 0
      ? {
          employeeId,
          deliveryDate: date,
          deliveryTimeMinutes: time,
          addressId,
          packagingTypeId: packagingId,
          notes,
          allergenAcknowledged: ack,
          lines: lines.map(toLineInput),
        }
      : null;
  const bodyKey = JSON.stringify(body);
  // A quote only describes the current inputs; with nothing to quote, show none.
  const quote = body ? lastQuote : null;

  // Live quote: the server validates and prices every change (FR-ORD-03).
  useEffect(() => {
    if (!body || !linesLoaded) return;
    const handle = setTimeout(async () => {
      try {
        const q = await api<OrderQuoteDto>('/orders/quote', {
          method: 'POST',
          body: JSON.stringify({ ...body, place: true, ...(order ? { orderId: order.id } : {}) }),
        });
        setQuote(q);
        setErrors({});
        setErrorMessage(null);
      } catch (error) {
        setQuote(null);
        if (error instanceof ApiError) {
          setErrors(error.fieldErrors ?? {});
          setErrorMessage(error.message);
        }
      }
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyKey, linesLoaded]);

  async function save(place: boolean) {
    if (!body) return;
    setSaving(true);
    try {
      let id: string;
      if (order) {
        await api(`/orders/${order.id}`, {
          method: 'PUT',
          body: JSON.stringify({ ...body, version: order.version }),
        });
        id = order.id;
        if (place && order.status === 'DRAFT')
          await api(`/orders/${order.id}/place`, {
            method: 'POST',
            body: JSON.stringify({ version: order.version + 1 }),
          });
      } else {
        ({ id } = await api<{ id: string }>('/orders', {
          method: 'POST',
          body: JSON.stringify({ ...body, place }),
        }));
      }
      toast.success(order ? 'Order saved' : place ? 'Order placed' : 'Draft saved');
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['order', id] });
      router.push(`/orders/${id}`);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors ?? {});
        setErrorMessage(error.message);
        toast.error(error.message);
      }
    } finally {
      setSaving(false);
    }
  }

  const err = (path: string) =>
    errors[path]?.map((m) => (
      <p key={m} className="text-xs text-destructive">
        {m}
      </p>
    ));
  const updateLine = (i: number, next: LineState | null) =>
    setLines((ls) =>
      next ? ls.map((l, j) => (j === i ? next : l)) : ls.filter((_, j) => j !== i),
    );
  const money = (c: number | undefined) => (canSeeMoney && c !== undefined ? formatUsd(c) : '');
  const timeOptions = ctx
    ? Array.from(
        {
          length:
            Math.floor((ctx.window.endMinutes - ctx.window.startMinutes) / ctx.window.slotMinutes) +
            1,
        },
        (_, i) => ctx.window.startMinutes + i * ctx.window.slotMinutes,
      )
    : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Who and when</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="ob-company">Company</Label>
              {order ? (
                <p className="text-sm">{order.company.name}</p>
              ) : (
                <NativeSelect
                  id="ob-company"
                  className="w-full"
                  value={companyId}
                  onChange={(e) => {
                    setCompanyId(e.target.value);
                    setEmployeeId('');
                    setLines([]);
                    setDate('');
                  }}
                >
                  <NativeSelectOption value="">Choose…</NativeSelectOption>
                  {companies.data?.items.map((c) => (
                    <NativeSelectOption key={c.id} value={c.id}>
                      {c.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="ob-employee">Employee</Label>
              {order ? (
                <p className="text-sm">{order.employee.name}</p>
              ) : (
                <NativeSelect
                  id="ob-employee"
                  className="w-full"
                  value={employeeId}
                  disabled={!companyId}
                  onChange={(e) => {
                    setEmployeeId(e.target.value);
                    setLines([]);
                    setTime(null);
                    setAddressId(null);
                    setPackagingId(null);
                  }}
                >
                  <NativeSelectOption value="">Choose…</NativeSelectOption>
                  {employees.data?.items.map((e) => (
                    <NativeSelectOption key={e.id} value={e.id}>
                      {e.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="ob-date">Delivery date</Label>
              <NativeSelect
                id="ob-date"
                className="w-full"
                value={date}
                disabled={!ctx}
                onChange={(e) => setDate(e.target.value)}
              >
                <NativeSelectOption value="">Choose…</NativeSelectOption>
                {ctx?.dates
                  .filter((d) => !d.locked || (ctx.canOverride && !order))
                  .map((d) => (
                    <NativeSelectOption key={d.date} value={d.date}>
                      {new Date(`${d.date}T00:00:00Z`).toLocaleDateString('en-IN', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        timeZone: 'UTC',
                      })}
                      {d.locked
                        ? ' · late order (cut-off passed)'
                        : ` · order by ${new Date(d.cutoffAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', hour: '2-digit', minute: '2-digit' })}`}
                    </NativeSelectOption>
                  ))}
              </NativeSelect>
              {err('deliveryDate')}
              {selectedDate?.locked && (
                <p className="flex items-center gap-1 text-xs text-amber-700">
                  <Lock className="size-3" aria-hidden /> Cut-off passed: this will be a confirmed
                  late order.
                </p>
              )}
            </div>
            {ctx && (
              <div className="flex flex-wrap gap-1 md:col-span-3">
                <Badge variant="outline">{ctx.tier.name} tier</Badge>
                {ctx.employee.allergenIds.map((id) => (
                  <Badge key={id} variant="destructive">
                    Allergic: {allergens.get(id) ?? 'allergen'}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {ctx && (
          <Card>
            <CardHeader>
              <CardTitle>Delivery</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="ob-time">Time (IST)</Label>
                <NativeSelect
                  id="ob-time"
                  className="w-full"
                  disabled={!ctx.employee.canChangeDeliveryTime}
                  value={String(time ?? ctx.defaults.deliveryTimeMinutes)}
                  onChange={(e) => setTime(Number(e.target.value))}
                >
                  {[...new Set([ctx.defaults.deliveryTimeMinutes, ...timeOptions])]
                    .sort((a, b) => a - b)
                    .map((m) => (
                      <NativeSelectOption key={m} value={String(m)}>
                        {minutesToHHmm(m)}
                        {m === ctx.defaults.deliveryTimeMinutes ? ' (company default)' : ''}
                      </NativeSelectOption>
                    ))}
                </NativeSelect>
                {!ctx.employee.canChangeDeliveryTime && (
                  <p className="text-xs text-muted-foreground">
                    Company default (employee can’t change it)
                  </p>
                )}
                {err('deliveryTimeMinutes')}
              </div>
              <div className="space-y-1">
                <Label htmlFor="ob-address">Address</Label>
                <NativeSelect
                  id="ob-address"
                  className="w-full"
                  disabled={!ctx.employee.canChooseAddress}
                  value={addressId ?? ctx.defaults.addressId}
                  onChange={(e) => setAddressId(e.target.value)}
                >
                  {ctx.addresses.map((a) => (
                    <NativeSelectOption key={a.id} value={a.id}>
                      {a.label}
                      {a.isDefault ? ' (default)' : ''}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {err('addressId')}
              </div>
              <div className="space-y-1">
                <Label htmlFor="ob-pack">Packaging</Label>
                <NativeSelect
                  id="ob-pack"
                  className="w-full"
                  disabled={!ctx.employee.canChangePackaging}
                  value={packagingId ?? ctx.defaults.packagingTypeId}
                  onChange={(e) => setPackagingId(e.target.value)}
                >
                  {ctx.packagingTypes.map((p) => (
                    <NativeSelectOption key={p.id} value={p.id}>
                      {p.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {err('packagingTypeId')}
              </div>
              <div className="space-y-1 md:col-span-3">
                <Label htmlFor="ob-notes">Notes for the kitchen (optional)</Label>
                <Input id="ob-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </CardContent>
          </Card>
        )}

        {ctx && (
          <Card>
            <CardHeader>
              <CardTitle>Dishes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {err('lines')}
              {lines.map((line, i) => {
                const dish = dishes.get(line.dishId);
                const total = line.frozen
                  ? line.frozen.reduce((s, c) => s + c.quantity, 0)
                  : line.combos.reduce((s, c) => s + c.quantity, 0);
                return (
                  <div key={line.dishId} className="space-y-3 rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">
                          {dish?.name ?? line.frozenName}{' '}
                          <span className="text-muted-foreground">× {total}</span>
                        </div>
                        {dish && (
                          <span className="text-xs text-muted-foreground">
                            {money(dish.priceCents)} each before options
                          </span>
                        )}
                        {dish?.minOrderQty && (
                          <Badge variant="outline" className="ml-2">
                            Min {dish.minOrderQty}
                          </Badge>
                        )}
                        {dish?.allergenConflicts.map((id) => (
                          <Badge key={id} variant="destructive" className="ml-1">
                            <AlertTriangle className="size-3" aria-hidden /> {allergens.get(id)}
                          </Badge>
                        ))}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove ${dish?.name ?? 'dish'}`}
                        onClick={() => updateLine(i, null)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    {err(`lines.${i}.quantity`)}
                    {err(`lines.${i}.dishId`)}
                    {line.frozen && (
                      <p className="text-xs text-muted-foreground">
                        No longer on this employee’s menu; the saved combinations are kept at their
                        captured prices.
                      </p>
                    )}
                    {dish &&
                      line.combos.map((combo, j) => (
                        <div key={combo.key} className="space-y-2 rounded-md bg-muted/40 p-2">
                          <div className="flex flex-wrap items-end gap-3">
                            <div className="w-20 space-y-1">
                              <Label className="text-xs">Qty</Label>
                              <Input
                                type="number"
                                min={1}
                                value={combo.quantity}
                                onChange={(e) =>
                                  updateLine(i, {
                                    ...line,
                                    combos: line.combos.map((c) =>
                                      c.key === combo.key
                                        ? { ...c, quantity: Math.max(0, Number(e.target.value)) }
                                        : c,
                                    ),
                                  })
                                }
                              />
                            </div>
                            {dish.groups.map((g) => {
                              const pick = combo.picks[g.id] ?? { optionIds: [], sizeId: null };
                              const setPick = (next: typeof pick) =>
                                updateLine(i, {
                                  ...line,
                                  combos: line.combos.map((c) =>
                                    c.key === combo.key
                                      ? { ...c, picks: { ...c.picks, [g.id]: next } }
                                      : c,
                                  ),
                                });
                              return (
                                <div key={g.id} className="space-y-1">
                                  <Label className="text-xs">
                                    {g.name}
                                    {g.isRequired ? '' : ' (optional)'}
                                  </Label>
                                  <div className="flex gap-1">
                                    {g.maxSelections === 1 ? (
                                      <NativeSelect
                                        aria-label={g.name}
                                        value={pick.optionIds[0] ?? ''}
                                        onChange={(e) =>
                                          setPick({
                                            ...pick,
                                            optionIds: e.target.value ? [e.target.value] : [],
                                          })
                                        }
                                      >
                                        {!g.isRequired && (
                                          <NativeSelectOption value="">None</NativeSelectOption>
                                        )}
                                        {g.options.map((o) => (
                                          <NativeSelectOption key={o.optionId} value={o.optionId}>
                                            {o.name}
                                            {o.priceCents > 0 && canSeeMoney
                                              ? ` +${formatUsd(o.priceCents)}`
                                              : ''}
                                            {o.allergenConflicts.length > 0 ? ' ⚠' : ''}
                                          </NativeSelectOption>
                                        ))}
                                      </NativeSelect>
                                    ) : (
                                      <div className="flex flex-wrap gap-1">
                                        {g.options.map((o) => {
                                          const on = pick.optionIds.includes(o.optionId);
                                          return (
                                            <button
                                              key={o.optionId}
                                              type="button"
                                              aria-pressed={on}
                                              onClick={() =>
                                                setPick({
                                                  ...pick,
                                                  optionIds: on
                                                    ? pick.optionIds.filter((x) => x !== o.optionId)
                                                    : [...pick.optionIds, o.optionId],
                                                })
                                              }
                                              className={`rounded-full border px-2 py-0.5 text-xs ${on ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
                                            >
                                              {o.name}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                    {g.usesPortions && (
                                      <NativeSelect
                                        aria-label={`${g.name} size`}
                                        value={pick.sizeId ?? ''}
                                        onChange={(e) =>
                                          setPick({ ...pick, sizeId: e.target.value || null })
                                        }
                                      >
                                        {g.portionSizeIds.map((s) => (
                                          <NativeSelectOption key={s} value={s}>
                                            {sizes.get(s) ?? 'Size'}
                                          </NativeSelectOption>
                                        ))}
                                      </NativeSelect>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                            {line.combos.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label="Remove combination"
                                onClick={() =>
                                  updateLine(i, {
                                    ...line,
                                    combos: line.combos.filter((c) => c.key !== combo.key),
                                  })
                                }
                              >
                                <X className="size-4" />
                              </Button>
                            )}
                          </div>
                          {Object.entries(errors)
                            .filter(([p]) => p.startsWith(`lines.${i}.combinations.${j}`))
                            .flatMap(([, ms]) => ms)
                            .map((m) => (
                              <p key={m} className="text-xs text-destructive">
                                {m}
                              </p>
                            ))}
                        </div>
                      ))}
                    {dish && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateLine(i, { ...line, combos: [...line.combos, newCombo(dish)] })
                        }
                      >
                        <Plus className="size-4" aria-hidden /> Another combination
                      </Button>
                    )}
                  </div>
                );
              })}
              <NativeSelect
                aria-label="Add a dish"
                value=""
                onChange={(e) => {
                  const dish = dishes.get(e.target.value);
                  if (dish)
                    setLines((ls) => [
                      ...ls,
                      { dishId: dish.dishId, combos: [newCombo(dish, dish.minOrderQty ?? 1)] },
                    ]);
                }}
              >
                <NativeSelectOption value="">+ Add a dish…</NativeSelectOption>
                {ctx.menu.map((c) =>
                  c.items
                    .filter((d) => !lines.some((l) => l.dishId === d.dishId))
                    .map((d) => (
                      <NativeSelectOption key={`${c.id}-${d.dishId}`} value={d.dishId}>
                        {c.name} · {d.name}
                        {canSeeMoney ? ` · ${formatUsd(d.priceCents)}` : ''}
                        {d.allergenConflicts.length > 0 ? ' ⚠' : ''}
                      </NativeSelectOption>
                    )),
                )}
              </NativeSelect>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!body && (
              <p className="text-muted-foreground">
                Choose an employee, a date and at least one dish.
              </p>
            )}
            {errorMessage && (
              <p
                role="alert"
                className="rounded-md border border-destructive/50 p-2 text-destructive"
              >
                {errorMessage}
              </p>
            )}
            {quote && (
              <>
                {quote.lines.map((l) => (
                  <div key={l.dishId}>
                    <div className="flex justify-between font-medium">
                      <span>
                        {l.dishName} × {l.quantity}
                      </span>
                      <span className="tabular-nums">{money(l.totalCents)}</span>
                    </div>
                    {l.combinations.map((c) => (
                      <div
                        key={c.signature}
                        className="flex justify-between pl-3 text-xs text-muted-foreground"
                      >
                        <span>
                          {c.quantity} ×{' '}
                          {c.choices
                            .map(
                              (ch) =>
                                ch.optionName +
                                (ch.portionSizeId ? ` (${sizes.get(ch.portionSizeId) ?? ''})` : ''),
                            )
                            .join(', ') || 'as is'}
                          {c.captured ? ' · price kept' : ''}
                        </span>
                        <span className="tabular-nums">{money(c.unitPriceCents)} ea</span>
                      </div>
                    ))}
                  </div>
                ))}
                <div className="flex justify-between border-t pt-2 text-base font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{money(quote.totalCents)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {quote.delivery.address.label} · {minutesToHHmm(quote.delivery.timeMinutes)} ·{' '}
                  {quote.delivery.packaging.name}
                  <br />
                  Kitchen-ready by{' '}
                  {new Date(quote.delivery.plannedKitchenReadyAt).toLocaleTimeString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  , leaves by{' '}
                  {new Date(quote.delivery.plannedDispatchReadyAt).toLocaleTimeString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                {quote.warnings.length > 0 && (
                  <label className="flex items-start gap-2 rounded-md border border-destructive/50 p-2 text-xs">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4"
                      checked={ack}
                      onChange={(e) => setAck(e.target.checked)}
                    />
                    <span>
                      <AlertTriangle className="mr-1 inline size-3 text-destructive" aria-hidden />
                      {quote.warnings
                        .map(
                          (w) =>
                            `${w.dishName} (${w.allergenIds.map((a) => allergens.get(a)).join(', ')})`,
                        )
                        .join('; ')}{' '}
                      clash with the employee’s allergies. I have confirmed this with them.
                    </span>
                  </label>
                )}
                {err('allergenAcknowledged')}
              </>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              {(!order || order.status === 'DRAFT') && !selectedDate?.locked && (
                <Button
                  variant="outline"
                  disabled={!body || saving}
                  onClick={() => void save(false)}
                >
                  {order ? 'Save draft' : 'Save as draft'}
                </Button>
              )}
              <Button disabled={!body || !quote || saving} onClick={() => void save(true)}>
                {saving
                  ? 'Saving…'
                  : order?.status === 'PLACED'
                    ? 'Save changes'
                    : selectedDate?.locked
                      ? 'Place late order'
                      : 'Place order'}
              </Button>
            </div>
            {selectedDate && !selectedDate.locked && (
              <p className="text-xs text-muted-foreground">
                Editable until{' '}
                {new Date(selectedDate.cutoffAt).toLocaleString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                IST.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
