import { Module } from '@nestjs/common';
import { MenuModule } from '../menu/menu.module';
import { CutoffService } from './cutoff.service';
import { JobsService } from './jobs.service';
import { CutoffCatchUpMiddleware, CutoffController, OrdersController } from './orders.controller';
import { OrdersQueryService } from './orders-query.service';
import { OrdersService } from './orders.service';
import { PlanningService } from './planning.service';

@Module({
  imports: [MenuModule],
  controllers: [OrdersController, CutoffController],
  providers: [
    OrdersService,
    OrdersQueryService,
    PlanningService,
    CutoffService,
    JobsService,
    CutoffCatchUpMiddleware,
  ],
  exports: [
    PlanningService,
    CutoffService,
    JobsService,
    OrdersQueryService,
    CutoffCatchUpMiddleware,
  ],
})
export class OrdersModule {}
