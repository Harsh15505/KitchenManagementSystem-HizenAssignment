import {
  Body,
  Controller,
  Get,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { assignDriverSchema, deliverDropSchema, dispatchBoardQuerySchema } from '@fernleaf/shared';
import type { Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import { AnyUser, CheckPolicies } from '../authz/policies';
import { CurrentUser, type CurrentUserInfo } from '../authz/current-user';
import { OrdersModule } from '../orders/orders.module';
import { DispatchService } from './dispatch.service';

class BoardQueryDto extends createZodDto(dispatchBoardQuerySchema) {}
class AssignDto extends createZodDto(assignDriverSchema) {}
class DeliverDto extends createZodDto(deliverDropSchema) {}

/** FR-DSP-01..03/05 (TRD §API dispatch). */
@Controller('dispatch')
export class DispatchController {
  constructor(private readonly dispatch: DispatchService) {}

  @Get('board')
  @CheckPolicies((a) => a.can('read', 'DispatchBoard'))
  board(@Query() query: BoardQueryDto) {
    return this.dispatch.board(query);
  }

  @Put('drops/:id/driver')
  @CheckPolicies((a) => a.can('assignDriver', 'Drop'))
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AssignDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.dispatch.assignDriver(id, body.driverId, user);
  }

  @Post('drops/:id/ready')
  @HttpCode(200)
  @CheckPolicies((a) => a.can('markReady', 'Drop'))
  ready(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CurrentUserInfo) {
    return this.dispatch.markReady(id, user);
  }

  @Post('drops/:id/out')
  @HttpCode(200)
  @CheckPolicies((a) => a.can('sendOut', 'Drop'))
  out(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CurrentUserInfo) {
    return this.dispatch.markOut(id, user);
  }

  /** BR-DSP-04: dispatch may record a delivery too (e.g. the driver's phone died). */
  @Post('drops/:id/delivered')
  @HttpCode(200)
  @CheckPolicies((a) => a.can('deliver', 'Drop') && a.can('read', 'DispatchBoard'))
  delivered(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DeliverDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.dispatch.deliver(id, body, user, false);
  }
}

/** FR-DSP-04 / BR-DSP-07: the driver's own drops for today. */
@Controller('driver')
export class DriverController {
  constructor(private readonly dispatch: DispatchService) {}

  // The row rule (driverId = me) is applied in the query, so the route only needs "can deliver drops at all".
  @Get('drops')
  @CheckPolicies((a) => a.can('deliver', 'Drop'))
  drops(@CurrentUser() user: CurrentUserInfo) {
    return this.dispatch.driverDrops(user);
  }

  @Post('drops/:id/delivered')
  @HttpCode(200)
  @CheckPolicies((a) => a.can('deliver', 'Drop'))
  delivered(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DeliverDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.dispatch.deliver(id, body, user, true);
  }
}

/** T-706: proof-of-delivery photo (scope checked in the service). */
@Controller('drops')
export class DropPhotoController {
  constructor(private readonly dispatch: DispatchService) {}

  @Get(':id/photo')
  @AnyUser()
  async photo(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserInfo,
    @Res() res: Response,
  ) {
    const photo = await this.dispatch.photo(id, user);
    res.setHeader('Content-Type', photo.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(photo.data);
  }
}

@Module({
  imports: [OrdersModule],
  controllers: [DispatchController, DriverController, DropPhotoController],
  providers: [DispatchService],
  exports: [DispatchService],
})
export class DispatchModule {}
