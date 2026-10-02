import { KITCHEN_TIMEZONE } from '@fernleaf/shared';
import type { PrismaClient } from '../../src/generated/prisma/client';

/**
 * Platform settings singleton + the default price tier it points to (BR-PRC-06: exactly one
 * default tier, enforced by the required FK on the settings row).
 */
export async function seedPlatform(prisma: PrismaClient): Promise<void> {
  // Standard = cost × 2.4, rounded up to 5¢ (factor in basis points, ADR-005).
  const standard = await prisma.priceTier.upsert({
    where: { name: 'Standard' },
    update: {},
    create: {
      name: 'Standard',
      description: 'Default tier: cost × 2.4, rounded up to the next 5 cents',
      derivation: 'FROM_COST',
      factorBps: 24_000,
      sortOrder: 0,
    },
  });

  await prisma.platformSettings.upsert({
    where: { id: 1 },
    // Settings are admin-editable after the first seed: never overwrite them on re-seed.
    update: {},
    create: {
      id: 1,
      kitchenTimezone: KITCHEN_TIMEZONE,
      // A-02: the seeded kitchen runs 7 days so every review day (incl. weekends) has service.
      kitchenWorkingDays: [1, 2, 3, 4, 5, 6, 7],
      cutoffTimeMinutes: 16 * 60,
      cutoffWorkingDays: 2,
      defaultPriceTierId: standard.id,
    },
  });
  console.log('  platform settings + Standard tier');
}
