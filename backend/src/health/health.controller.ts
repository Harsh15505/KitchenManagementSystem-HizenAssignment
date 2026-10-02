import { Controller, Get } from '@nestjs/common';

/**
 * Liveness only. This must never touch the database: the keep-alive monitor calls it every
 * 5 minutes, and a DB query here would stop Neon from scaling to zero (ADR-013).
 */
@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  @Get()
  liveness() {
    return {
      ok: true,
      uptimeS: Math.round((Date.now() - this.startedAt) / 1000),
    };
  }
}
