'use client';

import {
  bpsToMultiplier,
  bpsToPercent,
  multiplierToBps,
  percentToBps,
  type PriceTierDto,
  priceTierInputSchema,
} from '@fernleaf/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { RequireAbility } from '@/components/require-ability';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
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
import { describeTier, tiersQueryKey } from '@/lib/pricing';

export default function PricingPage() {
  return (
    <RequireAbility action="read" subject="Pricing">
      <TierList />
    </RequireAbility>
  );
}

function TierList() {
  const canManage = useAbility().can('manage', 'Pricing');
  const queryClient = useQueryClient();
  const tiers = useQuery({
    queryKey: tiersQueryKey,
    queryFn: () => api<PriceTierDto[]>('/price-tiers'),
  });
  const [editing, setEditing] = useState<PriceTierDto | 'new' | null>(null);

  async function act(run: () => Promise<unknown>, ok: string) {
    try {
      await run();
      toast.success(ok);
      void queryClient.invalidateQueries({ queryKey: tiersQueryKey });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Something went wrong');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Price tiers</h1>
          <p className="text-sm text-muted-foreground">
            Each company orders on one tier (the default if it has none). A dish with no price on a
            tier is hidden from that tier&apos;s employees.
          </p>
        </div>
        {canManage && editing === null && (
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" aria-hidden /> New tier
          </Button>
        )}
      </div>

      {editing !== null && (
        <TierForm
          key={editing === 'new' ? 'new' : editing.id}
          tier={editing === 'new' ? undefined : editing}
          tiers={tiers.data ?? []}
          onClose={() => setEditing(null)}
        />
      )}

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tier</TableHead>
                <TableHead>Prices come from</TableHead>
                <TableHead>Companies</TableHead>
                <TableHead>Missing prices</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiers.data?.map((tier) => (
                <TableRow key={tier.id}>
                  <TableCell>
                    <Link href={`/pricing/${tier.id}`} className="font-medium hover:underline">
                      {tier.name}
                    </Link>
                    {tier.isDefault && <Badge className="ml-2">Default</Badge>}
                    {tier.description && (
                      <p className="text-xs text-muted-foreground">{tier.description}</p>
                    )}
                  </TableCell>
                  <TableCell>{describeTier(tier)}</TableCell>
                  <TableCell>{tier.companyCount}</TableCell>
                  <TableCell className="space-x-1">
                    {tier.missingDishes + tier.missingOptions === 0 ? (
                      <span className="text-sm text-muted-foreground">None</span>
                    ) : (
                      <>
                        {tier.missingDishes > 0 && (
                          <Badge variant="destructive">
                            {tier.missingDishes} dish{tier.missingDishes === 1 ? '' : 'es'}
                          </Badge>
                        )}
                        {tier.missingOptions > 0 && (
                          <Badge variant="outline">
                            {tier.missingOptions} option{tier.missingOptions === 1 ? '' : 's'}
                          </Badge>
                        )}
                      </>
                    )}
                  </TableCell>
                  <TableCell className="space-x-1 text-right whitespace-nowrap">
                    <Link
                      href={`/pricing/${tier.id}`}
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    >
                      Prices
                    </Link>
                    {canManage && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => setEditing(tier)}>
                          Edit
                        </Button>
                        {!tier.isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              void act(
                                () =>
                                  api(`/price-tiers/${tier.id}/make-default`, { method: 'POST' }),
                                `${tier.name} is now the default tier`,
                              )
                            }
                          >
                            Make default
                          </Button>
                        )}
                        {!tier.isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (window.confirm(`Delete the ${tier.name} tier and its prices?`))
                                void act(
                                  () => api(`/price-tiers/${tier.id}`, { method: 'DELETE' }),
                                  `${tier.name} deleted`,
                                );
                            }}
                          >
                            Delete
                          </Button>
                        )}
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

type Derivation = PriceTierDto['derivation'];

