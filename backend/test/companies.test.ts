import { describe, expect, it } from 'vitest';
import { CompaniesService } from '../src/companies/companies.service';
import { EmployeesService } from '../src/companies/employees.service';
import { DomainError } from '../src/common/domain-error';
import type { PrismaService } from '../src/prisma/prisma.service';

const LUMEN = '00000000-0000-4000-8000-0000000000a1';
const NORTHWIND = '00000000-0000-4000-8000-0000000000a2';

const employeeRow = (id: string, isOwner: boolean) => ({
  id,
  name: isOwner ? 'Priya Gupta' : 'Arjun Chopra',
  email: `${id}@lumenlabs.example`,
  phone: null,
  canChooseAddress: false,
  canChangeDeliveryTime: false,
  canChangePackaging: false,
  isActive: true,
  company: { id: LUMEN, name: 'Lumen Labs' },
  ownerOf: isOwner ? { id: LUMEN } : null,
  allergies: [],
  dietaryPreferences: [],
});

/** In-memory double for the calls the services make; records writes so tests can assert none happened. */
function fakePrisma() {
  const writes: string[] = [];
  const domains: Record<string, string[]> = {
    [LUMEN]: ['lumenlabs.example'],
    [NORTHWIND]: ['northwind.example'],
  };
  const prisma = {
    employee: {
      findUnique: async ({ where }: { where: { id?: string; email?: string } }) =>
        where.id === 'owner'
          ? employeeRow('owner', true)
          : where.id
            ? employeeRow(where.id, false)
            : null,
      update: async () => {
        writes.push('employee.update');
        return {};
      },
    },
    company: {
      findUnique: async ({ where }: { where: { id: string } }) => ({
        name: where.id === LUMEN ? 'Lumen Labs' : 'Northwind Traders',
        domains: (domains[where.id] ?? []).map((domain) => ({ domain })),
      }),
      findFirst: async () => null,
    },
    publicEmailDomain: {
      findUnique: async ({ where }: { where: { domain: string } }) =>
        where.domain === 'gmail.com' ? { domain: 'gmail.com' } : null,
    },
    companyDomain: {
      findUnique: async ({ where }: { where: { domain: string } }) =>
        where.domain === 'northwind.example' ? { companyId: NORTHWIND } : null,
    },
    packagingType: { findUnique: async () => ({ isActive: true }) },
    priceTier: { findUnique: async () => ({ id: 't' }) },
    $transaction: async () => {
      writes.push('transaction');
    },
  };
  return { prisma: prisma as unknown as PrismaService, writes };
}

async function errorCode(run: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await run();
  } catch (error) {
    if (error instanceof DomainError) return error.code;
    throw error;
  }
  return undefined;
}

describe('Employees (FR-EMP-02, BR-EMP-01/02)', () => {
  it('BR-EMP-02 a company owner cannot be moved', async () => {
    const { prisma, writes } = fakePrisma();
    const service = new EmployeesService(prisma);
    expect(
      await errorCode(() =>
        service.move('owner', { companyId: NORTHWIND, email: 'priya@northwind.example' }),
      ),
    ).toBe('OWNER_CANNOT_MOVE');
    expect(writes).toEqual([]);
  });

  it('BR-EMP-02 a company owner cannot be deactivated', async () => {
    const { prisma, writes } = fakePrisma();
    expect(
      await errorCode(() => new EmployeesService(prisma).update('owner', { isActive: false })),
    ).toBe('OWNER_CANNOT_MOVE');
    expect(writes).toEqual([]);
  });

  it('BR-EMP-01 a move needs an email on the new company domain', async () => {
    const { prisma, writes } = fakePrisma();
    expect(
      await errorCode(() =>
        new EmployeesService(prisma).move('arjun', {
          companyId: NORTHWIND,
          email: 'arjun@lumenlabs.example',
        }),
      ),
    ).toBe('EMAIL_DOMAIN_MISMATCH');
    expect(writes).toEqual([]);
  });
});

describe('Company creation (A-29, BR-CMP-01)', () => {
  const input = {
    name: 'Acme',
    priceTierId: null,
    billingContactName: 'A B',
    billingEmail: 'ap@acme.example',
    billingPhone: null,
    billingAddress: '',
    workingDays: [1, 2, 3, 4, 5],
    defaultDeliveryTimeMinutes: 750,
    dispatchLeadMinutes: 60,
    defaultPackagingTypeId: '00000000-0000-4000-8000-0000000000b1',
    driverInstructions: '',
    defaultDriverId: null,
    address: {
      label: 'HQ',
      line1: '1 Road',
      line2: '',
      city: 'Pune',
      postalCode: '411001',
      accessNotes: '',
    },
    owner: { name: 'Owner', email: 'owner@acme.example', phone: null },
  };

  it('BR-CMP-01 refuses a public email domain before opening the transaction', async () => {
    const { prisma, writes } = fakePrisma();
    const service = new CompaniesService(prisma);
    expect(
      await errorCode(() =>
        service.create({
          ...input,
          domain: 'gmail.com',
          owner: { ...input.owner, email: 'o@gmail.com' },
        }),
      ),
    ).toBe('PUBLIC_EMAIL_DOMAIN');
    expect(writes).toEqual([]);
  });

  it('BR-CMP-01 refuses a domain another company holds', async () => {
    const { prisma, writes } = fakePrisma();
    expect(
      await errorCode(() =>
        new CompaniesService(prisma).create({
          ...input,
          domain: 'northwind.example',
          owner: { ...input.owner, email: 'o@northwind.example' },
        }),
      ),
    ).toBe('DOMAIN_TAKEN');
    expect(writes).toEqual([]);
  });

  it('A-29 the owner email must be on the company domain', async () => {
    const { prisma, writes } = fakePrisma();
    expect(
      await errorCode(() =>
        new CompaniesService(prisma).create({
          ...input,
          domain: 'acme.example',
          owner: { ...input.owner, email: 'o@other.example' },
        }),
      ),
    ).toBe('EMAIL_DOMAIN_MISMATCH');
    expect(writes).toEqual([]);
  });
});
