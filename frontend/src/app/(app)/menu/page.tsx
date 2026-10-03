'use client';

import {
  type DishListItem,
  type MenuCategoryDto,
  menuCategoryInputSchema,
  type Paginated,
  slugify,
} from '@fernleaf/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { RequireAbility } from '@/components/require-ability';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, api } from '@/lib/api-client';
import { useAbility } from '@/lib/auth';

const menuKey = ['menu-categories'] as const;

export default function MenuPage() {
  return (
    <RequireAbility action="read" subject="Menu">
      <MenuManager />
    </RequireAbility>
  );
}

/** Swap two entries of an id list (for up/down reordering). */
function swapped(ids: string[], index: number, delta: number): string[] | null {
  const target = index + delta;
  if (target < 0 || target >= ids.length) return null;
  const next = [...ids];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

/** FR-MEN-01..03: categories (some secret) and the dishes placed in them, both ordered. */
function MenuManager() {
  const canManage = useAbility().can('manage', 'Menu');
  const queryClient = useQueryClient();
  const categories = useQuery({
    queryKey: menuKey,
    queryFn: () => api<MenuCategoryDto[]>('/menu/categories'),
  });
  const dishes = useQuery({
    queryKey: ['dishes', 'menu-picker'],
    queryFn: () => api<Paginated<DishListItem>>('/dishes?active=true&pageSize=100'),
    enabled: canManage,
  });
  const [editing, setEditing] = useState<MenuCategoryDto | 'new' | null>(null);

  /** Run a mutation; when it returns the updated category, patch it into the cached list. */
  async function act(run: () => Promise<unknown>, ok?: string) {
    try {
      const result = await run();
      if (ok) toast.success(ok);
      if (result && typeof result === 'object' && 'items' in result) {
        const updated = result as MenuCategoryDto;
        queryClient.setQueryData<MenuCategoryDto[]>(menuKey, (list) =>
          list?.map((c) => (c.id === updated.id ? updated : c)),
        );
      } else if (Array.isArray(result)) {
        queryClient.setQueryData(menuKey, result);
      } else {
        void queryClient.invalidateQueries({ queryKey: menuKey });
      }
      void queryClient.invalidateQueries({ queryKey: ['dishes'] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Something went wrong');
    }
  }

  const list = categories.data ?? [];
  const send = (path: string, method: string, body?: unknown) =>
    api(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Menu</h1>
          <p className="text-sm text-muted-foreground">
            Categories place dishes on the menu. Secret categories are never listed; they open by
            slug. Companies can hide categories or items (on the company page).
          </p>
        </div>
        {canManage && editing === null && (
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" aria-hidden /> New category
          </Button>
        )}
      </div>

      {editing === 'new' && (
        <CategoryForm
          onDone={() => {
            setEditing(null);
            void queryClient.invalidateQueries({ queryKey: menuKey });
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {categories.isPending && <Skeleton className="h-64 w-full" />}
      {categories.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">No categories yet.</p>
      )}

      {list.map((category, index) =>
        editing !== 'new' && editing?.id === category.id ? (
          <CategoryForm
            key={category.id}
            category={category}
            onDone={() => {
              setEditing(null);
              void queryClient.invalidateQueries({ queryKey: menuKey });
            }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <Card key={category.id} className={category.isActive ? undefined : 'opacity-70'}>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {category.name}
                  <span className="font-mono text-xs font-normal text-muted-foreground">
                    /{category.slug}
                  </span>
                  {category.isSecret && <Badge>Secret</Badge>}
                  {!category.isActive && <Badge variant="secondary">Inactive</Badge>}
                  {category.hiddenForCompanies > 0 && (
                    <Badge variant="outline">
                      Hidden for {category.hiddenForCompanies} compan
                      {category.hiddenForCompanies === 1 ? 'y' : 'ies'}
                    </Badge>
                  )}
                </CardTitle>
                {category.description && (
                  <p className="text-sm text-muted-foreground">{category.description}</p>
                )}
              </div>
              {canManage && (
                <div className="flex flex-wrap gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Move ${category.name} up`}
                    disabled={index === 0}
                    onClick={() => {
                      const ids = swapped(
                        list.map((c) => c.id),
                        index,
                        -1,
                      );
                      if (ids) void act(() => send('/menu/categories/order', 'PUT', { ids }));
                    }}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Move ${category.name} down`}
                    disabled={index === list.length - 1}
                    onClick={() => {
                      const ids = swapped(
                        list.map((c) => c.id),
                        index,
                        1,
                      );
                      if (ids) void act(() => send('/menu/categories/order', 'PUT', { ids }));
                    }}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(category)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      void act(
                        () =>
                          send(`/menu/categories/${category.id}`, 'PATCH', {
                            isActive: !category.isActive,
                          }),
                        category.isActive ? 'Category deactivated' : 'Category activated',
                      )
                    }
                  >
                    {category.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete ${category.name}? Its ${category.items.length} placements and company hiding go too. Dishes stay in the catalogue.`,
                        )
                      )
                        void act(
                          () => send(`/menu/categories/${category.id}`, 'DELETE'),
                          'Category deleted',
                        );
                    }}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {category.items.length === 0 && (
                <p className="text-sm text-muted-foreground">No dishes in this category.</p>
              )}
              <ol className="space-y-1">
                {category.items.map((item, itemIndex) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm"
                  >
                    <span
                      className={item.isActive ? undefined : 'text-muted-foreground line-through'}
                    >
                      <span className="mr-2 font-mono text-xs text-muted-foreground">
                        {item.dish.sku}
                      </span>
                      {item.dish.name}
                      {!item.dish.isActive && (
                        <Badge variant="secondary" className="ml-2">
                          Dish inactive
                        </Badge>
                      )}
                      {item.unpricedOnDefaultTier && (
                        <Badge variant="destructive" className="ml-2">
                          No price on default tier
                        </Badge>
                      )}
                    </span>
                    {canManage && (
                      <span className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Move ${item.dish.name} up`}
                          disabled={itemIndex === 0}
                          onClick={() => {
                            const ids = swapped(
                              category.items.map((i) => i.id),
                              itemIndex,
                              -1,
                            );
                            if (ids)
                              void act(() =>
                                send(`/menu/categories/${category.id}/items/order`, 'PUT', { ids }),
                              );
                          }}
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            className="size-3.5"
                            checked={item.isActive}
                            onChange={(e) =>
                              void act(() =>
                                send(`/menu/items/${item.id}`, 'PATCH', {
                                  isActive: e.target.checked,
                                }),
                              )
                            }
                          />
                          Active
                        </label>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Remove ${item.dish.name}`}
                          onClick={() => void act(() => send(`/menu/items/${item.id}`, 'DELETE'))}
                        >
                          <X className="size-4" />
                        </Button>
                      </span>
                    )}
                  </li>
                ))}
              </ol>
              {canManage && (
                <NativeSelect
                  aria-label={`Add a dish to ${category.name}`}
                  value=""
                  onChange={(e) => {
                    const dishId = e.target.value;
                    if (dishId)
                      void act(() =>
                        send(`/menu/categories/${category.id}/items`, 'POST', { dishId }),
                      );
                  }}
                >
                  <NativeSelectOption value="">+ Add a dish…</NativeSelectOption>
                  {dishes.data?.items
                    .filter((d) => !category.items.some((i) => i.dish.id === d.id))
                    .map((d) => (
                      <NativeSelectOption key={d.id} value={d.id}>
                        {d.name} ({d.sku})
                      </NativeSelectOption>
                    ))}
                </NativeSelect>
              )}
            </CardContent>
          </Card>
        ),
      )}
    </div>
  );
}

function CategoryForm({
  category,
  onDone,
  onCancel,
}: {
  category?: MenuCategoryDto;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [slug, setSlug] = useState(category?.slug ?? '');
  // Follow the name until the slug is edited by hand (new categories only).
  const [slugTouched, setSlugTouched] = useState(Boolean(category));
  const [description, setDescription] = useState(category?.description ?? '');
  const [isSecret, setIsSecret] = useState(category?.isSecret ?? false);
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = menuCategoryInputSchema.safeParse({
      name,
      slug,
      description,
      isSecret,
      isActive,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api(category ? `/menu/categories/${category.id}` : '/menu/categories', {
        method: category ? 'PATCH' : 'POST',
        body: JSON.stringify(parsed.data),
      });
      toast.success(category ? 'Category saved' : 'Category created');
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the category');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{category ? `Edit ${category.name}` : 'New category'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cat-slug">Slug</Label>
              <Input
                id="cat-slug"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugTouched(true);
                }}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="cat-desc">Description</Label>
              <Input
                id="cat-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4"
                checked={isSecret}
                onChange={(e) => setIsSecret(e.target.checked)}
              />
              Secret (not listed; opened by slug)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active
            </label>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save category'}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
