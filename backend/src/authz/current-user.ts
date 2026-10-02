import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AppAbility } from '@fernleaf/shared';
import type { Request } from 'express';

/** The authenticated staff member, attached to the request by AccessGuard. */
export interface CurrentUserInfo {
  id: string;
  email: string;
  name: string;
  role: { key: string; name: string };
  permissions: string[];
  ability: AppAbility;
}

export interface AuthenticatedRequest extends Request {
  user?: CurrentUserInfo;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserInfo | undefined =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
