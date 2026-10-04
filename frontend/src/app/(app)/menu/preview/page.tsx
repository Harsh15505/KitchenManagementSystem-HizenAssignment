'use client';

import {
  type CompanyListItem,
  type EmployeeDto,
  type EmployeeMenuDto,
  formatUsd,
  type MenuDishView,
  type MenuGroupView,
  type Paginated,
} from '@fernleaf/shared';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Flame,
  ListChecks,
  Lock,
  Snowflake,
} from 'lucide-react';
import { useState } from 'react';
import { RequireAbility } from '@/components/require-ability';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api-client';
import { useAbility } from '@/lib/auth';
import { nameLookup, useReferenceList } from '@/lib/reference';
import { cn, plural } from '@/lib/utils';

interface Names {
  allergens: Map<string, string>;
  tags: Map<string, string>;
  sizes: Map<string, string>;
}

export default function MenuPreviewPage() {
  return (
    <RequireAbility action="read" subject="Menu">
      <MenuPreview />
    </RequireAbility>
  );
}

/** FR-MEN-04: the menu exactly as one employee sees it (hiding, tier, secret slug, allergies). */
function MenuPreview() {
  const canSeeMoney = useAbility().can('read', 'Money');
  const [companyId, setCompanyId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [slugText, setSlugText] = useState('');
  const [slug, setSlug] = useState('');
  const [allChoices, setAllChoices] = useState(false);
  const names: Names = {
    allergens: nameLookup(useReferenceList('allergens').data),
    tags: nameLookup(useReferenceList('dietary-tags').data),
    sizes: nameLookup(useReferenceList('portion-sizes').data),
  };

  const companies = useQuery({
    queryKey: ['companies', 'preview-picker'],
    queryFn: () => api<Paginated<CompanyListItem>>('/companies?active=true&pageSize=100'),
  });
  const employees = useQuery({
    queryKey: ['employees', 'preview-picker', companyId],
    queryFn: () =>
      api<Paginated<EmployeeDto>>(`/employees?companyId=${companyId}&active=true&pageSize=100`),
    enabled: Boolean(companyId),
  });
  const menu = useQuery({
    queryKey: ['employee-menu', employeeId, slug],
    queryFn: () =>
      api<EmployeeMenuDto>(
        slug
          ? `/menu/for-employee/${employeeId}/secret/${encodeURIComponent(slug)}`
          : `/menu/for-employee/${employeeId}`,
      ),
    enabled: Boolean(employeeId),
  });

  const data = menu.data;
  const dishes = data?.categories.flatMap((c) => c.items) ?? [];
  const clashes = dishes.filter((d) => d.allergenConflicts.length > 0).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Menu preview</h1>
        <p className="text-sm text-muted-foreground">
          See the menu as a specific employee: company hiding, their price tier, secret categories
          by slug, and warnings for their allergies.
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="pv-company">Company</Label>
            <NativeSelect
              id="pv-company"
              className="w-full"
              value={companyId}
              onChange={(e) => {
                setCompanyId(e.target.value);
                setEmployeeId('');
              }}
            >
              <NativeSelectOption value="">Choose…</NativeSelectOption>
              {companies.data?.items.map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pv-employee">Employee</Label>
            <NativeSelect
              id="pv-employee"
              className="w-full"
              value={employeeId}
              disabled={!companyId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <NativeSelectOption value="">Choose…</NativeSelectOption>
              {employees.data?.items.map((e) => (
                <NativeSelectOption key={e.id} value={e.id}>
                  {e.name}
                  {e.allergenIds.length > 0 ? ' (allergies)' : ''}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <form
            className="space-y-1"
            onSubmit={(e) => {
              e.preventDefault();
              setSlug(slugText.trim().toLowerCase());
            }}
          >
            <Label htmlFor="pv-slug">Secret category slug (optional)</Label>
            <div className="flex gap-2">
              <Input
                id="pv-slug"
                placeholder="chefs-table"
                value={slugText}
                onChange={(e) => setSlugText(e.target.value)}
              />
              <Button type="submit" variant="outline" disabled={!employeeId}>
                Open
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {employeeId && menu.isPending && <Skeleton className="h-64" />}
      {data && (
        <>
          <EmployeeStrip data={data} names={names} dishCount={dishes.length} clashes={clashes} />
          {data.categories.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nothing is visible to this employee. Check the company&apos;s hidden menu and tier
              prices.
            </div>
          ) : (
            <>
              <nav
                aria-label="Menu categories"
                className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-xl bg-background/90 p-2 ring-1 ring-foreground/[0.06] backdrop-blur"
              >
                {data.categories.map((c) => (
                  <a
                    key={c.id}
                    href={`#cat-${c.id}`}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-sm transition-colors hover:bg-muted"
                  >
                    {c.isSecret && <Lock className="size-3.5" aria-label="Secret" />}
                    {c.name}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {c.items.length}
                    </span>
                  </a>
                ))}
                <button
                  type="button"
                  aria-pressed={allChoices}
                  onClick={() => setAllChoices(!allChoices)}
                  className={cn(
                    'ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors',
                    allChoices
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'border bg-card hover:bg-muted',
                  )}
                >
                  <ListChecks className="size-4" aria-hidden />
                  {allChoices ? 'Hide all choices' : 'Show all choices'}
                </button>
              </nav>

              {data.categories.map((category) => (
                <section
                  key={category.id}
                  id={`cat-${category.id}`}
                  className="scroll-mt-32 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    {category.isSecret && (
                      <Lock className="size-4 text-muted-foreground" aria-label="Secret" />
                    )}
                    <h2 className="font-heading text-xl font-semibold">{category.name}</h2>
                    <span className="text-sm text-muted-foreground">
                      {plural(category.items.length, 'dish', 'dishes')}
                    </span>
                  </div>
                  <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {category.items.map((dish) => (
                      // Re-keyed on the page-wide switch so every card follows it.
                      <DishCard
                        key={`${dish.menuItemId}-${allChoices}`}
                        dish={dish}
                        defaultOpen={allChoices}
                        names={names}
                        canSeeMoney={canSeeMoney}
                        employeeName={data.employee.name.split(' ')[0] ?? data.employee.name}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

/** Who the preview is for: tier, allergies, preferences, and what they end up seeing. */
function EmployeeStrip({
  data,
  names,
  dishCount,
  clashes,
}: {
  data: EmployeeMenuDto;
  names: Names;
  dishCount: number;
  clashes: number;
}) {
  const e = data.employee;
  const initials = e.name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl bg-card p-4 shadow-(--shadow-card) ring-1 ring-foreground/[0.06]">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary font-heading text-base font-semibold text-secondary-foreground">
          {initials}
        </span>
        <div>
          <div className="font-medium">{e.name}</div>
          <div className="text-xs text-muted-foreground">
            {e.company.name} · {data.tier.name} tier
            {data.tier.isCompanyTier ? '' : ' (default)'}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {e.allergenIds.length === 0 && e.dietaryTagIds.length === 0 && (
          <span className="text-xs text-muted-foreground">
            No allergies or preferences recorded
          </span>
        )}
        {e.allergenIds.map((id) => (
          <Badge key={id} variant="destructive">
            <AlertTriangle aria-hidden /> Allergic: {names.allergens.get(id) ?? 'allergen'}
          </Badge>
        ))}
        {e.dietaryTagIds.map((id) => (
          <Badge key={id} variant="secondary">
            Prefers {names.tags.get(id) ?? 'tag'}
          </Badge>
        ))}
        {data.secret && (
          <Badge variant={data.secret.found ? 'default' : 'outline'}>
            <Lock aria-hidden />
            {data.secret.found
              ? `Secret "${data.secret.slug}" opened`
              : `No secret category "${data.secret.slug}" for this employee`}
          </Badge>
        )}
      </div>
      <dl className="ml-auto flex gap-6">
        <StripStat label="Dishes" value={dishCount} />
        <StripStat label="Categories" value={data.categories.length} />
        <StripStat label="Allergy clashes" value={clashes} danger={clashes > 0} />
      </dl>
    </div>
  );
}

function StripStat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="text-right">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'font-heading text-2xl leading-tight font-semibold tabular-nums',
          danger && 'text-red-700 dark:text-red-300',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * One dish as a menu card: name and price, description, tags, an allergen band, and the choices
 * behind a toggle so the page reads like a menu rather than a wall of options.
 */
function DishCard({
  dish,
  defaultOpen,
  names,
  canSeeMoney,
  employeeName,
}: {
  dish: MenuDishView;
  defaultOpen: boolean;
  names: Names;
  canSeeMoney: boolean;
  employeeName: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const conflict = dish.allergenConflicts.length > 0;
  const optionCount = dish.groups.reduce((t, g) => t + g.options.length, 0);
  const optionClashes = dish.groups
    .flatMap((g) => g.options)
    .filter((o) => o.allergenConflicts.length > 0).length;
  const allergenNames = (ids: string[]) =>
    ids.map((id) => names.allergens.get(id) ?? 'allergen').join(', ');

  return (
    <article
      className={cn(
        'flex flex-col overflow-hidden rounded-xl bg-card shadow-(--shadow-card) ring-1 ring-foreground/[0.06]',
        conflict && 'ring-red-300 dark:ring-red-900',
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-heading text-base leading-snug font-semibold">{dish.name}</h3>
          {canSeeMoney && (
            <span className="shrink-0 rounded-md bg-secondary px-2 py-0.5 font-heading text-base font-semibold text-secondary-foreground tabular-nums">
              {formatUsd(dish.priceCents)}
            </span>
          )}
        </div>
        {dish.description && (
          <p className="mt-1 text-sm text-muted-foreground">{dish.description}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge variant="outline">
            {dish.temperature === 'HOT' ? (
              <>
                <Flame aria-hidden /> Hot
              </>
            ) : (
              <>
                <Snowflake aria-hidden /> Cold
              </>
            )}
          </Badge>
          {dish.dietaryTagIds.map((id) => {
            const match = dish.dietMatches.includes(id);
            return (
              <Badge key={id} variant={match ? 'success' : 'outline'}>
                {match && <Check aria-hidden />}
                {names.tags.get(id) ?? 'Tag'}
              </Badge>
            );
          })}
          {dish.minOrderQty && <Badge variant="outline">Min {dish.minOrderQty}</Badge>}
        </div>
      </div>

      {conflict ? (
        <div className="flex items-start gap-1.5 border-t bg-red-500/10 px-4 py-2 text-xs font-medium text-red-700 dark:text-red-300">
          <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
          Contains {allergenNames(dish.allergenConflicts)}: {employeeName} is allergic
        </div>
      ) : (
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
          {dish.allergenIds.length > 0
            ? `Contains ${allergenNames(dish.allergenIds)}`
            : 'No listed allergens'}
        </div>
      )}

      {dish.groups.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="flex w-full cursor-pointer items-center gap-2 border-t bg-muted/40 px-4 py-2 text-left text-xs transition-colors hover:bg-muted"
          >
            <ListChecks className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="font-medium">{open ? 'Hide choices' : 'Choices'}</span>
            <span className="text-muted-foreground">
              {plural(dish.groups.length, 'group')} · {plural(optionCount, 'option')}
            </span>
            {optionClashes > 0 && (
              <Badge variant="destructive">{plural(optionClashes, 'clash', 'clashes')}</Badge>
            )}
            <ChevronDown
              className={cn(
                'ml-auto size-4 shrink-0 text-muted-foreground transition-transform',
                open && 'rotate-180',
              )}
              aria-hidden
            />
          </button>
          {open &&
            dish.groups.map((group) => (
              <ChoiceTable key={group.id} group={group} names={names} canSeeMoney={canSeeMoney} />
            ))}
        </>
      )}
    </article>
  );
}

/**
 * One option group as a small table: a radio or checkbox mark (pick one / pick several), the
 * option, and a price column per portion size with the real added price (option + size extra).
 */
function ChoiceTable({
  group,
  names,
  canSeeMoney,
}: {
  group: MenuGroupView;
  names: Names;
  canSeeMoney: boolean;
}) {
  const multi = group.maxSelections > 1;
  const columns: Array<string | null> = canSeeMoney
    ? group.usesPortions
      ? group.portionSizeIds
      : [null]
    : [];
  const grid = {
    gridTemplateColumns: `0.875rem minmax(0, 1fr)${columns.length > 0 ? ` repeat(${columns.length}, 4rem)` : ''}`,
  };
  return (
    <div className="border-t px-4 pt-2.5 pb-1">
      <div className="grid items-end gap-x-2 pb-1" style={grid}>
        <span className="col-span-2 flex flex-wrap items-baseline gap-x-2">
          <span className="text-xs font-semibold">{group.name}</span>
          <span className="text-[11px] text-muted-foreground">
            {group.isRequired ? 'Required' : 'Optional'} ·{' '}
            {multi ? `pick up to ${group.maxSelections}` : 'pick 1'}
          </span>
        </span>
        {columns.map((sizeId) => (
          <span key={sizeId ?? 'price'} className="text-right text-[11px] text-muted-foreground">
            {sizeId ? (names.sizes.get(sizeId) ?? 'Size') : 'Price'}
          </span>
        ))}
      </div>
      <ul className="divide-y divide-border/60">
        {group.options.map((o) => {
          const bad = o.allergenConflicts.length > 0;
          return (
            <li
              key={o.optionId}
              className={cn(
                'grid items-center gap-x-2 py-1.5 text-sm',
                bad && 'text-red-700 dark:text-red-300',
              )}
              style={grid}
            >
              <span
                aria-hidden
                className={cn(
                  'size-3.5 border-[1.5px] border-muted-foreground/45',
                  multi ? 'rounded-[4px]' : 'rounded-full',
                  bad && 'border-red-400',
                )}
              />
              <span className="min-w-0">
                {o.name}
                {bad && (
                  <span className="block text-xs">
                    <AlertTriangle className="mr-1 inline size-3 align-[-2px]" aria-hidden />
                    contains{' '}
                    {o.allergenConflicts
                      .map((a) => names.allergens.get(a) ?? 'allergen')
                      .join(', ')}
                  </span>
                )}
              </span>
              {columns.map((sizeId) => {
                const cents = sizeId
                  ? o.priceCents +
                    (o.sizes.find((x) => x.portionSizeId === sizeId)?.extraCents ?? 0)
                  : o.priceCents;
                return (
                  <span
                    key={sizeId ?? 'price'}
                    className={cn(
                      'text-right text-xs tabular-nums',
                      cents === 0 && 'text-muted-foreground',
                    )}
                  >
                    {cents === 0 ? 'Included' : `+${formatUsd(cents)}`}
                  </span>
                );
              })}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
