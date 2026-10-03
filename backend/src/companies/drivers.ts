import type { DriverOption } from '@fernleaf/shared';
import { DomainError } from '../common/domain-error';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * BR-CMP-03: a driver is an active staff user whose role grants `delivery.perform`. Checked by
 * permission code, never by role name. Shared by companies (default driver) and dispatch (drops).
 */
export async function listDrivers(prisma: PrismaService): Promise<DriverOption[]> {
  return prisma.user.findMany({
    where: { isActive: true, role: { permissions: { has: 'delivery.perform' } } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true },
  });
}

export async function assertDriver(prisma: PrismaService, userId: string): Promise<void> {
  const driver = await prisma.user.findFirst({
    where: { id: userId, isActive: true, role: { permissions: { has: 'delivery.perform' } } },
    select: { id: true },
  });
  if (!driver)
    throw new DomainError('DRIVER_REQUIRED', 'Choose an active staff member who can deliver.', {
      fieldErrors: { defaultDriverId: ['Not an active driver'] },
    });
}
