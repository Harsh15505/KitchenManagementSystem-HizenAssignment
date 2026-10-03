import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  createReferenceItemSchema,
  type ReferenceType,
  referenceTypeSchema,
  updateReferenceItemSchema,
} from '@fernleaf/shared';
import { createZodDto } from 'nestjs-zod';
import { CheckPolicies } from '../authz/policies';
import { DomainError } from '../common/domain-error';
import { ReferenceService } from './reference.service';

class CreateItemDto extends createZodDto(createReferenceItemSchema) {}
class UpdateItemDto extends createZodDto(updateReferenceItemSchema) {}

function parseType(type: string): ReferenceType {
  const parsed = referenceTypeSchema.safeParse(type);
  if (!parsed.success) throw new DomainError('NOT_FOUND', `Unknown reference list "${type}".`);
  return parsed.data;
}

/**
 * FR-SET-03: allergens, dietary tags, kitchen stations, portion sizes, packaging types.
 * There is deliberately no DELETE: dishes and orders reference these rows, so they are
 * deactivated instead.
 */
@Controller('reference')
export class ReferenceController {
  constructor(private readonly reference: ReferenceService) {}

  @Get(':type')
  @CheckPolicies((a) => a.can('read', 'ReferenceData'))
  list(@Param('type') type: string) {
    return this.reference.list(parseType(type));
  }

  @Post(':type')
  @CheckPolicies((a) => a.can('create', 'ReferenceData'))
  create(@Param('type') type: string, @Body() body: CreateItemDto) {
    return this.reference.create(parseType(type), body);
  }

  @Patch(':type/:id')
  @CheckPolicies((a) => a.can('update', 'ReferenceData'))
  update(
    @Param('type') type: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateItemDto,
  ) {
    return this.reference.update(parseType(type), id, body);
  }
}
