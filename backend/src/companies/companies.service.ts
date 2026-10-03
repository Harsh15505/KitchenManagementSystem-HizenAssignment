import { Injectable } from '@nestjs/common';
import {
  type AddressInput,
  calendarDate,
  type CompanyDetail,
  type CompanyHolidayInput,
  type CompanyListItem,
  type CompanyListQuery,
  type CreateCompanyInput,
  domainProblem,
  domainRemovalProblem,
  emailOnCompanyDomain,
  fromDbDate,
  type MenuVisibilityInput,
  type Paginated,
  paginated,
  toDbDate,
  type UpdateAddressInput,
  type UpdateCompanyInput,
} from '@fernleaf/shared';
import { DomainError } from '../common/domain-error';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertDriver } from './drivers';

const detailInclude = {
  priceTier: { select: { id: true, name: true } },
  defaultPackaging: { select: { id: true, name: true } },
  defaultDriver: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true, email: true } },
  domains: { orderBy: { domain: 'asc' }, select: { id: true, domain: true } },
  addresses: { orderBy: [{ isActive: 'desc' }, { label: 'asc' }] },
  holidays: { orderBy: { date: 'asc' }, select: { id: true, date: true, name: true } },
  hiddenCategories: { select: { categoryId: true } },
  hiddenMenuItems: { select: { menuItemId: true } },
  _count: { select: { employees: true } },
} satisfies Prisma.CompanyInclude;

