import { Body, Controller, type INestApplication, Post } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { createZodDto, ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiExceptionFilter } from '../src/common/api-exception.filter';
import { DomainError } from '../src/common/domain-error';
import { HealthController } from '../src/health/health.controller';
import { PrismaService } from '../src/prisma/prisma.service';

class EchoDto extends createZodDto(z.object({ quantity: z.number().int().positive() })) {}

@Controller('probe')
class ProbeController {
  @Post('echo')
  echo(@Body() body: EchoDto) {
    return body;
  }

  @Post('rule')
  rule() {
    throw new DomainError('QUANTITY_MISMATCH', 'Combination quantities must add up to 10.', {
      fieldErrors: { 'lines.0.quantity': ['6 + 3 = 9, expected 10'] },
    });
  }
}

describe('API skeleton', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController, ProbeController],
      providers: [
        // Unit-level test: no database. Readiness is exercised against Neon separately.
        { provide: PrismaService, useValue: { $queryRaw: async () => [{ '?column?': 1 }] } },
        { provide: APP_PIPE, useClass: ZodValidationPipe },
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health reports liveness', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body.ok).toBe(true);
  });

  it('GET /api/health/ready reports the database as up', async () => {
    const res = await request(app.getHttpServer()).get('/api/health/ready').expect(200);
    expect(res.body).toMatchObject({ ok: true, db: 'up' });
  });

  it('invalid input returns the 400 envelope with field paths', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/probe/echo')
      .send({ quantity: -2 })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.fieldErrors.quantity).toBeDefined();
  });

  it('a DomainError maps to its status and keeps field errors', async () => {
    const res = await request(app.getHttpServer()).post('/api/probe/rule').expect(422);
    expect(res.body.error).toMatchObject({
      code: 'QUANTITY_MISMATCH',
      status: 422,
      fieldErrors: { 'lines.0.quantity': ['6 + 3 = 9, expected 10'] },
    });
  });

  it('unknown routes use the same envelope', async () => {
    const res = await request(app.getHttpServer()).get('/api/nope').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
