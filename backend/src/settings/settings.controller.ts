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
  Query,
} from '@nestjs/common';
import {
  createKitchenHolidaySchema,
  domainName,
  publicDomainSchema,
  updateSettingsSchema,
} from '@fernleaf/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CheckPolicies } from '../authz/policies';
import { DomainError } from '../common/domain-error';
import { SettingsService } from './settings.service';

class UpdateSettingsDto extends createZodDto(updateSettingsSchema) {}
class CreateHolidayDto extends createZodDto(createKitchenHolidaySchema) {}
class PublicDomainDto extends createZodDto(publicDomainSchema) {}
class HolidayRangeDto extends createZodDto(
  z.object({ from: z.string().optional(), to: z.string().optional() }),
) {}

/** FR-SET-01/02: platform values, kitchen holidays and the public-domain blocklist. */
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @CheckPolicies((a) => a.can('read', 'Settings'))
  get() {
    return this.settings.get();
  }

  @Patch()
  @CheckPolicies((a) => a.can('update', 'Settings'))
  update(@Body() body: UpdateSettingsDto) {
    return this.settings.update(body);
  }

  @Get('kitchen-holidays')
  @CheckPolicies((a) => a.can('read', 'Settings'))
  holidays(@Query() query: HolidayRangeDto) {
    return this.settings.holidays(query.from, query.to);
  }

  @Post('kitchen-holidays')
  @CheckPolicies((a) => a.can('update', 'Settings'))
  addHoliday(@Body() body: CreateHolidayDto) {
    return this.settings.addHoliday(body);
  }

  @Delete('kitchen-holidays/:id')
  @CheckPolicies((a) => a.can('update', 'Settings'))
  @HttpCode(204)
  async removeHoliday(@Param('id', ParseUUIDPipe) id: string) {
    await this.settings.removeHoliday(id);
  }

  @Get('public-domains')
  @CheckPolicies((a) => a.can('read', 'Settings'))
  publicDomains() {
    return this.settings.publicDomains();
  }

  @Post('public-domains')
  @CheckPolicies((a) => a.can('update', 'Settings'))
  addPublicDomain(@Body() body: PublicDomainDto) {
    return this.settings.addPublicDomain(body.domain);
  }

  @Delete('public-domains/:domain')
  @CheckPolicies((a) => a.can('update', 'Settings'))
  removePublicDomain(@Param('domain') domain: string) {
    const parsed = domainName.safeParse(domain);
    if (!parsed.success)
      throw new DomainError('VALIDATION_FAILED', 'Enter a domain like gmail.com.');
    return this.settings.removePublicDomain(parsed.data);
  }
}
