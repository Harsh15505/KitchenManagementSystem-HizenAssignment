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

const MATRIX: ReadonlyArray<{
  method: 'get' | 'post' | 'patch';
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
const fakePrisma = {
  user: {
    findUnique: async ({ where }: { where: { id?: string; email?: string } }) =>
      [...users.values()].find((u) => u.id === where.id || u.email === where.email) ?? null,
    update: async () => undefined,
  },
};

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
