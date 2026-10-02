/**
 * The single error envelope every non-2xx API response uses (TRD §5.6).
 * The frontend switches on `code`, shows `message`, and maps `fieldErrors` onto form fields.
 */

export const ERROR_STATUS = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  ORDER_VERSION_CONFLICT: 409,
  INVALID_TRANSITION: 409,
  UNIT_ALREADY_STARTED: 409,
  UNIT_ALREADY_DONE: 409,
  ALREADY_INVOICED: 409,
  DROP_ALREADY_DISPATCHED: 409,
  UNIQUE_VIOLATION: 409,
  BUSINESS_RULE_VIOLATION: 422,
  ORDER_LOCKED: 422,
  DATE_NOT_DELIVERABLE: 422,
  DISH_NOT_AVAILABLE: 422,
  COMBINATION_INVALID: 422,
  QUANTITY_MISMATCH: 422,
  MIN_QTY_NOT_MET: 422,
  FLAG_NOT_ALLOWED: 422,
  CUTOFF_NOT_REACHED: 422,
  PUBLIC_EMAIL_DOMAIN: 422,
  DOMAIN_TAKEN: 422,
  EMAIL_DOMAIN_MISMATCH: 422,
  OWNER_CANNOT_MOVE: 422,
  DRIVER_REQUIRED: 422,
  DROP_NOT_READY: 422,
  PORTION_SIZE_UNSUPPORTED: 422,
  TIER_CYCLE: 422,
  ALLERGEN_ACK_REQUIRED: 422,
  INVARIANT_VIOLATION: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

/** Field path (e.g. `lines.0.combinations.1.quantity`) → human-readable messages. */
export type FieldErrors = Record<string, string[]>;

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    status: number;
    fieldErrors?: FieldErrors;
    details?: Record<string, unknown>;
  };
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const error = (value as { error: unknown }).error;
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error;
}
