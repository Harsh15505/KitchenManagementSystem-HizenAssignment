'use client';

import {
  formatUsd,
  type PriceSource,
  type TierGrid,
  type TierGridRow,
  type TierPriceChanges,
} from '@fernleaf/shared';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { MoneyInput } from '@/components/money-input';
import { RequireAbility } from '@/components/require-ability';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { describeTier, tiersQueryKey } from '@/lib/pricing';
import { cn } from '@/lib/utils';

type Kind = 'DISH' | 'OPTION';
/** An unsaved cell edit. `cents: null` means the typed text isn't a valid amount yet. */
type Draft = { action: 'set'; cents: number | null } | { action: 'exclude' } | { action: 'clear' };

const SOURCE_LABEL: Record<PriceSource, string> = {
  EXPLICIT: 'Typed',
  DERIVED: 'Derived',
  EXCLUDED: 'Not sold',
  MISSING: 'Missing',
};

export default function TierGridPage() {
  return (
    <RequireAbility action="read" subject="Pricing">
      <TierGridView />
    </RequireAbility>
  );
}

/** FR-PRC-06: every item's price on one tier, with inline edits saved in one bulk request. */
function TierGridView() {
  const { tierId } = useParams<{ tierId: string }>();
  const ability = useAbility();
  const canManage = ability.can('manage', 'Pricing');
  const canSeeMoney = ability.can('read', 'Money');
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<Kind>('DISH');
  const [missingOnly, setMissingOnly] = useState(false);
  const [q, setQ] = useState('');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [version, setVersion] = useState(0);
  const [saving, setSaving] = useState(false);

  const params = new URLSearchParams({ kind });
  if (missingOnly) params.set('missingOnly', 'true');
  if (q) params.set('q', q);
  const grid = useQuery({
    queryKey: ['tier-grid', tierId, params.toString()],
    queryFn: () => api<TierGrid>(`/price-tiers/${tierId}/grid?${params}`),
    placeholderData: keepPreviousData,
  });

  const dirty = Object.keys(drafts).length;
  const tier = grid.data?.tier;

  function setDraft(itemId: string, draft: Draft | null) {
    setDrafts((current) => {
      const next = { ...current };
      if (draft) next[itemId] = draft;
      else delete next[itemId];
      return next;
    });
  }

  function discard() {
    setDrafts({});
    setVersion((v) => v + 1);
  }

  async function save() {
    const changes: TierPriceChanges['changes'] = [];
    for (const [itemId, draft] of Object.entries(drafts)) {
      if (draft.action === 'set') {
        if (draft.cents === null || (kind === 'DISH' && draft.cents === 0)) {
          toast.error(
            kind === 'DISH'
              ? 'Every typed dish price must be a valid amount above $0.00'
              : 'Every typed price must be a valid amount',
          );
          return;
        }
        changes.push({ itemType: kind, itemId, action: 'set', priceCents: draft.cents });
      } else {
        changes.push({ itemType: kind, itemId, action: draft.action });
      }
    }
    setSaving(true);
    try {
      await api(`/price-tiers/${tierId}/prices`, {
        method: 'PUT',
        body: JSON.stringify({ changes }),
      });
      toast.success(`Saved ${changes.length} price${changes.length === 1 ? '' : 's'}`);
      await queryClient.invalidateQueries({ queryKey: ['tier-grid'] });
      void queryClient.invalidateQueries({ queryKey: tiersQueryKey });
      discard();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not save the prices');
    } finally {
      setSaving(false);
    }
  }

  if (!canSeeMoney) {
    return (
      <p className="text-sm text-muted-foreground">
        Prices are hidden for your role. Ask an admin for money access.
      </p>
    );
  }

  const showBase = tier?.derivation === 'FROM_TIER';

  return (
    <div className="space-y-6">
      <Link
        href="/pricing"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden /> Price tiers
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">
            {tier?.name ?? 'Tier'}{' '}
            {tier?.isDefault && <Badge className="align-middle">Default</Badge>}
          </h1>
          {tier && (
            <p className="text-sm text-muted-foreground">
              {describeTier(tier)} · {tier.missingDishes} dish
              {tier.missingDishes === 1 ? '' : 'es'} and {tier.missingOptions} option
              {tier.missingOptions === 1 ? '' : 's'} without a price
            </p>
          )}
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            {dirty > 0 && (
              <Button variant="ghost" onClick={discard} disabled={saving}>
                Discard
              </Button>
            )}
            <Button onClick={() => void save()} disabled={dirty === 0 || saving}>
              {saving
                ? 'Saving…'
                : dirty > 0
                  ? `Save ${dirty} change${dirty === 1 ? '' : 's'}`
                  : 'Saved'}
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect
              aria-label="Items"
              value={kind}
              disabled={dirty > 0}
              onChange={(e) => setKind(e.target.value as Kind)}
            >
              <NativeSelectOption value="DISH">Dishes</NativeSelectOption>
              <NativeSelectOption value="OPTION">Options</NativeSelectOption>
            </NativeSelect>
            <Input
              className="max-w-xs"
              placeholder="Search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={missingOnly}
                onChange={(e) => setMissingOnly(e.target.checked)}
              />
              Missing only
            </label>
            {dirty > 0 && (
              <span className="text-xs text-muted-foreground">
                Save or discard to switch between dishes and options.
              </span>
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                {kind === 'DISH' && <TableHead>SKU</TableHead>}
                <TableHead>{kind === 'DISH' ? 'Dish' : 'Option'}</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                {showBase && (
                  <TableHead className="text-right">{tier?.baseTier?.name ?? 'Base'}</TableHead>
                )}
                <TableHead className="text-right">Derived</TableHead>
                <TableHead className="w-56">Typed price</TableHead>
                <TableHead className="text-right">Effective</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grid.data?.rows.map((row) => (
                <GridRow
                  key={`${row.itemId}:${version}`}
                  row={row}
                  kind={kind}
                  showBase={showBase}
                  draft={drafts[row.itemId]}
                  canManage={canManage}
                  onDraft={(d) => setDraft(row.itemId, d)}
                />
              ))}
              {grid.data?.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    {missingOnly ? 'Nothing is missing a price on this tier.' : 'No items match.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function GridRow({
  row,
  kind,
  showBase,
  draft,
  canManage,
  onDraft,
}: {
  row: TierGridRow;
  kind: Kind;
  showBase: boolean;
  draft: Draft | undefined;
  canManage: boolean;
  onDraft: (draft: Draft | null) => void;
}) {
  const savedCents = row.entry?.kind === 'SET' ? row.entry.priceCents : null;
  const excluded = draft ? draft.action === 'exclude' : row.entry?.kind === 'EXCLUDED';

  // Preview what the row will resolve to once saved.
  let effective: number | null = row.effectiveCents;
  let source: PriceSource = row.source;
  if (draft?.action === 'exclude') [effective, source] = [null, 'EXCLUDED'];
  if (draft?.action === 'clear')
    [effective, source] = [row.derivedCents, row.derivedCents === null ? 'MISSING' : 'DERIVED'];
  if (draft?.action === 'set') [effective, source] = [draft.cents, 'EXPLICIT'];

  const fmt = (cents: number | null) =>
    cents === null ? <span className="text-muted-foreground">-</span> : formatUsd(cents);

  return (
    <TableRow className={cn(draft && 'bg-amber-50 dark:bg-amber-950/30')}>
      {kind === 'DISH' && <TableCell className="font-mono text-xs">{row.sku}</TableCell>}
      <TableCell className="font-medium">{row.name}</TableCell>
      <TableCell className="text-right tabular-nums">{formatUsd(row.costCents)}</TableCell>
      {showBase && <TableCell className="text-right tabular-nums">{fmt(row.baseCents)}</TableCell>}
      <TableCell className="text-right tabular-nums">{fmt(row.derivedCents)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="w-28">
            <MoneyInput
              valueCents={savedCents}
              disabled={!canManage || excluded}
              onChangeCents={(cents, text) => {
                // Empty means "no typed price": remove the row if there is one, else nothing to do.
                if (text.trim() === '') onDraft(row.entry ? { action: 'clear' } : null);
                else if (cents !== null && cents === savedCents) onDraft(null);
                else onDraft({ action: 'set', cents });
              }}
            />
          </div>
          {canManage && (
            <label className="flex items-center gap-1 text-xs whitespace-nowrap">
              <input
                type="checkbox"
                className="size-3.5"
                checked={excluded}
                onChange={(e) =>
                  onDraft(
                    e.target.checked
                      ? { action: 'exclude' }
                      : row.entry?.kind === 'EXCLUDED'
                        ? { action: 'clear' }
                        : null,
                  )
                }
              />
              Not sold
            </label>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">{fmt(effective)}</TableCell>
      <TableCell>
        <Badge
          variant={
            source === 'MISSING' ? 'destructive' : source === 'EXPLICIT' ? 'default' : 'outline'
          }
        >
          {SOURCE_LABEL[source]}
        </Badge>
        {draft && <span className="ml-1 text-xs text-amber-700">unsaved</span>}
      </TableCell>
    </TableRow>
  );
}
