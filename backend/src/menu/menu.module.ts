import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { MenuInputService } from './menu-input.service';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';

@Module({
  imports: [PricingModule],
  controllers: [MenuController],
  providers: [MenuService, MenuInputService],
  exports: [MenuService, MenuInputService],
})
export class MenuModule {}