/** FR-PRC-05: staff type "2.4" (× cost) or "-10" (% of another tier); stored as basis points. */
function TierForm({
  tier,
  tiers,
  onClose,
}: {
  tier?: PriceTierDto;
  tiers: PriceTierDto[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(tier?.name ?? '');
  const [description, setDescription] = useState(tier?.description ?? '');
  const [derivation, setDerivation] = useState<Derivation>(tier?.derivation ?? 'FROM_TIER');
  const [multiplier, setMultiplier] = useState(
    tier?.derivation === 'FROM_COST' && tier.factorBps ? bpsToMultiplier(tier.factorBps) : '2.4',
  );
  const [percent, setPercent] = useState(
    tier?.derivation === 'FROM_TIER' && tier.factorBps ? bpsToPercent(tier.factorBps) : '-10',
  );
  const defaultBase = tiers.find((t) => t.isDefault && t.id !== tier?.id)?.id ?? '';
  const [baseTierId, setBaseTierId] = useState(tier?.baseTier?.id ?? defaultBase);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const factorBps =
      derivation === 'MANUAL'
        ? null
        : derivation === 'FROM_COST'
          ? multiplierToBps(multiplier)
          : percentToBps(percent);
    if (derivation !== 'MANUAL' && factorBps === null) {
      setError(
        derivation === 'FROM_COST'
          ? 'Enter a multiplier such as 2.4'
          : 'Enter a percent change such as -10 or +15',
      );
      return;
    }
    const parsed = priceTierInputSchema.safeParse({
      name,
      description,
      derivation,
      factorBps,
      baseTierId: derivation === 'FROM_TIER' ? baseTierId || null : null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api(tier ? `/price-tiers/${tier.id}` : '/price-tiers', {
        method: tier ? 'PATCH' : 'POST',
        body: JSON.stringify(parsed.data),
      });
      toast.success(tier ? 'Tier saved' : 'Tier created');
      void queryClient.invalidateQueries({ queryKey: tiersQueryKey });
      void queryClient.invalidateQueries({ queryKey: ['tier-grid'] });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the tier');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tier ? `Edit ${tier.name}` : 'New tier'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="tier-name">Name</Label>
              <Input id="tier-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tier-desc">Description</Label>
              <Input
                id="tier-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tier-derivation">Prices come from</Label>
              <NativeSelect
                id="tier-derivation"
                className="w-full"
                value={derivation}
                onChange={(e) => setDerivation(e.target.value as Derivation)}
              >
                <NativeSelectOption value="FROM_TIER">Another tier ± percent</NativeSelectOption>
                <NativeSelectOption value="FROM_COST">Cost × multiplier</NativeSelectOption>
                <NativeSelectOption value="MANUAL">Typed by hand only</NativeSelectOption>
              </NativeSelect>
            </div>
            {derivation === 'FROM_COST' && (
              <div className="space-y-1">
                <Label htmlFor="tier-mult">Multiplier (× cost)</Label>
                <Input
                  id="tier-mult"
                  inputMode="decimal"
                  value={multiplier}
                  onChange={(e) => setMultiplier(e.target.value)}
                />
              </div>
            )}
            {derivation === 'FROM_TIER' && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="tier-base">Base tier</Label>
                  <NativeSelect
                    id="tier-base"
                    className="w-full"
                    value={baseTierId}
                    onChange={(e) => setBaseTierId(e.target.value)}
                  >
                    <NativeSelectOption value="">Choose…</NativeSelectOption>
                    {tiers
                      .filter((t) => t.id !== tier?.id)
                      .map((t) => (
                        <NativeSelectOption key={t.id} value={t.id}>
                          {t.name}
                        </NativeSelectOption>
                      ))}
                  </NativeSelect>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tier-pct">Change (%)</Label>
                  <Input
                    id="tier-pct"
                    inputMode="decimal"
                    value={percent}
                    onChange={(e) => setPercent(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {derivation === 'MANUAL'
              ? 'Only prices typed on the tier grid count. Anything left blank is hidden from employees on this tier.'
              : 'Derived prices round up to the next 5¢. Prices typed on the grid override them exactly as typed.'}
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save tier'}
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
