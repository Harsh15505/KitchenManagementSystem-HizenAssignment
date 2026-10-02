import 'dotenv/config';
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  // Browsers reach us through the Next.js /api rewrite (same origin), so CORS stays off.
  app.enableShutdownHooks();

  await app.listen(env.PORT);
  Logger.log(`API listening on :${env.PORT} (${env.NODE_ENV})`, 'Bootstrap');
}

void bootstrap();
