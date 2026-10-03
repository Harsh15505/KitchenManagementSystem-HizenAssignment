import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { AuthModule } from './auth/auth.module';
import { AuthzModule } from './authz/authz.module';
import { OriginCheckMiddleware } from './authz/origin.middleware';
import { CatalogueModule } from './catalogue/catalogue.module';
import { PricingModule } from './pricing/pricing.module';
import { MenuModule } from './menu/menu.module';
import { CompaniesModule } from './companies/companies.module';
import { ClockModule } from './clock/clock.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { ReferenceModule } from './reference/reference.module';
import { SettingsModule } from './settings/settings.module';
import { StaffModule } from './staff/staff.module';

@Module({
  imports: [
    PrismaModule,
    ClockModule,
    AuthzModule,
    AuthModule,
    StaffModule,
    SettingsModule,
    ReferenceModule,
    CatalogueModule,
    PricingModule,
    MenuModule,
    CompaniesModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(OriginCheckMiddleware).forRoutes('*splat');
  }
}
