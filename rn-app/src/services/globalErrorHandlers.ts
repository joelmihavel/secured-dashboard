/**
 * Global Error Handlers
 *
 * Catches unhandled promise rejections and fatal JS errors.
 * Must be installed after initSentry() to chain with Sentry's handlers.
 */

import { reportFatalError } from './errorReporting';

// ==============================================
// REJECTION FILTER
// ==============================================

const IGNORED_REJECTION_PATTERNS = [
  'AbortError',
  'cancelled',
  'Network request failed',
  'The operation was aborted',
];

function shouldIgnoreRejection(message: string): boolean {
  return IGNORED_REJECTION_PATTERNS.some((pattern) =>
    message.toLowerCase().includes(pattern.toLowerCase())
  );
}

// ==============================================
// INSTALL HANDLERS
// ==============================================

let installed = false;

/**
 * Install global error handlers. Call once at module level in _layout.tsx after initSentry().
 *
 * Chains with Sentry's existing handlers — saves previous handler and calls it after ours.
 */
export function installGlobalErrorHandlers(): void {
  if (installed) return;
  installed = true;

  // --- Unhandled Promise Rejections ---
  const previousRejectionHandler = (global as Record<string, unknown>).onunhandledrejection as
    | ((event: { reason: unknown }) => void)
    | undefined;

  (global as Record<string, unknown>).onunhandledrejection = (event: {
    reason: unknown;
    preventDefault?: () => void;
  }) => {
    const reason = event?.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === 'string'
          ? reason
          : 'Unknown promise rejection';

    if (!shouldIgnoreRejection(message)) {
      reportFatalError({
        source: 'unhandled_rejection',
        title: 'Something went wrong',
        message: 'An unexpected error occurred. Please try again.',
        technicalMessage: message,
        originalError: reason,
      });
    }

    // Chain previous handler (Sentry, etc.)
    previousRejectionHandler?.(event);
  };

  // --- Fatal JS Errors (ErrorUtils) ---
  const ErrorUtils = (global as Record<string, unknown>).ErrorUtils as
    | {
        getGlobalHandler: () => (error: Error, isFatal?: boolean) => void;
        setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void;
      }
    | undefined;

  if (ErrorUtils) {
    const previousErrorHandler = ErrorUtils.getGlobalHandler();

    ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      if (isFatal) {
        reportFatalError({
          source: 'unhandled_rejection', // Fatal JS errors use same tier-2 path
          title: 'Something went wrong',
          message: 'The app encountered an unexpected error.',
          technicalMessage: error.message,
          originalError: error,
        });
      }

      // Chain previous handler (Sentry + RedBox in dev)
      previousErrorHandler(error, isFatal);
    });
  }
}
