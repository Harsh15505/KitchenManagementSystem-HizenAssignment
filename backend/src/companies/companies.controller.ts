import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  addressInputSchema,
  companyDomainSchema,
  companyHolidaySchema,
  companyListQuerySchema,
  createCompanySchema,
  createEmployeeSchema,
  employeeListQuerySchema,
  menuVisibilitySchema,
  moveEmployeeSchema,
  updateAddressSchema,
  updateCompanySchema,
  updateEmployeeSchema,
} from '@fernleaf/shared';
import { createZodDto } from 'nestjs-zod';
import { CheckPolicies } from '../authz/policies';
import { PrismaService } from '../prisma/prisma.service';
import { CompaniesService } from './companies.service';
import { listDrivers } from './drivers';
import { EmployeesService } from './employees.service';

class CompanyListQueryDto extends createZodDto(companyListQuerySchema) {}
class CreateCompanyDto extends createZodDto(createCompanySchema) {}
class UpdateCompanyDto extends createZodDto(updateCompanySchema) {}
class DomainDto extends createZodDto(companyDomainSchema) {}
class AddressDto extends createZodDto(addressInputSchema) {}
class UpdateAddressDto extends createZodDto(updateAddressSchema) {}
class HolidayDto extends createZodDto(companyHolidaySchema) {}
class MenuVisibilityDto extends createZodDto(menuVisibilitySchema) {}
class EmployeeListQueryDto extends createZodDto(employeeListQuerySchema) {}
class CreateEmployeeDto extends createZodDto(createEmployeeSchema) {}
class UpdateEmployeeDto extends createZodDto(updateEmployeeSchema) {}
class MoveEmployeeDto extends createZodDto(moveEmployeeSchema) {}

const readCompanies = CheckPolicies((a) => a.can('read', 'Company'));
const manageCompanies = CheckPolicies((a) => a.can('manage', 'Company'));
const readEmployees = CheckPolicies((a) => a.can('read', 'Employee'));
const manageEmployees = CheckPolicies((a) => a.can('manage', 'Employee'));

/** FR-CMP-01..04 (TRD §API companies). */
@Controller('companies')
export class CompaniesController {
  constructor(
    private readonly companies: CompaniesService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @readCompanies
  list(@Query() query: CompanyListQueryDto) {
    return this.companies.list(query);
  }

  /** BR-CMP-03: who can be picked as a default driver. */
  @Get('driver-options')
  @readCompanies
  driverOptions() {
    return listDrivers(this.prisma);
  }

  @Get(':id')
  @readCompanies
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.companies.get(id);
  }

  @Post()
  @manageCompanies
  create(@Body() body: CreateCompanyDto) {
    return this.companies.create(body);
  }

  @Patch(':id')
  @manageCompanies
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateCompanyDto) {
    return this.companies.update(id, body);
  }

  @Post(':id/domains')
  @manageCompanies
  addDomain(@Param('id', ParseUUIDPipe) id: string, @Body() body: DomainDto) {
    return this.companies.addDomain(id, body.domain);
  }

  @Delete(':id/domains/:domainId')
  @manageCompanies
  removeDomain(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('domainId', ParseUUIDPipe) domainId: string,
  ) {
    return this.companies.removeDomain(id, domainId);
  }

  @Post(':id/addresses')
  @manageCompanies
  addAddress(@Param('id', ParseUUIDPipe) id: string, @Body() body: AddressDto) {
    return this.companies.addAddress(id, body);
  }

  @Patch(':id/addresses/:addressId')
  @manageCompanies
  updateAddress(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @Body() body: UpdateAddressDto,
  ) {
    return this.companies.updateAddress(id, addressId, body);
  }

  @Put(':id/default-address/:addressId')
  @manageCompanies
  makeDefaultAddress(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ) {
    return this.companies.makeDefaultAddress(id, addressId);
  }

  @Post(':id/holidays')
  @manageCompanies
  addHoliday(@Param('id', ParseUUIDPipe) id: string, @Body() body: HolidayDto) {
    return this.companies.addHoliday(id, body);
  }

  @Delete(':id/holidays/:holidayId')
  @manageCompanies
  removeHoliday(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('holidayId', ParseUUIDPipe) holidayId: string,
  ) {
    return this.companies.removeHoliday(id, holidayId);
  }

  @Put(':id/menu-visibility')
  @manageCompanies
  setMenuVisibility(@Param('id', ParseUUIDPipe) id: string, @Body() body: MenuVisibilityDto) {
    return this.companies.setMenuVisibility(id, body);
  }
}

/** FR-EMP-01/02 (TRD §API employees). */
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  @readEmployees
  list(@Query() query: EmployeeListQueryDto) {
    return this.employees.list(query);
  }

  @Get(':id')
  @readEmployees
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.employees.get(id);
  }

  @Post()
  @manageEmployees
  create(@Body() body: CreateEmployeeDto) {
    return this.employees.create(body);
  }

  @Patch(':id')
  @manageEmployees
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateEmployeeDto) {
    return this.employees.update(id, body);
  }

  @Post(':id/move')
  @manageEmployees
  move(@Param('id', ParseUUIDPipe) id: string, @Body() body: MoveEmployeeDto) {
    return this.employees.move(id, body);
  }

  /** Ownership is a company setting, so it needs company rights. */
  @Post(':id/make-owner')
  @manageCompanies
  makeOwner(@Param('id', ParseUUIDPipe) id: string) {
    return this.employees.makeOwner(id);
  }
}
