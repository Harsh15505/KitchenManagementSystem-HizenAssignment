import { describe, expect, it } from 'vitest';
import { DomainError } from '../src/common/domain-error';
import type { PrismaService } from '../src/prisma/prisma.service';
import { StaffService } from '../src/staff/staff.service';

const ADMIN_ROLE = '00000000-0000-4000-8000-000000000001';
const KITCHEN_ROLE = '00000000-0000-4000-8000-000000000002';

/** Minimal in-memory Prisma double for the calls StaffService.update makes. */
function fakePrisma(users: Record<string, { roleId: string; isActive: boolean }>) {
  const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
  const prisma = {
    role: { findUnique: async ({ where }: { where: { id: string } }) => ({ id: where.id }) },
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => users[where.id] ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        updates.push({ id: where.id, data });
        return {
          id: where.id,
          name: 'x',
          email: 'x@test.com',
          phone: null,
          isActive: true,
          lastLoginAt: null,
          role: { id: ADMIN_ROLE, key: 'k', name: 'n' },
        };
      },
    },
  };
  return { prisma: prisma as unknown as PrismaService, updates };
}

describe('Staff management rules (FR-ACC-02, BR-ACC-02)', () => {
  const users = {
    me: { roleId: ADMIN_ROLE, isActive: true },
    cook: { roleId: KITCHEN_ROLE, isActive: true },
  };

  it('an admin cannot deactivate their own account', async () => {
    const { prisma } = fakePrisma(users);
    await expect(new StaffService(prisma).update('me', 'me', { isActive: false })).rejects.toThrow(
      DomainError,
    );
  });

  it('an admin cannot change their own role', async () => {
    const { prisma } = fakePrisma(users);
    await expect(
      new StaffService(prisma).update('me', 'me', { roleId: KITCHEN_ROLE }),
    ).rejects.toThrow('You cannot change your own role.');
  });

  it('re-saving your own unchanged role is allowed', async () => {
    const { prisma, updates } = fakePrisma(users);
    await new StaffService(prisma).update('me', 'me', { roleId: ADMIN_ROLE, name: 'Asha R.' });
    expect(updates[0]?.data.tokenVersion).toBeUndefined();
  });

  it('changing someone else’s role ends their sessions (token version bump)', async () => {
    const { prisma, updates } = fakePrisma(users);
    await new StaffService(prisma).update('me', 'cook', { roleId: ADMIN_ROLE });
    expect(updates[0]?.data.tokenVersion).toEqual({ increment: 1 });
  });

  it('deactivating someone ends their sessions; a rename does not', async () => {
    const { prisma, updates } = fakePrisma(users);
    const service = new StaffService(prisma);
    await service.update('me', 'cook', { isActive: false });
    await service.update('me', 'cook', { name: 'Sunita D.' });
    expect(updates[0]?.data.tokenVersion).toEqual({ increment: 1 });
    expect(updates[1]?.data.tokenVersion).toBeUndefined();
  });
});
