import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  // The cut-off timer is re-armed when settings or kitchen holidays change.
  imports: [OrdersModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
