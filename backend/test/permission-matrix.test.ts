import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DEFAULT_ROLES } from '@fernleaf/shared';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

process.env.DATABASE_URL ??= 'postgresql://test:test@localhost/test';
process.env.JWT_SECRET ??= 'test-secret-that-is-long-enough-for-hs256-signing';

/**
 * T-210 / FR-ACC-03: boots the REAL AppModule (every controller, the global guard and the boot
 * check) and asserts who may call what. Prisma is faked: allowed requests may then fail inside
 * the service (500), which is fine here. We only assert that the guard let them through.
 */
type Role = 'admin' | 'kitchen' | 'dispatch' | 'driver';
const ROLES: readonly Role[] = ['admin', 'kitchen', 'dispatch', 'driver'];
const TIER_ID = '01a0ff3c-0000-7000-8000-000000000001';

const MATRIX: ReadonlyArray<{
  method: 'get' | 'post' | 'patch' | 'put';
  path: string;
  allowed: readonly Role[];
}> = [
  { method: 'get', path: '/api/auth/me', allowed: ROLES },
  { method: 'get', path: '/api/meta/clock', allowed: ROLES },
  { method: 'get', path: '/api/staff', allowed: ['admin'] },
  { method: 'post', path: '/api/staff', allowed: ['admin'] },
  { method: 'get', path: '/api/roles', allowed: ['admin'] },
  { method: 'get', path: '/api/settings', allowed: ['admin'] },
  { method: 'patch', path: '/api/settings', allowed: ['admin'] },
  { method: 'get', path: '/api/settings/kitchen-holidays', allowed: ['admin'] },
  { method: 'get', path: '/api/reference/allergens', allowed: ['admin', 'kitchen', 'dispatch'] },
  { method: 'post', path: '/api/reference/allergens', allowed: ['admin'] },
  { method: 'get', path: '/api/dishes', allowed: ['admin', 'kitchen'] },
  { method: 'post', path: '/api/dishes', allowed: ['admin'] },
  { method: 'get', path: '/api/options', allowed: ['admin', 'kitchen'] },
  { method: 'get', path: '/api/price-tiers', allowed: ['admin'] },
  { method: 'post', path: '/api/price-tiers', allowed: ['admin'] },
  { method: 'put', path: `/api/price-tiers/${TIER_ID}/prices`, allowed: ['admin'] },
  { method: 'get', path: '/api/menu/categories', allowed: ['admin'] },
  { method: 'post', path: '/api/menu/categories', allowed: ['admin'] },
  { method: 'put', path: '/api/menu/categories/order', allowed: ['admin'] },
  { method: 'get', path: `/api/menu/for-employee/${TIER_ID}`, allowed: ['admin'] },
  { method: 'get', path: '/api/orders', allowed: ['admin', 'kitchen', 'dispatch'] },
  { method: 'post', path: '/api/orders', allowed: ['admin'] },
  { method: 'post', path: '/api/orders/quote', allowed: ['admin'] },
  { method: 'get', path: '/api/cutoff', allowed: ['admin'] },
  { method: 'post', path: '/api/cutoff/run', allowed: ['admin'] },
  { method: 'post', path: '/api/demo/regenerate', allowed: ['admin'] },
  { method: 'get', path: '/api/kitchen/board', allowed: ['admin', 'kitchen', 'dispatch'] },
  { method: 'get', path: '/api/dispatch/board', allowed: ['admin', 'dispatch'] },
  { method: 'post', path: `/api/dispatch/drops/${TIER_ID}/out`, allowed: ['admin', 'dispatch'] },
  { method: 'get', path: '/api/driver/drops', allowed: ['admin', 'dispatch', 'driver'] },
  {
    method: 'post',
    path: `/api/dispatch/drops/${TIER_ID}/delivered`,
    allowed: ['admin', 'dispatch'],
  },
  { method: 'post', path: `/api/kitchen/units/${TIER_ID}/done`, allowed: ['admin', 'kitchen'] },
  { method: 'post', path: `/api/kitchen/orders/${TIER_ID}/force-complete`, allowed: ['admin'] },
  { method: 'get', path: '/api/companies', allowed: ['admin', 'dispatch'] },
  { method: 'get', path: '/api/companies/driver-options', allowed: ['admin', 'dispatch'] },
  { method: 'post', path: '/api/companies', allowed: ['admin'] },
  { method: 'get', path: '/api/employees', allowed: ['admin'] },
  { method: 'post', path: '/api/employees', allowed: ['admin'] },
];

const users = new Map<
  string,
  {
    id: string;
    email: string;
    name: string;
    passwordHash: string;
    isActive: boolean;
    tokenVersion: number;
    role: { key: string; name: string; permissions: string[] };
  }
>();
const knownModels = {
  user: {
    findUnique: async ({ where }: { where: { id?: string; email?: string } }) =>
      [...users.values()].find((u) => u.id === where.id || u.email === where.email) ?? null,
    update: async () => undefined,
  },
};
/**
 * Any other model call fails when awaited. Like real Prisma queries these are lazy thenables, so
 * a query built but never awaited (e.g. inside a $transaction array) doesn't reject on its own.
 */
const failing = () => ({
  then: (_ok: unknown, fail: (e: Error) => void) => fail(new Error('not in the fake')),
});
const rejecting = new Proxy({}, { get: () => failing });
const fakePrisma = new Proxy(knownModels, {
  get: (target, prop: string) => (prop in target ? target[prop as keyof typeof target] : rejecting),
});

describe('Permission matrix on the real application (FR-ACC-03)', () => {
  let app: INestApplication;
  const cookies = new Map<Role, string>();

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash('Test@1234', 4);
    for (const role of DEFAULT_ROLES) {
      users.set(role.key, {
        id: `u-${role.key}`,
        email: `${role.key}@test.com`,
        name: role.name,
        passwordHash,
        isActive: true,
        tokenVersion: 0,
        role: { key: role.key, name: role.name, permissions: [...role.permissions] },
      });
    }

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(fakePrisma)
      .compile();
    // Allowed calls fail inside the fake Prisma (500) by design; silence those expected logs.
    app = moduleRef.createNestApplication({ logger: false });
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    await app.init(); // also proves every real route declares an access rule (boot check)

    for (const role of ROLES) {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: `${role}@test.com`, password: 'Test@1234' })
        .expect(200);
      cookies.set(role, (res.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  for (const route of MATRIX) {
    for (const role of ROLES) {
      const allowed = route.allowed.includes(role);
      it(`${route.method.toUpperCase()} ${route.path} → ${role} ${allowed ? 'allowed' : '403'}`, async () => {
        const call = request(app.getHttpServer())[route.method];
        const res = await call(route.path).set('Cookie', cookies.get(role)!).send({});
        if (allowed) expect([401, 403]).not.toContain(res.status);
        else expect(res.status).toBe(403);
      });
    }
  }

  it('every protected route rejects anonymous callers with 401', async () => {
    for (const route of MATRIX) {
      const call = request(app.getHttpServer())[route.method];
      const res = await call(route.path).send({});
      expect(res.status, `${route.method} ${route.path}`).toBe(401);
    }
  });
});
