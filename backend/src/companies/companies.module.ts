import { Module } from '@nestjs/common';
import { CompaniesController, EmployeesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { EmployeesService } from './employees.service';

@Module({
  controllers: [CompaniesController, EmployeesController],
  providers: [CompaniesService, EmployeesService],
  exports: [CompaniesService, EmployeesService],
})
export class CompaniesModule {}
