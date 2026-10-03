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
  type EmployeeMenuDto,
  menuSlug,
  resolveEmployeeMenu,
  updateMenuItemSchema,
} from '@fernleaf/shared';
import { createZodDto } from 'nestjs-zod';
import { CheckPolicies } from '../authz/policies';
import { MenuInputService } from './menu-input.service';
import { MenuService } from './menu.service';

class CategoryDto extends createZodDto(menuCategoryInputSchema) {}
class UpdateCategoryDto extends createZodDto(updateMenuCategorySchema) {}
class AddItemDto extends createZodDto(addMenuItemSchema) {}
class UpdateItemDto extends createZodDto(updateMenuItemSchema) {}
class ReorderDto extends createZodDto(reorderSchema) {}

const canRead = CheckPolicies((a) => a.can('read', 'Menu'));
const canManage = CheckPolicies((a) => a.can('manage', 'Menu'));
// The order builder needs the same view, so order takers may read it too (TRD §API menu).
const canViewEmployeeMenu = CheckPolicies((a) => a.can('read', 'Menu') || a.can('create', 'Order'));

/** FR-MEN-01..04 (TRD §API menu). */
@Controller('menu')
export class MenuController {
  constructor(
    private readonly menu: MenuService,
    private readonly menuInput: MenuInputService,
  ) {}

  /** FR-MEN-04: the listed menu exactly as this employee sees it, priced on their tier. */
  @Get('for-employee/:employeeId')
  @canViewEmployeeMenu
  forEmployee(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.employeeMenu(employeeId, null);
  }

  /** FR-MEN-03: the listed menu plus the secret category opened by its slug. */
  @Get('for-employee/:employeeId/secret/:slug')
  @canViewEmployeeMenu
  forEmployeeWithSecret(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('slug') slug: string,
  ) {
    const parsed = menuSlug.safeParse(slug);
    return this.employeeMenu(employeeId, parsed.success ? parsed.data : slug.toLowerCase());
  }

  private async employeeMenu(employeeId: string, slug: string | null): Promise<EmployeeMenuDto> {
    const { input, employee, tier } = await this.menuInput.forEmployee(employeeId);
    const categories = resolveEmployeeMenu(
      input,
      slug ? { mode: 'slug', slug } : { mode: 'listed' },
    );
    return {
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        company: { id: employee.company.id, name: employee.company.name },
        allergenIds: employee.allergenIds,
        dietaryTagIds: employee.dietaryTagIds,
      },
      tier,
      categories,
      secret: slug ? { slug, found: categories.some((c) => c.isSecret && c.slug === slug) } : null,
    };
  }

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
