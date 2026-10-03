import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  createStaffSchema,
  resetPasswordSchema,
  staffListQuerySchema,
  updateStaffSchema,
} from '@fernleaf/shared';
import { createZodDto } from 'nestjs-zod';
import { CurrentUser, type CurrentUserInfo } from '../authz/current-user';
import { CheckPolicies } from '../authz/policies';
import { StaffService } from './staff.service';

class StaffListQueryDto extends createZodDto(staffListQuerySchema) {}
class CreateStaffDto extends createZodDto(createStaffSchema) {}
class UpdateStaffDto extends createZodDto(updateStaffSchema) {}
class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}

/** FR-ACC-02: admins create staff accounts and assign roles. */
@Controller()
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get('staff')
  @CheckPolicies((a) => a.can('read', 'Staff'))
  list(@Query() query: StaffListQueryDto) {
    return this.staff.list(query);
  }

  @Get('roles')
  @CheckPolicies((a) => a.can('read', 'Staff'))
  roles() {
    return this.staff.roles();
  }

  @Post('staff')
  @CheckPolicies((a) => a.can('create', 'Staff'))
  create(@Body() body: CreateStaffDto) {
    return this.staff.create(body);
  }

  @Patch('staff/:id')
  @CheckPolicies((a) => a.can('update', 'Staff'))
  update(
    @CurrentUser() actor: CurrentUserInfo,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateStaffDto,
  ) {
    return this.staff.update(actor.id, id, body);
  }

  @Post('staff/:id/reset-password')
  @CheckPolicies((a) => a.can('update', 'Staff'))
  @HttpCode(204)
  async resetPassword(@Param('id', ParseUUIDPipe) id: string, @Body() body: ResetPasswordDto) {
    await this.staff.resetPassword(id, body.password);
  }
}
