import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiErrorBody, ErrorCode, FieldErrors } from '@fernleaf/shared';
import type { Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';
import { DomainError } from './domain-error';

const CODE_BY_STATUS: Record<number, ErrorCode> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'BUSINESS_RULE_VIOLATION',
  429: 'RATE_LIMITED',
};

/** Every error leaves the API in one shape: { error: { code, message, status, fieldErrors?, details? } }. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);
    if (body.error.status >= 500) this.logger.error(exception);
    res.status(body.error.status).json(body);
  }

  private toBody(exception: unknown): ApiErrorBody {
    if (exception instanceof DomainError) {
      return {
        error: {
          code: exception.code,
          message: exception.message,
          status: exception.status,
          ...exception.options,
        },
      };
    }

    if (exception instanceof ZodValidationException) {
      const zodError = exception.getZodError();
      return {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Some fields are invalid. Fix the highlighted fields and try again.',
          status: HttpStatus.BAD_REQUEST,
          ...(zodError instanceof ZodError ? { fieldErrors: toFieldErrors(zodError) } : {}),
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const message =
        typeof response === 'object' && response !== null && 'message' in response
          ? String((response as { message: unknown }).message)
          : exception.message;
      return { error: { code: CODE_BY_STATUS[status] ?? 'INTERNAL', message, status } };
    }

    return {
      error: {
        code: 'INTERNAL',
        message: 'Something went wrong on our side. Please try again.',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      },
    };
  }
}

export function toFieldErrors(error: ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root';
    (fieldErrors[path] ??= []).push(issue.message);
  }
  return fieldErrors;
}
