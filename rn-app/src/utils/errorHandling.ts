/**
 * Unified Error Handling Utilities
 * Provides consistent error handling patterns across the app
 */

export interface AppError {
  message: string;
  code?: string;
  originalError?: unknown;
}

export type Result<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: AppError;
    };

/**
 * Extracts a user-friendly error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'An unexpected error occurred';
}

/**
 * Creates a standardized error result
 */
export function createError(
  message: string,
  code?: string,
  originalError?: unknown
): { success: false; error: AppError } {
  return {
    success: false,
    error: {
      message,
      code,
      originalError,
    },
  };
}

/**
 * Creates a standardized success result
 */
export function createSuccess<T>(data: T): { success: true; data: T } {
  return {
    success: true,
    data,
  };
}

/**
 * Wraps an async function with standardized error handling
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  errorMessage = 'Operation failed'
): Promise<Result<T>> {
  try {
    const data = await fn();
    return createSuccess(data);
  } catch (error) {
    if (__DEV__) {
      console.error(`${errorMessage}:`, error);
    }
    return createError(
      getErrorMessage(error) || errorMessage,
      undefined,
      error
    );
  }
}

/**
 * Logs errors only in development mode
 */
export function logError(context: string, error: unknown): void {
  if (__DEV__) {
    console.error(`[${context}]`, error);
  }
  // TODO: In production, send to crash reporting service (Sentry, etc.)
}

/**
 * Type guard to check if a value is an Error
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Navigate to the generic error screen.
 * Works with any Expo Router instance.
 *
 * @param router - Expo Router instance from useRouter()
 * @param options.title - Error title (default: "Something went wrong")
 * @param options.message - Error description
 * @param options.actionLabel - Button text (default: "Go Back")
 * @param options.action - "back" | "home" | route path (default: "back")
 */
export function navigateToError(
  router: { replace: (href: never) => void },
  options: {
    title?: string;
    message?: string;
    actionLabel?: string;
    action?: string;
  } = {}
): void {
  router.replace({
    pathname: '/error',
    params: {
      title: options.title ?? 'Something went wrong',
      message: options.message ?? 'An unexpected error occurred. Please try again.',
      actionLabel: options.actionLabel ?? 'Go Back',
      action: options.action ?? 'back',
    },
  } as never);
}
