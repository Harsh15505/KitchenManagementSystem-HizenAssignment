import { Injectable } from '@nestjs/common';
import {
  type CreateStaffInput,
  type Paginated,
  paginated,
  type RoleSummary,
  type StaffListQuery,
  type StaffMember,
  type UpdateStaffInput,
} from '@fernleaf/shared';
import bcrypt from 'bcryptjs';
import { DomainError } from '../common/domain-error';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const staffSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  isActive: true,
  lastLoginAt: true,
  role: { select: { id: true, key: true, name: true } },
} satisfies Prisma.UserSelect;

type StaffRow = Prisma.UserGetPayload<{ select: typeof staffSelect }>;

const toDto = (row: StaffRow): StaffMember => ({
  ...row,
  lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
});

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: StaffListQuery): Promise<Paginated<StaffMember>> {
    const where: Prisma.UserWhereInput = {
      ...(query.active ? { isActive: query.active === 'true' } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { email: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: staffSelect,
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginated(rows.map(toDto), total, query);
  }

  async roles(): Promise<RoleSummary[]> {
    return this.prisma.role.findMany({
      select: { id: true, key: true, name: true, description: true, permissions: true },
      orderBy: { name: 'asc' },
    });
  }

  async create(input: CreateStaffInput): Promise<StaffMember> {
    await this.assertRoleExists(input.roleId);
    if (
      await this.prisma.user.findUnique({ where: { email: input.email }, select: { id: true } })
    ) {
      throw new DomainError('UNIQUE_VIOLATION', 'A staff account with this email already exists.', {
        fieldErrors: { email: ['This email is already used by another staff account'] },
      });
    }
    const row = await this.prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        roleId: input.roleId,
        passwordHash: await bcrypt.hash(input.password, 10),
      },
      select: staffSelect,
    });
    return toDto(row);
  }

  async update(actorId: string, id: string, input: UpdateStaffInput): Promise<StaffMember> {
    const current = await this.findOrThrow(id);
    if (input.roleId !== undefined) await this.assertRoleExists(input.roleId);

    // Guard against locking yourself (possibly the last admin) out of the system.
    if (id === actorId && input.isActive === false) {
      throw new DomainError('BUSINESS_RULE_VIOLATION', 'You cannot deactivate your own account.');
    }
    if (id === actorId && input.roleId !== undefined && input.roleId !== current.roleId) {
      throw new DomainError('BUSINESS_RULE_VIOLATION', 'You cannot change your own role.');
    }

    // Role changes and deactivation end the user's existing sessions immediately (BR-ACC-02).
    const revokesSessions =
      (input.roleId !== undefined && input.roleId !== current.roleId) ||
      (input.isActive === false && current.isActive);

    const row = await this.prisma.user.update({
      where: { id },
      data: { ...input, ...(revokesSessions ? { tokenVersion: { increment: 1 } } : {}) },
      select: staffSelect,
    });
    return toDto(row);
  }

  async resetPassword(id: string, password: string): Promise<void> {
    await this.findOrThrow(id);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(password, 10), tokenVersion: { increment: 1 } },
    });
  }

  private async findOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { roleId: true, isActive: true },
    });
    if (!user) throw new DomainError('NOT_FOUND', 'Staff member not found.');
    return user;
  }

  private async assertRoleExists(roleId: string): Promise<void> {
    if (!(await this.prisma.role.findUnique({ where: { id: roleId }, select: { id: true } }))) {
      throw new DomainError('VALIDATION_FAILED', 'Choose a valid role.', {
        fieldErrors: { roleId: ['Unknown role'] },
      });
    }
  }
}
