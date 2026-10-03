import { Injectable } from '@nestjs/common';
import { type OptionGroupInput, portionViolations } from '@fernleaf/shared';
import { DomainError } from '../common/domain-error';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** FR-CAT-04/05: a dish's option groups, their ordered options and sizes. */
@Injectable()
export class OptionGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dishId: string, input: OptionGroupInput): Promise<{ id: string }> {
    if (!(await this.prisma.dish.findUnique({ where: { id: dishId }, select: { id: true } }))) {
      throw new DomainError('NOT_FOUND', 'Dish not found.');
    }
    await this.assertNameFree(dishId, input.name);
    await this.assertValid(input);
    const last = await this.prisma.optionGroup.aggregate({
      where: { dishId },
      _max: { sortOrder: true },
    });

    return this.prisma.$transaction(async (tx) => {
      const group = await tx.optionGroup.create({
        data: {
          dishId,
          name: input.name,
          isRequired: input.isRequired,
          maxSelections: input.maxSelections,
          usesPortions: input.usesPortions,
          sortOrder: (last._max.sortOrder ?? 0) + 1,
        },
        select: { id: true },
      });
      await this.writeItems(tx, group.id, input);
      return group;
    });
  }

  async update(groupId: string, input: OptionGroupInput): Promise<{ id: string }> {
    const group = await this.prisma.optionGroup.findUnique({
      where: { id: groupId },
      select: { dishId: true, name: true },
    });
    if (!group) throw new DomainError('NOT_FOUND', 'Option group not found.');
    if (input.name.toLowerCase() !== group.name.toLowerCase())
      await this.assertNameFree(group.dishId, input.name);
    await this.assertValid(input);

    await this.prisma.$transaction(async (tx) => {
      await tx.optionGroup.update({
        where: { id: groupId },
        data: {
          name: input.name,
          isRequired: input.isRequired,
          maxSelections: input.maxSelections,
          usesPortions: input.usesPortions,
        },
      });
      await tx.optionGroupItem.deleteMany({ where: { groupId } });
      await tx.optionGroupPortionSize.deleteMany({ where: { groupId } });
      await this.writeItems(tx, groupId, input);
    });
    return { id: groupId };
  }

  /** Past orders keep the group's name in their snapshot; the FK on choices is set to NULL. */
  async remove(groupId: string): Promise<void> {
    await this.prisma.optionGroup.delete({ where: { id: groupId } });
  }

  async reorder(dishId: string, groupIds: string[]): Promise<void> {
    const groups = await this.prisma.optionGroup.findMany({
      where: { dishId },
      select: { id: true },
    });
    const known = new Set(groups.map((g) => g.id));
    if (groupIds.length !== known.size || groupIds.some((id) => !known.has(id))) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Send every option group of this dish exactly once.',
      );
    }
    await this.prisma.$transaction(
      groupIds.map((id, index) =>
        this.prisma.optionGroup.update({ where: { id }, data: { sortOrder: index + 1 } }),
      ),
    );
  }

  private async writeItems(tx: Prisma.TransactionClient, groupId: string, input: OptionGroupInput) {
    await tx.optionGroupItem.createMany({
      data: input.optionIds.map((optionId, index) => ({ groupId, optionId, sortOrder: index + 1 })),
    });
    if (input.usesPortions) {
      await tx.optionGroupPortionSize.createMany({
        data: input.portionSizeIds.map((portionSizeId, index) => ({
          groupId,
          portionSizeId,
          sortOrder: index + 1,
        })),
      });
    }
  }

  private async assertValid(input: OptionGroupInput): Promise<void> {
    const options = await this.prisma.option.findMany({
      where: { id: { in: input.optionIds } },
      select: { id: true, name: true, portionPrices: { select: { portionSizeId: true } } },
    });
    if (options.length !== input.optionIds.length) {
      throw new DomainError('VALIDATION_FAILED', 'Some options no longer exist.', {
        fieldErrors: { optionIds: ['Unknown option'] },
      });
    }
    if (!input.usesPortions) return;

    const violations = portionViolations(
      input.portionSizeIds,
      options.map((o) => ({
        id: o.id,
        name: o.name,
        supportedSizeIds: new Set(o.portionPrices.map((p) => p.portionSizeId)),
      })),
    );
    if (violations.length > 0) {
      throw new DomainError(
        'PORTION_SIZE_UNSUPPORTED',
        `${violations.map((v) => v.optionName).join(', ')} ${violations.length === 1 ? 'does' : 'do'} not support every size of this group. Add the size to the option first.`,
        {
          fieldErrors: { optionIds: ['Every option must support every size'] },
          details: { violations },
        },
      );
    }
  }

  private async assertNameFree(dishId: string, name: string): Promise<void> {
    const clash = await this.prisma.optionGroup.findFirst({
      where: { dishId, name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (clash) {
      throw new DomainError('UNIQUE_VIOLATION', 'This dish already has a group with that name.', {
        fieldErrors: { name: ['Already used on this dish'] },
      });
    }
  }
}
