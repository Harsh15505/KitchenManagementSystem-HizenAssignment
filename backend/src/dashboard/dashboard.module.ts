import { Controller, Get, Module } from '@nestjs/common';
import { CheckPolicies } from '../authz/policies';
import { BillingModule } from '../billing/billing.module';
import { DispatchModule } from '../dispatch/dispatch.module';
import { KitchenModule } from '../kitchen/kitchen.module';
import { OrdersModule } from '../orders/orders.module';
import { PricingModule } from '../pricing/pricing.module';
import { DashboardService } from './dashboard.service';

/** PRD §8.2. Kitchen, dispatch and driver dashboards read their own boards (§8.3–8.5). */
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('admin')
  @CheckPolicies((a) => a.can('read', 'AdminDashboard'))
  admin() {
    return this.dashboard.admin();
  }
}

@Module({
  imports: [OrdersModule, KitchenModule, DispatchModule, BillingModule, PricingModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
