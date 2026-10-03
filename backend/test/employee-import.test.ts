import { describe, expect, it } from 'vitest';
import { EmployeesService } from '../src/companies/employees.service';
import type { PrismaService } from '../src/prisma/prisma.service';

const LUMEN = '00000000-0000-4000-8000-0000000000a1';
const PEANUTS = '00000000-0000-4000-8000-0000000000b1';

/** Lumen Labs on lumenlabs.example; taken@lumenlabs.example already exists. */
function fakePrisma() {
  const created: Array<{ email: string; allergies: unknown }> = [];
  const prisma = {
    company: {
      findUnique: async () => ({
        id: LUMEN,
        name: 'Lumen Labs',
        domains: [{ domain: 'lumenlabs.example' }],
      }),
    },
    allergen: { findMany: async () => [{ id: PEANUTS, name: 'Peanuts' }] },
    dietaryTag: { findMany: async () => [] },
    employee: {
      findUnique: async ({ where }: { where: { email: string } }) =>
        where.email === 'taken@lumenlabs.example' ? { id: 'other' } : null,
      create: async ({ data }: { data: { email: string; allergies: unknown } }) => {
        created.push({ email: data.email, allergies: data.allergies });
        return {
          id: `e-${created.length}`,
          name: 'x',
          email: data.email,
          phone: null,
          canChooseAddress: false,
          canChangeDeliveryTime: false,
          canChangePackaging: false,
          isActive: true,
          company: { id: LUMEN, name: 'Lumen Labs' },
          ownerOf: null,
          allergies: [],
          dietaryPreferences: [],
        };
      },
    },
  };
  return { prisma: prisma as unknown as PrismaService, created };
}

describe('Employee CSV import (FR-EMP-03)', () => {
  it('FR-EMP-03 creates the valid rows and reports the rest by row and column', async () => {
    const { prisma, created } = fakePrisma();
    const csv = [
      'name,email,allergies',
      'Asha Rao,asha@lumenlabs.example,peanuts',
      'Wrong Domain,wrong@gmail.com,',
      'Already Here,taken@lumenlabs.example,',
      'X,bad,',
    ].join('\n');
    const result = await new EmployeesService(prisma).importCsv(LUMEN, csv);

    expect(created.map((c) => c.email)).toEqual(['asha@lumenlabs.example']);
    expect(created[0]!.allergies).toEqual({ create: [{ allergenId: PEANUTS }] });
    expect(result.created).toBe(1);
    expect(result.failed.map((f) => [f.row, f.column])).toEqual([
      [3, 'email'],
      [4, 'email'],
      [5, 'name'],
      [5, 'email'],
    ]);
    expect(result.failed[0]!.message).toContain('@lumenlabs.example');
    expect(result.failed[1]!.message).toContain('already used');
  });
});
