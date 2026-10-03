import { bpsToMultiplier, bpsToPercent, type PriceTierDto } from '@fernleaf/shared';

/** "Cost × 2.4" · "Standard −10 %" · "Manual prices" */
export function describeTier(tier: Pick<PriceTierDto, 'derivation' | 'factorBps' | 'baseTier'>) {
  if (tier.derivation === 'MANUAL' || tier.factorBps === null) return 'Manual prices';
  if (tier.derivation === 'FROM_COST') return `Cost × ${bpsToMultiplier(tier.factorBps)}`;
  const pct = bpsToPercent(tier.factorBps);
  return `${tier.baseTier?.name ?? 'Base tier'} ${pct === '0' ? '±0' : pct} %`;
}

export const tiersQueryKey = ['price-tiers'] as const;
