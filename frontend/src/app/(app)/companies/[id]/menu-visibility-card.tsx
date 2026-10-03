'use client';

import type { CompanyDetail, MenuCategoryDto } from '@fernleaf/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api-client';
import { useAbility } from '@/lib/auth';
import { useCompanyAction } from './use-company';

/** FR-CMP-04 / FR-MEN-02: hide whole categories or single items for this company. */
export function MenuVisibilityCard({ company }: { company: CompanyDetail }) {
  const canManage = useAbility().can('manage', 'Company');
  const act = useCompanyAction(company.id);
  const menu = useQuery({
    queryKey: ['menu-categories'],
    queryFn: () => api<MenuCategoryDto[]>('/menu/categories'),
  });
  const [hiddenCategories, setHiddenCategories] = useState(new Set(company.hiddenCategoryIds));
  const [hiddenItems, setHiddenItems] = useState(new Set(company.hiddenMenuItemIds));
  const [saving, setSaving] = useState(false);

  const dirty =
    !sameSet(hiddenCategories, company.hiddenCategoryIds) ||
    !sameSet(hiddenItems, company.hiddenMenuItemIds);
  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Menu visibility</CardTitle>
          <CardDescription>
            Ticked entries are visible to {company.name} employees. Hiding a category hides all its
            items, secret ones included.
          </CardDescription>
        </div>
        {canManage && (
          <Button
            size="sm"
            disabled={!dirty || saving}
            onClick={async () => {
              setSaving(true);
              await act(
                '/menu-visibility',
                'PUT',
                { hiddenCategoryIds: [...hiddenCategories], hiddenMenuItemIds: [...hiddenItems] },
                'Menu visibility saved',
              );
              setSaving(false);
            }}
          >
            {saving ? 'Saving…' : dirty ? 'Save visibility' : 'Saved'}
          </Button>
        )}
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {menu.data?.map((category) => {
          const categoryHidden = hiddenCategories.has(category.id);
          return (
            <fieldset key={category.id} disabled={!canManage} className="rounded-lg border p-3">
              <label className="flex items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={!categoryHidden}
                  onChange={() => setHiddenCategories(toggle(hiddenCategories, category.id))}
                />
                {category.name}
                {category.isSecret && (
                  <span className="text-xs text-muted-foreground">(secret)</span>
                )}
              </label>
              <ul className="mt-2 space-y-1 pl-6">
                {category.items.map((item) => (
                  <li key={item.id}>
                    <label
                      className={`flex items-center gap-2 text-sm ${categoryHidden ? 'text-muted-foreground' : ''}`}
                    >
                      <input
                        type="checkbox"
                        className="size-3.5"
                        disabled={categoryHidden}
                        checked={!categoryHidden && !hiddenItems.has(item.id)}
                        onChange={() => setHiddenItems(toggle(hiddenItems, item.id))}
                      />
                      {item.dish.name}
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          );
        })}
      </CardContent>
    </Card>
  );
}

function sameSet(a: Set<string>, b: readonly string[]): boolean {
  return a.size === new Set(b).size && b.every((id) => a.has(id));
}
