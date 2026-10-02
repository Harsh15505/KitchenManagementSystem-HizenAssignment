import { ERROR_STATUS, type ErrorCode, type FieldErrors } from '@fernleaf/shared';

/**
 * Thrown by services when a business rule is violated. The exception filter turns it
 * into the standard error envelope, with the HTTP status mapped from the code.
 */
export class DomainError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly options: { fieldErrors?: FieldErrors; details?: Record<string, unknown> } = {},
  ) {
    super(message);
    this.name = 'DomainError';
    this.status = ERROR_STATUS[code];
  }
}
