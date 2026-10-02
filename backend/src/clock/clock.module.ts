import { Controller, Get, Global, Module } from '@nestjs/common';
import { ClockService } from './clock.service';

@Controller('meta')
export class MetaController {
  constructor(private readonly clock: ClockService) {}

  /** The frontend formats every time with this zone, never the browser's (ADR-006). */
  @Get('clock')
  clockInfo() {
    return {
      now: this.clock.now().toISOString(),
      today: this.clock.today(),
      timezone: this.clock.timeZone,
      currency: 'USD',
    };
  }
}

@Global()
@Module({
  controllers: [MetaController],
  providers: [ClockService],
  exports: [ClockService],
})
export class ClockModule {}
