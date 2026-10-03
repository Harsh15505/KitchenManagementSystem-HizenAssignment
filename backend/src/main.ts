import 'dotenv/config';
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Behind Vercel → Render proxies: use X-Forwarded-For so the login rate limit sees real IPs.
  app.set('trust proxy', true);

  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  // Proof-of-delivery photos arrive as base64 JSON (compressed in the browser, ≤ 5 MB raw).
  app.useBodyParser('json', { limit: '8mb' });
  // Browsers reach us through the Next.js /api rewrite (same origin), so CORS stays off.
  app.enableShutdownHooks();

  await app.listen(env.PORT);
  Logger.log(`API listening on :${env.PORT} (${env.NODE_ENV})`, 'Bootstrap');
}

void bootstrap();
