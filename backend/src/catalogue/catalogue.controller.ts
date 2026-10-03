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
  catalogueListQuerySchema,
  dishInputSchema,
  optionGroupInputSchema,
  optionInputSchema,
  reorderSchema,
  updateDishSchema,
  updateOptionSchema,
} from '@fernleaf/shared';
import { createZodDto } from 'nestjs-zod';
import { CheckPolicies } from '../authz/policies';
import { DishesService } from './dishes.service';
import { OptionGroupsService } from './option-groups.service';
import { OptionsService } from './options.service';

class ListQueryDto extends createZodDto(catalogueListQuerySchema) {}
class DishDto extends createZodDto(dishInputSchema) {}
class UpdateDishDto extends createZodDto(updateDishSchema) {}
class OptionBodyDto extends createZodDto(optionInputSchema) {}
class UpdateOptionDto extends createZodDto(updateOptionSchema) {}
class GroupDto extends createZodDto(optionGroupInputSchema) {}
class ReorderDto extends createZodDto(reorderSchema) {}

const canRead = CheckPolicies((a) => a.can('read', 'Catalogue'));
const canManage = CheckPolicies((a) => a.can('manage', 'Catalogue'));

/** FR-CAT-01..05. There is no DELETE for dishes or options: they are deactivated (FR-CAT-02). */
@Controller()
export class CatalogueController {
  constructor(
    private readonly dishes: DishesService,
    private readonly options: OptionsService,
    private readonly groups: OptionGroupsService,
  ) {}

  @Get('dishes')
  @canRead
  listDishes(@Query() query: ListQueryDto) {
    return this.dishes.list(query);
  }

  @Get('dishes/:id')
  @canRead
  getDish(@Param('id', ParseUUIDPipe) id: string) {
    return this.dishes.get(id);
  }

  @Post('dishes')
  @canManage
  createDish(@Body() body: DishDto) {
    return this.dishes.create(body);
  }

  @Patch('dishes/:id')
  @canManage
  updateDish(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateDishDto) {
    return this.dishes.update(id, body);
  }

  @Post('dishes/:id/option-groups')
  @canManage
  async createGroup(@Param('id', ParseUUIDPipe) dishId: string, @Body() body: GroupDto) {
    await this.groups.create(dishId, body);
    return this.dishes.get(dishId);
  }

  @Put('dishes/:id/option-groups/order')
  @canManage
  async reorderGroups(@Param('id', ParseUUIDPipe) dishId: string, @Body() body: ReorderDto) {
    await this.groups.reorder(dishId, body.ids);
    return this.dishes.get(dishId);
  }

  @Put('option-groups/:id')
  @canManage
  updateGroup(@Param('id', ParseUUIDPipe) id: string, @Body() body: GroupDto) {
    return this.groups.update(id, body);
  }

  @Delete('option-groups/:id')
  @canManage
  @HttpCode(204)
  async deleteGroup(@Param('id', ParseUUIDPipe) id: string) {
    await this.groups.remove(id);
  }

  @Get('options')
  @canRead
  listOptions(@Query() query: ListQueryDto) {
    return this.options.list(query);
  }

  @Get('options/:id')
  @canRead
  getOption(@Param('id', ParseUUIDPipe) id: string) {
    return this.options.get(id);
  }

  @Post('options')
  @canManage
  createOption(@Body() body: OptionBodyDto) {
    return this.options.create(body);
  }

  @Patch('options/:id')
  @canManage
  updateOption(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateOptionDto) {
    return this.options.update(id, body);
  }
}
