import { Injectable } from '@nestjs/common';
import type {
  CreateReferenceItemInput,
  ReferenceItem,
  ReferenceType,
  UpdateReferenceItemInput,
} from '@fernleaf/shared';
import { DomainError } from '../common/domain-error';
import { PrismaService } from '../prisma/prisma.service';

/** The five lists share one shape (name, sortOrder, isActive); packaging also has a description. */
interface ListDelegate {
  findMany(args: object): Promise<ReferenceItem[]>;
  findFirst(args: object): Promise<ReferenceItem | null>;
  create(args: object): Promise<ReferenceItem>;
  update(args: object): Promise<ReferenceItem>;
}

@Injectable()
export class ReferenceService {
  constructor(private readonly prisma: PrismaService) {}

  private delegate(type: ReferenceType): ListDelegate {
    const delegates: Record<ReferenceType, unknown> = {
      allergens: this.prisma.allergen,
      'dietary-tags': this.prisma.dietaryTag,
      'kitchen-stations': this.prisma.kitchenStation,
      'portion-sizes': this.prisma.portionSize,
      'packaging-types': this.prisma.packagingType,
    };
    return delegates[type] as ListDelegate;
  }

  list(type: ReferenceType): Promise<ReferenceItem[]> {
    return this.delegate(type).findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  async create(type: ReferenceType, input: CreateReferenceItemInput): Promise<ReferenceItem> {
    await this.assertNameFree(type, input.name);
    return this.delegate(type).create({ data: this.toData(type, input) });
  }

  async update(
    type: ReferenceType,
    id: string,
    input: UpdateReferenceItemInput,
  ): Promise<ReferenceItem> {
    const existing = await this.delegate(type).findFirst({ where: { id } });
    if (!existing) throw new DomainError('NOT_FOUND', 'Item not found.');
    if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) {
      await this.assertNameFree(type, input.name);
    }
    return this.delegate(type).update({ where: { id }, data: this.toData(type, input) });
  }

  private toData(type: ReferenceType, input: UpdateReferenceItemInput) {
    const { description, ...rest } = input;
    return type === 'packaging-types' && description !== undefined
      ? { ...rest, description }
      : rest;
  }

  private async assertNameFree(type: ReferenceType, name: string): Promise<void> {
    const clash = await this.delegate(type).findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (clash) {
      throw new DomainError('UNIQUE_VIOLATION', `"${clash.name}" already exists.`, {
        fieldErrors: { name: ['Already in the list'] },
      });
    }
  }
}
