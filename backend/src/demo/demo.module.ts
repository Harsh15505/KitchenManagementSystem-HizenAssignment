import { Controller, Get, HttpCode, Module, Post } from '@nestjs/common';
import { CheckPolicies } from '../authz/policies';
import { BillingModule } from '../billing/billing.module';
import { MenuModule } from '../menu/menu.module';
import { OrdersModule } from '../orders/orders.module';
import { DemoService } from './demo.service';

/** FR-DAT-04: rebuild the generated data on demand (staff-created orders are kept). */
@Controller('demo')
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  @Get('status')
  @CheckPolicies((a) => a.can('manage', 'DemoData'))
  status() {
    return this.demo.status();
  }

  @Post('regenerate')
  @HttpCode(200)
  @CheckPolicies((a) => a.can('manage', 'DemoData'))
  regenerate() {
    return this.demo.regenerate();
  }

  @Post('autopilot')
  @HttpCode(200)
  @CheckPolicies((a) => a.can('manage', 'DemoData'))
  async autopilot() {
    return { moved: await this.demo.autopilot() };
  }
}

@Module({
  imports: [OrdersModule, MenuModule, BillingModule],
  controllers: [DemoController],
  providers: [DemoService],
})
export class DemoModule {}
