/**
 * Flent Secured v2 - Error Handling
 *
 * Standard error types and handling for Edge Functions.
 */

import { errorResponse } from "./cors.ts";

// ==============================================
// ERROR TYPES
// ==============================================

/**
 * Base application error with code and status.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 400,
    public details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }

  toResponse(): Response {
    return errorResponse(this.message, this.status, this.code, this.details);
  }
}

/**
 * Authentication/authorization errors.
 */
export class AuthError extends AppError {
  constructor(message = "Authentication required", details?: unknown) {
    super(message, "AUTH_ERROR", 401, details);
    this.name = "AuthError";
  }
}

/**
 * Validation errors for request data.
 */
export class ValidationError extends AppError {
  constructor(message: string, fields?: Record<string, string>) {
    super(message, "VALIDATION_ERROR", 400, { fields });
    this.name = "ValidationError";
  }
}

/**
 * Resource not found errors.
 */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with id ${id} not found` : `${resource} not found`,
      "NOT_FOUND",
      404
    );
    this.name = "NotFoundError";
  }
}

/**
 * Rate limiting errors.
 */
export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super("Too many requests", "RATE_LIMITED", 429, { retryAfter });
    this.name = "RateLimitError";
  }
}

/**
 * External service errors (PayU, Cashfree, etc.).
 */
export class ExternalServiceError extends AppError {
  /** Raw technical message (logged server-side, never sent to client) */
  public readonly rawMessage: string;

  constructor(
    service: string,
    message: string,
    originalError?: unknown
  ) {
    // User-friendly message — raw third-party errors (X-signature, HTTP 502, etc.) must never reach UI
    const userMessage = "Verification service is temporarily unavailable. Please try again in a moment.";
    super(
      userMessage,
      `${service.toUpperCase()}_ERROR`,
      502,
      { service }
    );
    this.name = "ExternalServiceError";
    this.rawMessage = `${service}: ${message}`;
    // Log the raw error server-side for debugging
    console.error(`[ExternalServiceError] ${this.rawMessage}`, originalError ?? "");
  }
}

/**
 * Idempotency conflict errors.
 */
export class IdempotencyError extends AppError {
  constructor(message = "Request already processed with different parameters") {
    super(message, "IDEMPOTENCY_CONFLICT", 409);
    this.name = "IdempotencyError";
  }
}

/**
 * Payment-specific errors.
 */
export class PaymentError extends AppError {
  constructor(
    message: string,
    code: string = "PAYMENT_ERROR",
    details?: unknown
  ) {
    super(message, code, 400, details);
    this.name = "PaymentError";
  }
}

// ==============================================
// ERROR HANDLING UTILITIES
// ==============================================

/**
 * Handles an error and returns an appropriate Response.
 * Logs errors and captures to Sentry in production.
 */
export function handleError(error: unknown, requestId?: string): Response {
  // Log the error
  console.error(`[${requestId ?? "no-request-id"}] Error:`, error);

  // AppError - return structured response
  if (error instanceof AppError) {
    return error.toResponse();
  }

  // Standard Error
  if (error instanceof Error) {
    return errorResponse(error.message, 500, "INTERNAL_ERROR", {
      name: error.name,
      stack: error.stack,
    });
  }

  // Unknown error type
  return errorResponse("An unexpected error occurred", 500, "UNKNOWN_ERROR");
}

/**
 * Wraps an async handler with error handling.
 */
export function withErrorHandling(
  handler: (request: Request) => Promise<Response>
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

    try {
      return await handler(request);
    } catch (error) {
      return handleError(error, requestId);
    }
  };
}

// ==============================================
// ASSERTION HELPERS
// ==============================================

/**
 * Asserts a condition and throws ValidationError if false.
 */
export function assert(
  condition: boolean,
  message: string,
  field?: string
): asserts condition {
  if (!condition) {
    throw new ValidationError(message, field ? { [field]: message } : undefined);
  }
}

/**
 * Asserts a value is not null/undefined.
 */
export function assertDefined<T>(
  value: T | null | undefined,
  name: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new ValidationError(`${name} is required`, { [name]: "Required" });
  }
}
