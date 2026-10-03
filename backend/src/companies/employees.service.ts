import { Injectable } from '@nestjs/common';
import {
  type CreateEmployeeInput,
  type EmployeeDto,
  type EmployeeImportResult,
  type EmployeeListQuery,
  emailOnCompanyDomain,
  type MoveEmployeeInput,
  type Paginated,
  paginated,
  parseEmployeeCsv,
  type UpdateEmployeeInput,
} from '@fernleaf/shared';
import { DomainError } from '../common/domain-error';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const employeeSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  canChooseAddress: true,
  canChangeDeliveryTime: true,
  canChangePackaging: true,
  isActive: true,
  company: { select: { id: true, name: true } },
  ownerOf: { select: { id: true } },
  allergies: { select: { allergenId: true } },
  dietaryPreferences: { select: { dietaryTagId: true } },
} satisfies Prisma.EmployeeSelect;

type EmployeeRow = Prisma.EmployeeGetPayload<{ select: typeof employeeSelect }>;

const toDto = ({ ownerOf, allergies, dietaryPreferences, ...row }: EmployeeRow): EmployeeDto => ({
  ...row,
  isOwner: ownerOf !== null,
  allergenIds: allergies.map((a) => a.allergenId),
  dietaryTagIds: dietaryPreferences.map((p) => p.dietaryTagId),
});

/** FR-EMP-01/02: employees, their flags and dietary needs, and moves between companies. */
@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: EmployeeListQuery): Promise<Paginated<EmployeeDto>> {
    const where: Prisma.EmployeeWhereInput = {
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.active ? { isActive: query.active === 'true' } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { email: { contains: query.q.toLowerCase() } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        select: employeeSelect,
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employee.count({ where }),
    ]);
    return paginated(rows.map(toDto), total, query);
  }

  async get(id: string): Promise<EmployeeDto> {
    const row = await this.prisma.employee.findUnique({ where: { id }, select: employeeSelect });
    if (!row) throw new DomainError('NOT_FOUND', 'Employee not found.');
    return toDto(row);
  }

  async create(input: CreateEmployeeInput): Promise<EmployeeDto> {
    const { allergenIds, dietaryTagIds, ...fields } = input;
    await this.assertEmailAllowed(input.companyId, input.email, null);
    const row = await this.prisma.employee.create({
      data: {
        ...fields,
        allergies: { create: allergenIds.map((allergenId) => ({ allergenId })) },
        dietaryPreferences: { create: dietaryTagIds.map((dietaryTagId) => ({ dietaryTagId })) },
      },
      select: employeeSelect,
    });
    return toDto(row);
  }

  /**
   * FR-EMP-03: create the valid rows of a CSV file one by one, so a bad row never blocks the rest.
   * Each row passes the same checks as the form (shared schema, company domain, unique email).
   */
  async importCsv(companyId: string, csv: string): Promise<EmployeeImportResult> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) throw new DomainError('NOT_FOUND', 'Company not found.');
    const [allergens, tags] = await Promise.all([
      this.prisma.allergen.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      }),
      this.prisma.dietaryTag.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      }),
    ]);
    const byName = (rows: Array<{ id: string; name: string }>) =>
      new Map(rows.map((r) => [r.name.toLowerCase(), r.id]));
    const parsed = parseEmployeeCsv(csv, {
      allergens: byName(allergens),
      dietaryTags: byName(tags),
    });

    const failed = [...parsed.failed];
    let created = 0;
    for (const { row, input } of parsed.rows) {
      try {
        await this.create({ ...input, companyId });
        created++;
      } catch (error) {
        // Domain and duplicate-email refusals; P2002 is the same duplicate losing a race.
        const duplicate = (error as { code?: string }).code === 'P2002';
        if (!(error instanceof DomainError) && !duplicate) throw error;
        failed.push({
          row,
          column: 'email',
          message: duplicate
            ? `${input.email} is already used by another employee.`
            : (error as Error).message,
        });
      }
    }
    failed.sort((a, b) => a.row - b.row);
    return { created, failed };
  }

  async update(id: string, input: UpdateEmployeeInput): Promise<EmployeeDto> {
    const existing = await this.get(id);
    if (input.email && input.email !== existing.email)
      await this.assertEmailAllowed(existing.company.id, input.email, id);
    // BR-EMP-02: the owner stays active until ownership is handed over.
    if (input.isActive === false && existing.isOwner)
      throw new DomainError(
        'OWNER_CANNOT_MOVE',
        `${existing.name} owns ${existing.company.name}. Transfer ownership before deactivating.`,
      );

    const { allergenIds, dietaryTagIds, ...fields } = input;
    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({ where: { id }, data: fields });
      if (allergenIds) {
        await tx.employeeAllergy.deleteMany({ where: { employeeId: id } });
        await tx.employeeAllergy.createMany({
          data: allergenIds.map((allergenId) => ({ employeeId: id, allergenId })),
        });
      }
      if (dietaryTagIds) {
        await tx.employeeDietaryPreference.deleteMany({ where: { employeeId: id } });
        await tx.employeeDietaryPreference.createMany({
          data: dietaryTagIds.map((dietaryTagId) => ({ employeeId: id, dietaryTagId })),
        });
      }
    });
    return this.get(id);
  }

  /**
   * FR-EMP-02 / BR-EMP-02/03: a move needs an email on the new company's domains, and owners hand
   * over first. Existing orders keep their company, address and prices (they store their own).
   */
  async move(id: string, input: MoveEmployeeInput): Promise<EmployeeDto> {
    const existing = await this.get(id);
    if (existing.isOwner)
      throw new DomainError(
        'OWNER_CANNOT_MOVE',
        `${existing.name} owns ${existing.company.name}. Transfer ownership before moving them.`,
      );
    if (input.companyId === existing.company.id)
      throw new DomainError(
        'BUSINESS_RULE_VIOLATION',
        `${existing.name} already works at ${existing.company.name}.`,
      );
    await this.assertEmailAllowed(input.companyId, input.email, id);
    await this.prisma.employee.update({
      where: { id },
      data: { companyId: input.companyId, email: input.email },
    });
    return this.get(id);
  }

  /** The new owner must be an active employee of the same company. */
  async makeOwner(id: string): Promise<EmployeeDto> {
    const employee = await this.get(id);
    if (!employee.isActive)
      throw new DomainError(
        'BUSINESS_RULE_VIOLATION',
        'Reactivate the employee before making them the owner.',
      );
    await this.prisma.company.update({
      where: { id: employee.company.id },
      data: { ownerEmployeeId: id },
    });
    return this.get(id);
  }

  /** BR-EMP-01: unique email on one of the company's domains. */
  private async assertEmailAllowed(
    companyId: string,
    email: string,
    exceptId: string | null,
  ): Promise<void> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, domains: { select: { domain: true } } },
    });
    if (!company) throw new DomainError('NOT_FOUND', 'Company not found.');
    const domains = company.domains.map((d) => d.domain);
    if (!emailOnCompanyDomain(email, domains))
      throw new DomainError(
        'EMAIL_DOMAIN_MISMATCH',
        `${company.name} employees need an email on ${domains.map((d) => `@${d}`).join(' or ')}.`,
        { fieldErrors: { email: [`Use ${domains.map((d) => `@${d}`).join(' or ')}`] } },
      );
    const clash = await this.prisma.employee.findUnique({ where: { email }, select: { id: true } });
    if (clash && clash.id !== exceptId)
      throw new DomainError('UNIQUE_VIOLATION', `${email} is already used by another employee.`, {
        fieldErrors: { email: ['Already used'] },
      });
  }
}
