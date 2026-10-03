import {
  Body,
  Controller,
  Get,
  HttpCode,
  Injectable,
  type NestMiddleware,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  calendarDate,
  createOrderSchema,
  cutoffRunSchema,
  deliveryOverrideSchema,
  openOrdersOnQuerySchema,
  orderListQuerySchema,
  orderReasonSchema,
  orderVersionSchema,
  quoteOrderSchema,
  updateOrderSchema,
} from '@fernleaf/shared';
import type { NextFunction, Request, Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CurrentUser, type CurrentUserInfo } from '../authz/current-user';
import { CheckPolicies } from '../authz/policies';
import { CutoffService } from './cutoff.service';
import { JobsService } from './jobs.service';
import { OrdersQueryService } from './orders-query.service';
import { OrdersService } from './orders.service';

class ListQueryDto extends createZodDto(orderListQuerySchema) {}
class ContextQueryDto extends createZodDto(z.object({ employeeId: z.uuid() })) {}
class CreateDto extends createZodDto(createOrderSchema) {}
class QuoteDto extends createZodDto(quoteOrderSchema) {}
class UpdateDto extends createZodDto(updateOrderSchema) {}
class VersionDto extends createZodDto(orderVersionSchema) {}
class ReasonDto extends createZodDto(orderReasonSchema) {}
class OverrideDto extends createZodDto(deliveryOverrideSchema) {}
class CutoffRunDto extends createZodDto(cutoffRunSchema) {}
class OpenOnQueryDto extends createZodDto(openOrdersOnQuerySchema) {}

const canRead = CheckPolicies((a) => a.can('read', 'Order'));
const canCreate = CheckPolicies((a) => a.can('create', 'Order'));
const canEdit = CheckPolicies((a) => a.can('update', 'Order'));
// Cancelling needs orders.cancel; admins (orders.override) may also cancel locked or confirmed orders.
const canCancel = CheckPolicies((a) => a.can('cancel', 'Order') || a.can('override', 'Order'));
const canReject = CheckPolicies((a) => a.can('reject', 'Order'));
const canOverride = CheckPolicies((a) => a.can('override', 'Order'));

/** FR-ORD-02..09 (TRD §API orders). */
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly query: OrdersQueryService,
  ) {}

  @Get()
  @canRead
  list(@Query() q: ListQueryDto) {
    return this.query.list(q);
  }

  @Get('context')
  @canCreate
  context(@Query() q: ContextQueryDto, @CurrentUser() user: CurrentUserInfo) {
    return this.orders.context(q.employeeId, user);
  }

  @Post('quote')
  @HttpCode(200)
  @canCreate
  quote(@Body() body: QuoteDto, @CurrentUser() user: CurrentUserInfo) {
    return this.orders.quote(body, user);
  }

  /** FR-CMP-05: open orders on a date, for the holiday warning. Declared before `:id`. */
  @Get('open-on')
  @canRead
  openOn(@Query() q: OpenOnQueryDto) {
    return this.query.openOn(q);
  }

  @Get(':id')
  @canRead
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CurrentUserInfo) {
    return this.query.get(id, user);
  }

  @Post()
  @canCreate
  create(@Body() body: CreateDto, @CurrentUser() user: CurrentUserInfo) {
    return this.orders.create(body, user);
  }

  @Put(':id')
  @canEdit
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.orders.update(id, body, user);
  }

  @Post(':id/place')
  @HttpCode(200)
  @canCreate
  place(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: VersionDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.orders.place(id, body.version, user);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @canCancel
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReasonDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.orders.cancel(id, body, user);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @canReject
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReasonDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.orders.reject(id, body, user);
  }

  @Patch(':id/delivery')
  @canOverride
  overrideDelivery(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: OverrideDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.orders.overrideDelivery(id, body, user);
  }
}

/** FR-ORD-05: cut-off status, history and the manual trigger. */
@Controller('cutoff')
export class CutoffController {
  constructor(
    private readonly cutoff: CutoffService,
    private readonly jobs: JobsService,
  ) {}

  @Get()
  @CheckPolicies((a) => a.can('read', 'Cutoff'))
  overview() {
    return this.cutoff.overview();
  }

  @Post('run')
  @HttpCode(200)
  @CheckPolicies((a) => a.can('run', 'Cutoff'))
  async run(@Body() body: CutoffRunDto, @CurrentUser() user: CurrentUserInfo) {
    const result = await this.cutoff.process(calendarDate(body.deliveryDate), 'MANUAL', {
      id: user.id,
      name: user.name,
    });
    this.jobs.reschedule();
    return result;
  }
}

/** BR-CUT-05: a request after downtime processes any cut-off that passed while the API slept. */
@Injectable()
export class CutoffCatchUpMiddleware implements NestMiddleware {
  constructor(private readonly jobs: JobsService) {}

  async use(_req: Request, _res: Response, next: NextFunction): Promise<void> {
    await this.jobs.maybeCatchUp().catch(() => undefined);
    next();
  }
}
