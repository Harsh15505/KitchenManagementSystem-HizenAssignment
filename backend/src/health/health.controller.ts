import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liveness only. This must never touch the database: the keep-alive monitor calls it every
   * 5 minutes, and a DB query here would stop Neon from scaling to zero (ADR-013).
   */
  @Get()
  liveness() {
    return { ok: true, uptimeS: Math.round((Date.now() - this.startedAt) / 1000) };
  }

  /** Readiness: proves the API can reach Postgres. Not used by the keep-alive monitor. */
  @Get('ready')
  async readiness() {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('Database is unreachable');
    }
    return { ok: true, db: 'up', latencyMs: Date.now() - started };
  }
}
