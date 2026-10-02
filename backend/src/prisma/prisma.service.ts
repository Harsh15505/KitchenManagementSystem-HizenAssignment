import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { loadEnv } from '../config/env';

/**
 * Prisma 7 talks to Postgres through the `pg` driver adapter. We use Neon's direct endpoint
 * with a small pool (the API is one long-running process, not serverless).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const adapter = new PrismaPg({
      connectionString: loadEnv().DATABASE_URL,
      max: 5,
      // Neon suspends idle compute after 5 minutes and drops connections. Recycle ours sooner.
      idleTimeoutMillis: 60_000,
    });
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    // Connect lazily: a sleeping Neon compute must not block API startup (the health check
    // stays DB-free). The first query wakes the database.
    this.logger.log('Prisma client ready (lazy connect)');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
