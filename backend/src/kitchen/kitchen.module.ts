import {
  Controller,
  Get,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { kitchenBoardQuerySchema } from '@fernleaf/shared';
import { createZodDto } from 'nestjs-zod';
import { CurrentUser, type CurrentUserInfo } from '../authz/current-user';
import { CheckPolicies } from '../authz/policies';
import { OrdersModule } from '../orders/orders.module';
import { KitchenService } from './kitchen.service';

class BoardQueryDto extends createZodDto(kitchenBoardQuerySchema) {}

const canWork = CheckPolicies((a) => a.can('work', 'PrepUnit'));

/** FR-KIT-01..06 (TRD §API kitchen). */
@Controller('kitchen')
export class KitchenController {
  constructor(private readonly kitchen: KitchenService) {}

  @Get('board')
  @CheckPolicies((a) => a.can('read', 'KitchenBoard'))
  board(@Query() query: BoardQueryDto) {
    return this.kitchen.board(query);
  }

  @Post('units/:id/start')
  @HttpCode(200)
  @canWork
  start(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CurrentUserInfo) {
    return this.kitchen.start(id, user);
  }

  @Post('units/:id/done')
  @HttpCode(200)
  @canWork
  done(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CurrentUserInfo) {
    return this.kitchen.done(id, user);
  }

  @Post('orders/:id/force-complete')
  @HttpCode(200)
  @CheckPolicies((a) => a.can('forceComplete', 'Order'))
  forceComplete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CurrentUserInfo) {
    return this.kitchen.forceComplete(id, user);
  }
}

@Module({
  imports: [OrdersModule],
  controllers: [KitchenController],
  providers: [KitchenService],
  exports: [KitchenService],
})
export class KitchenModule {}
