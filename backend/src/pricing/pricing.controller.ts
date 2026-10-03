import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  priceTierInputSchema,
  tierGridQuerySchema,
  tierPriceChangesSchema,
} from '@fernleaf/shared';
import { createZodDto } from 'nestjs-zod';
import { CurrentUser, type CurrentUserInfo } from '../authz/current-user';
import { CheckPolicies } from '../authz/policies';
import { PricingService } from './pricing.service';

class TierDto extends createZodDto(priceTierInputSchema) {}
class GridQueryDto extends createZodDto(tierGridQuerySchema) {}
class PriceChangesDto extends createZodDto(tierPriceChangesSchema) {}

const canRead = CheckPolicies((a) => a.can('read', 'Pricing'));
const canManage = CheckPolicies((a) => a.can('manage', 'Pricing'));

/** FR-PRC-01..06 (TRD §API pricing). */
@Controller('price-tiers')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get()
  @canRead
  list() {
    return this.pricing.list();
  }

  @Get(':id')
  @canRead
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.pricing.get(id);
  }

  @Get(':id/grid')
  @canRead
  grid(@Param('id', ParseUUIDPipe) id: string, @Query() query: GridQueryDto) {
    return this.pricing.grid(id, query);
  }

  @Post()
  @canManage
  create(@Body() body: TierDto) {
    return this.pricing.create(body);
  }

  @Patch(':id')
  @canManage
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: TierDto) {
    return this.pricing.update(id, body);
  }

  @Post(':id/make-default')
  @HttpCode(200)
  @canManage
  makeDefault(@Param('id', ParseUUIDPipe) id: string) {
    return this.pricing.makeDefault(id);
  }

  @Delete(':id')
  @HttpCode(204)
  @canManage
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.pricing.remove(id);
  }

  @Put(':id/prices')
  @canManage
  savePrices(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PriceChangesDto,
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.pricing.savePrices(id, body, user.id);
  }
}
