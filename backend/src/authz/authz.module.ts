import { Global, Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, DiscoveryModule } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { loadEnv } from '../config/env';
import { AccessGuard } from './access.guard';
import { MoneyRedactionInterceptor } from './money-redaction.interceptor';
import { RouteAccessCheck } from './route-access.check';
import { SessionService } from './session.service';

@Global()
@Module({
  imports: [
    DiscoveryModule,
    JwtModule.registerAsync({ useFactory: () => ({ secret: loadEnv().JWT_SECRET }) }),
  ],
  providers: [
    SessionService,
    RouteAccessCheck,
    { provide: APP_GUARD, useClass: AccessGuard },
    { provide: APP_INTERCEPTOR, useClass: MoneyRedactionInterceptor },
  ],
  exports: [SessionService],
})
export class AuthzModule {}
