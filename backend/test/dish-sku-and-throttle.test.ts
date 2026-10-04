import { ThrottlerException } from '@nestjs/throttler';
import type { ArgumentsHost } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { DishesService } from '../src/catalogue/dishes.service';
import { ApiExceptionFilter } from '../src/common/api-exception.filter';
import type { PrismaService } from '../src/prisma/prisma.service';

const input = {
  name: 'Paneer Wrap',
  description: '',
  imageUrl: null,
  temperature: 'HOT' as const,
  costPriceCents: 150,
  kitchenStationId: null,
  minOrderQty: null,
  allergenIds: [],
  dietaryTagIds: [],
};

/** Existing dishes hold FL-PAN-001 and FL-PAN-004; `collide` makes the first N creates lose a race. */
function fakePrisma(collide = 0) {
  const created: string[] = [];
  let losses = collide;
  const prisma = {
    dish: {
      findMany: async () => [
        { sku: 'FL-PAN-001' },
        { sku: 'FL-PAN-004' },
        ...created.map((sku) => ({ sku })),
      ],
      findUnique: async ({ where }: { where: { id?: string; sku?: string } }) =>
        where.sku === 'FL-TAKEN-001' ? { id: 'x' } : where.id ? detailRow(where.id) : null,
      create: async ({ data }: { data: { sku: string } }) => {
        if (losses-- > 0) throw Object.assign(new Error('unique'), { code: 'P2002' });
        created.push(data.sku);
        return { id: data.sku };
      },
    },
  };
  return { prisma: prisma as unknown as PrismaService, created };
}

const detailRow = (id: string) => ({
  id,
  sku: id,
  name: 'Paneer Wrap',
  description: '',
  imageUrl: null,
  temperature: 'HOT',
  costPriceCents: 150,
  isActive: true,
  minOrderQty: null,
  kitchenStation: null,
  allergens: [],
  dietaryTags: [],
  optionGroups: [],
  _count: { optionGroups: 0, menuItems: 0 },
});

describe('Dish SKU (FR-CAT-01)', () => {
  it('FR-CAT-01 a blank SKU is generated after the highest number for the name prefix', async () => {
    const { prisma, created } = fakePrisma();
    await new DishesService(prisma).create(input);
    expect(created).toEqual(['FL-PAN-005']);
  });

  it('FR-CAT-01 two dishes created at once: the loser retries with the next number', async () => {
    const { prisma, created } = fakePrisma(1);
    await new DishesService(prisma).create(input);
    expect(created).toEqual(['FL-PAN-005']);
  });

  it('FR-CAT-01 a typed SKU is kept, and a taken one is refused with a field error', async () => {
    const { prisma, created } = fakePrisma();
    const service = new DishesService(prisma);
    await service.create({ ...input, sku: 'FL-OWN-001' });
    expect(created).toEqual(['FL-OWN-001']);
    await expect(service.create({ ...input, sku: 'FL-TAKEN-001' })).rejects.toMatchObject({
      code: 'UNIQUE_VIOLATION',
    });
  });
});

describe('Rate limiting message (BUG-014)', () => {
  it('BUG-014 a throttled request gets a plain-language 429, not "ThrottlerException"', () => {
    let status = 0;
    let body: { error: { code: string; message: string; status: number } } | undefined;
    const res = {
      status(s: number) {
        status = s;
        return this;
      },
      json(b: typeof body) {
        body = b;
      },
    };
    const host = { switchToHttp: () => ({ getResponse: () => res }) } as unknown as ArgumentsHost;
    new ApiExceptionFilter().catch(new ThrottlerException(), host);

    expect(status).toBe(429);
    expect(body?.error.code).toBe('RATE_LIMITED');
    expect(body?.error.message).toMatch(/too quickly.*try again in a minute/i);
    expect(body?.error.message).not.toMatch(/ThrottlerException/);
  });
});
