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
} from '@nestjs/common';
import {
  addMenuItemSchema,
  menuCategoryInputSchema,
  reorderSchema,
  updateMenuCategorySchema,
  updateMenuItemSchema,
} from '@fernleaf/shared';
import { createZodDto } from 'nestjs-zod';
import { CheckPolicies } from '../authz/policies';
import { MenuService } from './menu.service';

class CategoryDto extends createZodDto(menuCategoryInputSchema) {}
class UpdateCategoryDto extends createZodDto(updateMenuCategorySchema) {}
class AddItemDto extends createZodDto(addMenuItemSchema) {}
class UpdateItemDto extends createZodDto(updateMenuItemSchema) {}
class ReorderDto extends createZodDto(reorderSchema) {}

const canRead = CheckPolicies((a) => a.can('read', 'Menu'));
const canManage = CheckPolicies((a) => a.can('manage', 'Menu'));

/** FR-MEN-01..03 (TRD §API menu). The employee view (FR-MEN-04) comes with T-312. */
@Controller('menu')
export class MenuController {
  constructor(private readonly menu: MenuService) {}

  @Get('categories')
  @canRead
  list() {
    return this.menu.list();
  }

  @Post('categories')
  @canManage
  create(@Body() body: CategoryDto) {
    return this.menu.create(body);
  }

  // Declared before `categories/:id` so "order" is not read as an id.
  @Put('categories/order')
  @canManage
  reorderCategories(@Body() body: ReorderDto) {
    return this.menu.reorderCategories(body.ids);
  }

  @Patch('categories/:id')
  @canManage
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateCategoryDto) {
    return this.menu.update(id, body);
  }

  @Delete('categories/:id')
  @HttpCode(204)
  @canManage
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.menu.remove(id);
  }

  @Post('categories/:id/items')
  @canManage
  addItem(@Param('id', ParseUUIDPipe) id: string, @Body() body: AddItemDto) {
    return this.menu.addItem(id, body.dishId);
  }

  @Put('categories/:id/items/order')
  @canManage
  reorderItems(@Param('id', ParseUUIDPipe) id: string, @Body() body: ReorderDto) {
    return this.menu.reorderItems(id, body.ids);
  }

  @Patch('items/:id')
  @canManage
  updateItem(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateItemDto) {
    return this.menu.updateItem(id, body.isActive);
  }

  @Delete('items/:id')
  @canManage
  removeItem(@Param('id', ParseUUIDPipe) id: string) {
    return this.menu.removeItem(id);
  }
}