/** FR-CMP-01..04: client companies and everything that defines how they order. */
@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: CompanyListQuery): Promise<Paginated<CompanyListItem>> {
    const where: Prisma.CompanyWhereInput = {
      ...(query.active ? { isActive: query.active === 'true' } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { domains: { some: { domain: { contains: query.q.toLowerCase() } } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          name: true,
          isActive: true,
          workingDays: true,
          priceTier: { select: { id: true, name: true } },
          owner: { select: { id: true, name: true } },
          domains: { orderBy: { domain: 'asc' }, select: { domain: true } },
          _count: { select: { employees: true } },
        },
      }),
      this.prisma.company.count({ where }),
    ]);
    return paginated(
      rows.map(({ domains, _count, ...row }) => ({
        ...row,
        domains: domains.map((d) => d.domain),
        employeeCount: _count.employees,
      })),
      total,
      query,
    );
  }

  async get(id: string): Promise<CompanyDetail> {
    const [row, settings] = await Promise.all([
      this.prisma.company.findUnique({ where: { id }, include: detailInclude }),
      this.prisma.platformSettings.findUniqueOrThrow({
        where: { id: 1 },
        select: { defaultPriceTier: { select: { id: true, name: true } } },
      }),
    ]);
    if (!row) throw new DomainError('NOT_FOUND', 'Company not found.');
    return {
      id: row.id,
      name: row.name,
      isActive: row.isActive,
      priceTier: row.priceTier,
      effectiveTier: row.priceTier ?? settings.defaultPriceTier,
      billingContactName: row.billingContactName,
      billingEmail: row.billingEmail,
      billingPhone: row.billingPhone,
      billingAddress: row.billingAddress,
      workingDays: row.workingDays,
      defaultDeliveryTimeMinutes: row.defaultDeliveryTimeMinutes,
      dispatchLeadMinutes: row.dispatchLeadMinutes,
      defaultPackagingType: row.defaultPackaging,
      driverInstructions: row.driverInstructions,
      defaultDriver: row.defaultDriver,
      owner: row.owner,
      domains: row.domains,
      addresses: row.addresses.map((a) => ({
        id: a.id,
        label: a.label,
        line1: a.line1,
        line2: a.line2,
        city: a.city,
        postalCode: a.postalCode,
        accessNotes: a.accessNotes,
        isActive: a.isActive,
        isDefault: a.id === row.defaultAddressId,
      })),
      holidays: row.holidays.map((h) => ({ id: h.id, name: h.name, date: fromDbDate(h.date) })),
      hiddenCategoryIds: row.hiddenCategories.map((h) => h.categoryId),
      hiddenMenuItemIds: row.hiddenMenuItems.map((h) => h.menuItemId),
      employeeCount: row._count.employees,
    };
  }

  /** A-29 / BR-CMP-02: company, owner, first domain and default address commit together or not at all. */
  async create(input: CreateCompanyInput): Promise<CompanyDetail> {
    const { domain, address, owner, ...fields } = input;
    await this.assertReferences(fields);
    await this.assertDomainFree(domain, null);
    if (!emailOnCompanyDomain(owner.email, [domain]))
      throw new DomainError('EMAIL_DOMAIN_MISMATCH', `The owner's email must end in @${domain}.`, {
        fieldErrors: { 'owner.email': [`Use an @${domain} address`] },
      });
    await this.assertEmailFree(owner.email);
    await this.assertNameFree(fields.name, null);

    const id = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({ data: fields, select: { id: true } });
      await tx.companyDomain.create({ data: { companyId: company.id, domain } });
      const firstAddress = await tx.companyAddress.create({
        data: { ...address, companyId: company.id },
        select: { id: true },
      });
      const employee = await tx.employee.create({
        data: { ...owner, companyId: company.id },
        select: { id: true },
      });
      await tx.company.update({
        where: { id: company.id },
        data: { ownerEmployeeId: employee.id, defaultAddressId: firstAddress.id },
      });
      return company.id;
    });
    return this.get(id);
  }

  async update(id: string, input: UpdateCompanyInput): Promise<CompanyDetail> {
    await this.assertCompany(id);
    await this.assertReferences(input);
    if (input.name) await this.assertNameFree(input.name, id);
    await this.prisma.company.update({ where: { id }, data: input });
    return this.get(id);
  }

  async addDomain(id: string, domain: string): Promise<CompanyDetail> {
    await this.assertCompany(id);
    await this.assertDomainFree(domain, id);
    await this.prisma.companyDomain.upsert({
      where: { domain },
      update: {},
      create: { companyId: id, domain },
    });
    return this.get(id);
  }

  async removeDomain(id: string, domainId: string): Promise<CompanyDetail> {
    const [domains, employees] = await Promise.all([
      this.prisma.companyDomain.findMany({
        where: { companyId: id },
        select: { id: true, domain: true },
      }),
      this.prisma.employee.findMany({
        where: { companyId: id, isActive: true },
        select: { email: true },
      }),
    ]);
    const target = domains.find((d) => d.id === domainId);
    if (!target) throw new DomainError('NOT_FOUND', 'Domain not found on this company.');
    const problem = domainRemovalProblem(
      target.domain,
      domains.map((d) => d.domain),
      employees.map((e) => e.email),
    );
    if (problem === 'LAST_DOMAIN')
      throw new DomainError(
        'BUSINESS_RULE_VIOLATION',
        'A company needs at least one email domain.',
      );
    if (problem === 'IN_USE')
      throw new DomainError(
        'BUSINESS_RULE_VIOLATION',
        `Active employees still use @${target.domain}. Move or deactivate them first.`,
      );
    await this.prisma.companyDomain.delete({ where: { id: domainId } });
    return this.get(id);
  }

  async addAddress(id: string, input: AddressInput): Promise<CompanyDetail> {
    await this.assertCompany(id);
    await this.prisma.companyAddress.create({ data: { ...input, companyId: id } });
    return this.get(id);
  }

  /** Addresses are archived, never deleted (orders and drops point at them). */
  async updateAddress(
    id: string,
    addressId: string,
    input: UpdateAddressInput,
  ): Promise<CompanyDetail> {
    const [company, address] = await Promise.all([
      this.prisma.company.findUnique({ where: { id }, select: { defaultAddressId: true } }),
      this.prisma.companyAddress.findFirst({
        where: { id: addressId, companyId: id },
        select: { id: true },
      }),
    ]);
    if (!company || !address)
      throw new DomainError('NOT_FOUND', 'Address not found on this company.');
    if (input.isActive === false && company.defaultAddressId === addressId)
      throw new DomainError(
        'BUSINESS_RULE_VIOLATION',
        'Make another address the default before archiving this one.',
      );
    await this.prisma.companyAddress.update({ where: { id: addressId }, data: input });
    return this.get(id);
  }

  async makeDefaultAddress(id: string, addressId: string): Promise<CompanyDetail> {
    const address = await this.prisma.companyAddress.findFirst({
      where: { id: addressId, companyId: id },
      select: { isActive: true },
    });
    if (!address) throw new DomainError('NOT_FOUND', 'Address not found on this company.');
    if (!address.isActive)
      throw new DomainError(
        'BUSINESS_RULE_VIOLATION',
        'Restore the address before making it the default.',
      );
    await this.prisma.company.update({ where: { id }, data: { defaultAddressId: addressId } });
    return this.get(id);
  }

  async addHoliday(id: string, input: CompanyHolidayInput): Promise<CompanyDetail> {
    await this.assertCompany(id);
    await this.prisma.companyHoliday.create({
      data: { companyId: id, name: input.name, date: toDbDate(calendarDate(input.date)) },
    });
    return this.get(id);
  }

  async removeHoliday(id: string, holidayId: string): Promise<CompanyDetail> {
    await this.prisma.companyHoliday.deleteMany({ where: { id: holidayId, companyId: id } });
    return this.get(id);
  }

  /** FR-CMP-04: replace the company's hidden categories and items in one transaction. */
  async setMenuVisibility(id: string, input: MenuVisibilityInput): Promise<CompanyDetail> {
    await this.assertCompany(id);
    const [categories, items] = await Promise.all([
      this.prisma.menuCategory.count({ where: { id: { in: input.hiddenCategoryIds } } }),
      this.prisma.menuItem.count({ where: { id: { in: input.hiddenMenuItemIds } } }),
    ]);
    if (
      categories !== new Set(input.hiddenCategoryIds).size ||
      items !== new Set(input.hiddenMenuItemIds).size
    )
      throw new DomainError(
        'NOT_FOUND',
        'Some menu entries no longer exist. Reload and try again.',
      );
    await this.prisma.$transaction([
      this.prisma.companyHiddenCategory.deleteMany({ where: { companyId: id } }),
      this.prisma.companyHiddenMenuItem.deleteMany({ where: { companyId: id } }),
      this.prisma.companyHiddenCategory.createMany({
        data: [...new Set(input.hiddenCategoryIds)].map((categoryId) => ({
          companyId: id,
          categoryId,
        })),
      }),
      this.prisma.companyHiddenMenuItem.createMany({
        data: [...new Set(input.hiddenMenuItemIds)].map((menuItemId) => ({
          companyId: id,
          menuItemId,
        })),
      }),
    ]);
    return this.get(id);
  }

  private async assertReferences(input: {
    priceTierId?: string | null;
    defaultPackagingTypeId?: string;
    defaultDriverId?: string | null;
  }): Promise<void> {
    if (input.priceTierId) {
      const tier = await this.prisma.priceTier.findUnique({
        where: { id: input.priceTierId },
        select: { id: true },
      });
      if (!tier)
        throw new DomainError('NOT_FOUND', 'That price tier does not exist.', {
          fieldErrors: { priceTierId: ['Unknown tier'] },
        });
    }
    if (input.defaultPackagingTypeId) {
      const packaging = await this.prisma.packagingType.findUnique({
        where: { id: input.defaultPackagingTypeId },
        select: { isActive: true },
      });
      if (!packaging?.isActive)
        throw new DomainError('VALIDATION_FAILED', 'Choose an active packaging type.', {
          fieldErrors: { defaultPackagingTypeId: ['Not an active packaging type'] },
        });
    }
    if (input.defaultDriverId) await assertDriver(this.prisma, input.defaultDriverId);
  }

  private async assertDomainFree(domain: string, companyId: string | null): Promise<void> {
    const [publicRow, owner] = await Promise.all([
      this.prisma.publicEmailDomain.findUnique({ where: { domain }, select: { domain: true } }),
      this.prisma.companyDomain.findUnique({ where: { domain }, select: { companyId: true } }),
    ]);
    const problem = domainProblem(
      domain,
      companyId,
      new Set(publicRow ? [publicRow.domain] : []),
      owner?.companyId ?? null,
    );
    if (problem === 'PUBLIC_EMAIL_DOMAIN')
      throw new DomainError(
        'PUBLIC_EMAIL_DOMAIN',
        `${domain} is a public email provider, not a company domain.`,
        {
          fieldErrors: { domain: ['Public email provider'] },
        },
      );
    if (problem === 'DOMAIN_TAKEN')
      throw new DomainError('DOMAIN_TAKEN', `${domain} already belongs to another company.`, {
        fieldErrors: { domain: ['Used by another company'] },
      });
  }

  private async assertEmailFree(email: string): Promise<void> {
    if (await this.prisma.employee.findUnique({ where: { email }, select: { id: true } }))
      throw new DomainError('UNIQUE_VIOLATION', `${email} is already an employee.`, {
        fieldErrors: { 'owner.email': ['Already used'] },
      });
  }

  private async assertNameFree(name: string, exceptId: string | null): Promise<void> {
    const clash = await this.prisma.company.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });
    if (clash)
      throw new DomainError('UNIQUE_VIOLATION', `A company called ${name} already exists.`, {
        fieldErrors: { name: ['Already used'] },
      });
  }

  private async assertCompany(id: string): Promise<void> {
    if (!(await this.prisma.company.findUnique({ where: { id }, select: { id: true } })))
      throw new DomainError('NOT_FOUND', 'Company not found.');
  }
}
