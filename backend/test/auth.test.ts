import { Controller, Get, Global, type INestApplication, Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { DEFAULT_ROLES } from '@fernleaf/shared';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AuthModule } from '../src/auth/auth.module';
import { AuthzModule } from '../src/authz/authz.module';
import { CheckPolicies } from '../src/authz/policies';
import { ApiExceptionFilter } from '../src/common/api-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

process.env.DATABASE_URL ??= 'postgresql://test:test@localhost/test';
process.env.JWT_SECRET ??= 'test-secret-that-is-long-enough-for-hs256-signing';

interface FakeUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  isActive: boolean;
  tokenVersion: number;
  role: { key: string; name: string; permissions: string[] };
}

/** In-memory stand-in for the two Prisma calls auth makes. */
class FakePrisma {
  users: FakeUser[] = [];
  user = {
    findUnique: async ({ where }: { where: { id?: string; email?: string } }) =>
      this.users.find((u) => u.id === where.id || u.email === where.email) ?? null,
    update: async () => undefined,
  };
}

@Controller('probe')
class ProbeController {
  @Get('create-order')
  @CheckPolicies((ability) => ability.can('create', 'Order'))
  createOrder() {
    return { ok: true };
  }

  @Get('money')
  @CheckPolicies((ability) => ability.can('read', 'Order'))
  money() {
    return { name: 'FL-000123', totalCents: 2450, lines: [{ dish: 'Bowl', unitPriceCents: 1225 }] };
  }
}

const prisma = new FakePrisma();

/** Stands in for the app's global PrismaModule. */
@Global()
@Module({ providers: [{ provide: PrismaService, useValue: prisma }], exports: [PrismaService] })
class FakePrismaModule {}
const role = (key: string) => {
  const r = DEFAULT_ROLES.find((x) => x.key === key);
  if (!r) throw new Error(key);
  return { key: r.key, name: r.name, permissions: [...r.permissions] };
};

describe('Auth and access control (FR-ACC-01..05, BR-ACC-01..03)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const signIn = async (email: string) => {
    const res = await http()
      .post('/api/auth/login')
      .send({ email, password: 'Test@1234' })
      .expect(200);
    const cookie = res.headers['set-cookie'] as unknown as string[];
    return cookie.map((c) => c.split(';')[0]).join('; ');
  };

  beforeAll(async () => {
    const hash = await bcrypt.hash('Test@1234', 4);
    prisma.users = ['admin', 'kitchen'].map((key) => ({
      id: `u-${key}`,
      email: `${key}@test.com`,
      name: key,
      passwordHash: hash,
      isActive: true,
      tokenVersion: 0,
      role: role(key),
    }));

    @Module({
      imports: [FakePrismaModule, AuthzModule, AuthModule],
      controllers: [ProbeController],
    })
    class TestAppModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [TestAppModule],
      providers: [
        { provide: APP_PIPE, useClass: ZodValidationPipe },
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    await app.init();
  });

  beforeEach(() => {
    for (const u of prisma.users) Object.assign(u, { isActive: true, tokenVersion: 0 });
  });

  afterAll(async () => {
    await app.close();
  });

  it('FR-ACC-01: signs in, sets an httpOnly SameSite=Lax session cookie and returns permissions', async () => {
    const res = await http()
      .post('/api/auth/login')
      .send({ email: 'Admin@Test.com', password: 'Test@1234' })
      .expect(200);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toContain('fl_session=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(res.body.role.key).toBe('admin');
    expect(res.body.permissions).toContain('orders.create');
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const wrong = await http()
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'nope' })
      .expect(401);
    const unknown = await http()
      .post('/api/auth/login')
      .send({ email: 'ghost@test.com', password: 'nope' })
      .expect(401);
    expect(wrong.body.error).toEqual(unknown.body.error);
  });

  it('rejects a malformed login with field errors', async () => {
    const res = await http().post('/api/auth/login').send({ email: 'nope' }).expect(400);
    expect(Object.keys(res.body.error.fieldErrors)).toEqual(
      expect.arrayContaining(['email', 'password']),
    );
  });

  it('requires a session: 401 without a cookie', async () => {
    const res = await http().get('/api/auth/me').expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('FR-ACC-03: the server enforces abilities, kitchen gets 403 where admin gets 200', async () => {
    const adminCookie = await signIn('admin@test.com');
    await http().get('/api/probe/create-order').set('Cookie', adminCookie).expect(200);
    const kitchenCookie = await signIn('kitchen@test.com');
    const res = await http()
      .get('/api/probe/create-order')
      .set('Cookie', kitchenCookie)
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('BR-ACC-03: kitchen never receives money fields, admin does', async () => {
    const kitchenCookie = await signIn('kitchen@test.com');
    const kitchen = await http().get('/api/probe/money').set('Cookie', kitchenCookie);
    expect(kitchen.body).toEqual({ name: 'FL-000123', lines: [{ dish: 'Bowl' }] });
    const adminCookie = await signIn('admin@test.com');
    const admin = await http().get('/api/probe/money').set('Cookie', adminCookie);
    expect(admin.body.totalCents).toBe(2450);
    expect(admin.body.lines[0].unitPriceCents).toBe(1225);
  });

  it('BR-ACC-02: deactivation and token-version bumps end existing sessions immediately', async () => {
    const cookie = await signIn('kitchen@test.com');
    await http().get('/api/auth/me').set('Cookie', cookie).expect(200);

    const kitchenUser = prisma.users.find((u) => u.email === 'kitchen@test.com');
    if (!kitchenUser) throw new Error('missing user');
    kitchenUser.tokenVersion = 1; // e.g. password reset
    await http().get('/api/auth/me').set('Cookie', cookie).expect(401);

    kitchenUser.tokenVersion = 0;
    kitchenUser.isActive = false;
    await http().get('/api/auth/me').set('Cookie', cookie).expect(401);
    await http()
      .post('/api/auth/login')
      .send({ email: 'kitchen@test.com', password: 'Test@1234' })
      .expect(401);
  });

  it('logout clears the cookie', async () => {
    const res = await http().post('/api/auth/logout').expect(204);
    expect(String(res.headers['set-cookie'])).toMatch(/fl_session=;/);
  });
});

describe('Fail-closed route check', () => {
  it('refuses to boot when a route has no access rule', async () => {
    @Controller('forgotten')
    class ForgottenController {
      @Get()
      open() {
        return 'oops';
      }
    }

    const moduleRef = await Test.createTestingModule({
      imports: [FakePrismaModule, AuthzModule],
      controllers: [ForgottenController],
    }).compile();
    const app = moduleRef.createNestApplication();
    await expect(app.init()).rejects.toThrow(/ForgottenController\.open/);
    await app.close().catch(() => undefined);
  });
});
