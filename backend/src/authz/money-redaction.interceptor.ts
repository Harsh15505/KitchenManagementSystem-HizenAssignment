import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import type { AuthenticatedRequest } from './current-user';

/**
 * Users without the Money ability (Kitchen, Dispatch, Driver by default) never receive money
 * fields (FR-ACC-05, BR-ACC-03). Works by convention: every money field name ends in `Cents`.
 */
@Injectable()
export class MoneyRedactionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    const redact = user !== undefined && user.ability.cannot('read', 'Money');
    return next.handle().pipe(map((body: unknown) => (redact ? stripMoney(body) : body)));
  }
}

export function stripMoney(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripMoney);
  if (value instanceof Date || value === null || typeof value !== 'object') return value;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (!key.endsWith('Cents')) result[key] = stripMoney(child);
  }
  return result;
}
