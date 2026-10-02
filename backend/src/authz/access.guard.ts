import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DomainError } from '../common/domain-error';
import type { AuthenticatedRequest } from './current-user';
import { ACCESS_KEY, type AccessRule } from './policies';
import { SESSION_COOKIE, SessionService } from './session.service';

/**
 * Global guard, two steps:
 * 1. Authenticate: session cookie → live user (active, token version current).
 * 2. Authorise: the route's CASL policies must all pass against the user's ability.
 * Routes without an access rule never reach here: the boot check refuses to start the app.
 */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rule = this.reflector.getAllAndOverride<AccessRule | undefined>(ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!rule) {
      // Defence in depth for anything the boot check could not see (fail closed).
      throw new DomainError('FORBIDDEN', 'This endpoint has no access rule.');
    }
    if (rule.kind === 'public') return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookies = request.cookies as Record<string, string | undefined> | undefined;
    const user = await this.sessions.resolve(cookies?.[SESSION_COOKIE]);
    if (!user) throw new DomainError('UNAUTHENTICATED', 'Please sign in to continue.');
    request.user = user;

    if (rule.kind === 'policies' && !rule.handlers.every((handler) => handler(user.ability))) {
      throw new DomainError('FORBIDDEN', 'Your role does not allow this action.');
    }
    return true;
  }
}
