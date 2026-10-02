import { type ErrorCode, type FieldErrors, isApiErrorBody } from '@fernleaf/shared';

/** An API failure in the standard envelope shape (TRD §5.6). */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number,
    readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Same-origin fetch to the NestJS API through the Next.js /api rewrite. The session cookie is
 * sent automatically. Non-2xx responses become ApiError so the UI can switch on `code`.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`/api${path}`, { ...init, headers, credentials: 'same-origin' });
  } catch {
    throw new ApiError('INTERNAL', 'Cannot reach the server. Check your connection.', 0);
  }

  const body: unknown = response.status === 204 ? undefined : await response.json().catch(() => undefined);

  if (!response.ok) {
    if (isApiErrorBody(body)) {
      const { code, message, status, fieldErrors } = body.error;
      throw new ApiError(code, message, status, fieldErrors);
    }
    throw new ApiError('INTERNAL', `Unexpected response (${response.status})`, response.status);
  }
  return body as T;
}
