import { randomBytes } from 'node:crypto';
import { DEFAULT_ROLES } from '@fernleaf/shared';
import bcrypt from 'bcryptjs';
import type { PrismaClient } from '../../src/generated/prisma/client';

/** The brief requires these exact credentials on the live app (PRD §2.1). */
const REVIEWER_PASSWORD = 'Test@1234';

interface StaffSeed {
  email: string;
  name: string;
  roleKey: string;
  /** Reviewer accounts get the documented password, re-asserted on every seed. */
  reviewer: boolean;
}

const STAFF: readonly StaffSeed[] = [
  { email: 'admin@test.com', name: 'Asha Rao', roleKey: 'admin', reviewer: true },
  { email: 'kitchen@test.com', name: 'Vikram Nair', roleKey: 'kitchen', reviewer: true },
  { email: 'dispatch@test.com', name: 'Neha Kapoor', roleKey: 'dispatch', reviewer: true },
  { email: 'driver@test.com', name: 'Ravi Kumar', roleKey: 'driver', reviewer: true },
  // Extra staff make driver assignment and the kitchen realistic. Not for sign-in.
  {
    email: 'imran.driver@fernleaf.example',
    name: 'Imran Shaikh',
    roleKey: 'driver',
    reviewer: false,
  },
  {
    email: 'deepa.driver@fernleaf.example',
    name: 'Deepa Menon',
    roleKey: 'driver',
    reviewer: false,
  },
  {
    email: 'sunita.cook@fernleaf.example',
    name: 'Sunita Das',
    roleKey: 'kitchen',
    reviewer: false,
  },
];

export async function seedAccess(prisma: PrismaClient): Promise<void> {
  const roleIds = new Map<string, string>();
  for (const role of DEFAULT_ROLES) {
    const saved = await prisma.role.upsert({
      where: { key: role.key },
      update: {
        name: role.name,
        description: role.description,
        permissions: [...role.permissions],
      },
      create: {
        key: role.key,
        name: role.name,
        description: role.description,
        permissions: [...role.permissions],
        isSystem: true,
      },
    });
    roleIds.set(role.key, saved.id);
  }

  const reviewerHash = await bcrypt.hash(REVIEWER_PASSWORD, 10);
  for (const staff of STAFF) {
    const roleId = roleIds.get(staff.roleKey);
    if (!roleId) throw new Error(`Unknown role ${staff.roleKey}`);
    const existing = await prisma.user.findUnique({ where: { email: staff.email } });

    if (existing) {
      await prisma.user.update({
        where: { email: staff.email },
        data: staff.reviewer
          ? { name: staff.name, roleId, isActive: true, passwordHash: reviewerHash }
          : { name: staff.name, roleId },
      });
    } else {
      const passwordHash = staff.reviewer
        ? reviewerHash
        : await bcrypt.hash(randomBytes(18).toString('base64url'), 10);
      await prisma.user.create({
        data: { email: staff.email, name: staff.name, roleId, passwordHash },
      });
    }
  }
  console.log(`  ${DEFAULT_ROLES.length} roles, ${STAFF.length} staff (4 reviewer accounts)`);
}
