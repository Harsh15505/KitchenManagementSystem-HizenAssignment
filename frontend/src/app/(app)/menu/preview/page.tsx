'use client';

import {
  type CompanyListItem,
  type EmployeeDto,
  type EmployeeMenuDto,
  formatUsd,
  type Paginated,
} from '@fernleaf/shared';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Lock } from 'lucide-react';
import { useState } from 'react';
import { RequireAbility } from '@/components/require-ability';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api-client';
import { useAbility } from '@/lib/auth';
import { nameLookup, useReferenceList } from '@/lib/reference';

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
  const allergens = nameLookup(useReferenceList('allergens').data);
  const tags = nameLookup(useReferenceList('dietary-tags').data);
  const sizes = nameLookup(useReferenceList('portion-sizes').data);

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
  const price = (cents: number | undefined) =>
    canSeeMoney && cents !== undefined ? formatUsd(cents) : null;

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
      {menu.data && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{menu.data.employee.name}</span>
            <span className="text-muted-foreground">at {menu.data.employee.company.name}</span>
            <Badge variant="outline">
              {menu.data.tier.name} tier{menu.data.tier.isCompanyTier ? '' : ' (default)'}
            </Badge>
            {menu.data.employee.allergenIds.map((id) => (
              <Badge key={id} variant="destructive">
                Allergic: {allergens.get(id) ?? 'allergen'}
              </Badge>
            ))}
            {menu.data.employee.dietaryTagIds.map((id) => (
              <Badge key={id} variant="secondary">
                Prefers {tags.get(id) ?? 'tag'}
              </Badge>
            ))}
            {menu.data.secret && (
              <Badge variant={menu.data.secret.found ? 'default' : 'outline'}>
                {menu.data.secret.found
                  ? `Secret "${menu.data.secret.slug}" opened`
                  : `No secret category "${menu.data.secret.slug}" for this employee`}
              </Badge>
            )}
          </div>
          {menu.data.categories.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing is visible to this employee. Check the company&apos;s hidden menu and tier
              prices.
            </p>
          )}
          {menu.data.categories.map((category) => (
            <Card key={category.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {category.isSecret && <Lock className="size-4" aria-label="Secret" />}
                  {category.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {category.items.map((dish) => (
                  <div
                    key={dish.menuItemId}
                    className={`space-y-2 rounded-lg border p-3 ${dish.allergenConflicts.length > 0 ? 'border-destructive/60' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{dish.name}</div>
                        <p className="text-xs text-muted-foreground">{dish.description}</p>
                      </div>
                      <span className="font-semibold tabular-nums">{price(dish.priceCents)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline">{dish.temperature === 'HOT' ? 'Hot' : 'Cold'}</Badge>
                      {dish.minOrderQty && <Badge variant="outline">Min {dish.minOrderQty}</Badge>}
                      {dish.dietMatches.map((id) => (
                        <Badge key={id} variant="secondary">
                          ✓ {tags.get(id) ?? 'tag'}
                        </Badge>
                      ))}
                      {dish.allergenConflicts.map((id) => (
                        <Badge key={id} variant="destructive">
                          <AlertTriangle className="size-3" aria-hidden /> Contains{' '}
                          {allergens.get(id) ?? 'allergen'}
                        </Badge>
                      ))}
                    </div>
                    {dish.groups.map((group) => (
                      <div key={group.id} className="text-xs">
                        <span className="font-medium">{group.name}</span>{' '}
                        <span className="text-muted-foreground">
                          ({group.isRequired ? 'required' : 'optional'}
                          {group.maxSelections > 1 ? `, up to ${group.maxSelections}` : ''}
                          {group.usesPortions
                            ? `, sizes ${group.portionSizeIds.map((s) => sizes.get(s) ?? '?').join('/')}`
                            : ''}
                          )
                        </span>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {group.options.map((o) => (
                            <span
                              key={o.optionId}
                              className={`rounded border px-1.5 py-0.5 ${o.allergenConflicts.length > 0 ? 'border-destructive text-destructive' : ''}`}
                            >
                              {o.name}
                              {o.priceCents > 0 && price(o.priceCents)
                                ? ` +${price(o.priceCents)}`
                                : ''}
                              {o.sizes
                                .filter((s) => s.extraCents > 0)
                                .map((s) =>
                                  price(s.extraCents)
                                    ? ` (${sizes.get(s.portionSizeId) ?? 'size'} +${price(s.extraCents)})`
                                    : '',
                                )
                                .join('')}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
