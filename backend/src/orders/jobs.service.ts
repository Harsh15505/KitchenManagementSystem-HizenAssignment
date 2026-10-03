import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { loadEnv } from '../config/env';
import { ClockService } from '../clock/clock.service';
import { PrismaService } from '../prisma/prisma.service';
import { CutoffService } from './cutoff.service';

const MAX_TIMER_MS = 6 * 60 * 60_000;
const REQUEST_CHECK_EVERY_MS = 5 * 60_000;

/**
 * BR-CUT-05 without polling the database (the free Neon tier bills compute time): one timer
 * set for the next cut-off, a catch-up at startup (Render sleeps when idle), and a throttled
 * catch-up on incoming requests in case the timer was lost while the process slept.
 */
@Injectable()
export class JobsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(JobsService.name);
  private timer: NodeJS.Timeout | null = null;
  private lastCheck = 0;
  private running: Promise<void> | null = null;

  constructor(
    private readonly cutoff: CutoffService,
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  onApplicationBootstrap(): void {
    if (loadEnv().NODE_ENV === 'test') return;
    void this.tick('CATCH_UP');
  }

  onApplicationShutdown(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  /** Called by the request middleware; at most one check every few minutes. */
  async maybeCatchUp(): Promise<void> {
    if (loadEnv().NODE_ENV === 'test') return;
    if (Date.now() - this.lastCheck < REQUEST_CHECK_EVERY_MS) return this.running ?? undefined;
    await this.tick('CATCH_UP');
  }

  /** Re-arm after settings change (the cut-off time or kitchen days may have moved). */
  reschedule(): void {
    void this.tick('CATCH_UP');
  }

  private tick(trigger: 'SCHEDULED' | 'CATCH_UP'): Promise<void> {
    this.running ??= this.run(trigger).finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async run(trigger: 'SCHEDULED' | 'CATCH_UP'): Promise<void> {
    this.lastCheck = Date.now();
    try {
      const settings = await this.prisma.platformSettings.findUnique({
        where: { id: 1 },
        select: { autoCutoffEnabled: true },
      });
      if (settings?.autoCutoffEnabled) await this.cutoff.catchUp(trigger);
      const next = await this.cutoff.nextCutoff();
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      if (next) {
        const delay = Math.min(
          Math.max(next.at.getTime() - this.clock.now().getTime() + 1_000, 1_000),
          MAX_TIMER_MS,
        );
        this.timer = setTimeout(() => void this.tick('SCHEDULED'), delay);
        this.timer.unref();
      }
    } catch (error) {
      this.logger.error(`Cut-off job failed: ${(error as Error).message}`);
    }
  }
}
