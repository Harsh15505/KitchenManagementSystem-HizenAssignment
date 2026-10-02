import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { DomainError } from '../common/domain-error';
import { loadEnv } from '../config/env';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence in depth on top of SameSite=Lax cookies: state-changing requests that carry an
 * Origin header must come from our web origin. Non-browser clients (curl, tests) send no Origin.
 */
@Injectable()
export class OriginCheckMiddleware implements NestMiddleware {
  private readonly allowed = new URL(loadEnv().WEB_ORIGIN).origin;

  use(req: Request, _res: Response, next: NextFunction): void {
    const origin = req.headers.origin;
    if (!SAFE_METHODS.has(req.method) && origin && origin !== this.allowed) {
      throw new DomainError('FORBIDDEN', 'Request origin is not allowed.');
    }
    next();
  }
}
