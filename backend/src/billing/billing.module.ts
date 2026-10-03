import {
  Body,
  Controller,
  Get,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  createInvoiceSchema,
  invoiceListQuerySchema,
  shortageSchema,
  uninvoicedQuerySchema,
} from '@fernleaf/shared';
import { createZodDto } from 'nestjs-zod';
import { CurrentUser, type CurrentUserInfo } from '../authz/current-user';
import { CheckPolicies } from '../authz/policies';
import { BillingService } from './billing.service';

class UninvoicedQueryDto extends createZodDto(uninvoicedQuerySchema) {}
class CreateInvoiceDto extends createZodDto(createInvoiceSchema) {}
class InvoiceListQueryDto extends createZodDto(invoiceListQuerySchema) {}
class ShortageDto extends createZodDto(shortageSchema) {}

const canRead = CheckPolicies((a) => a.can('read', 'Invoice'));
const canManage = CheckPolicies((a) => a.can('manage', 'Invoice'));

/** FR-BIL-01..05 (TRD §API billing). */
@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('billing/summary')
  @canRead
  summary() {
    return this.billing.summary();
  }

  @Get('billing/companies/:companyId/uninvoiced')
  @canRead
  uninvoiced(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: UninvoicedQueryDto,
  ) {
    return this.billing.uninvoiced(companyId, query.upTo);
  }

  @Get('invoices')
  @canRead
  list(@Query() query: InvoiceListQueryDto) {
    return this.billing.list(query);
  }

  @Get('invoices/:id')
  @canRead
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.billing.get(id);
  }

  @Post('invoices')
  @canManage
  create(@Body() body: CreateInvoiceDto, @CurrentUser() user: CurrentUserInfo) {
    return this.billing.createInvoice(body, user);
  }

  @Post('invoices/:id/paid')
  @HttpCode(200)
  @canManage
  markPaid(@Param('id', ParseUUIDPipe) id: string) {
    return this.billing.markPaid(id);
  }

  /** FR-BIL-05: admins record short deliveries (a billing matter, so billing rights). */
  @Post('orders/:id/shortage')
  @canManage
  shortage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ShortageDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.billing.shortage(id, body, user);
  }
}

@Module({
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
