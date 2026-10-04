import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
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

    const prismaCode = prismaErrorCode(exception);
    if (prismaCode === 'P2002') {
      // Unique constraint. Services pre-check the common cases for friendlier field errors;
      // this is the race-proof backstop (two requests creating the same thing at once).
      return {
        error: {
          code: 'UNIQUE_VIOLATION',
          message: 'That value is already in use. Refresh and try again.',
          status: HttpStatus.CONFLICT,
        },
      };
    }
    if (prismaCode === 'P2025') {
      return {
        error: { code: 'NOT_FOUND', message: 'Record not found.', status: HttpStatus.NOT_FOUND },
      };
    }

    if (exception instanceof ThrottlerException) {
      // Nest's default text ("ThrottlerException: Too Many Requests") is useless to a person.
      return {
        error: {
          code: 'RATE_LIMITED',
          message:
            'You are sending requests too quickly. Please slow down and try again in a minute.',
          status: HttpStatus.TOO_MANY_REQUESTS,
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

/** Prisma known-request errors carry a P-code (P2002 unique, P2025 not found). */
function prismaErrorCode(exception: unknown): string | undefined {
  if (typeof exception !== 'object' || exception === null) return undefined;
  const { name, code } = exception as { name?: unknown; code?: unknown };
  return name === 'PrismaClientKnownRequestError' && typeof code === 'string' ? code : undefined;
}

export function toFieldErrors(error: ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root';
    (fieldErrors[path] ??= []).push(issue.message);
  }
  return fieldErrors;
}
