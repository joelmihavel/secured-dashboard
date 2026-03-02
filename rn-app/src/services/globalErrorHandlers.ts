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
  'InvalidStateError',    // WebSocket send() on CLOSING connection after iOS background
  'DOMException',         // Supabase Realtime WebSocket lifecycle errors
  'cancelled',
  'Network request failed',
  'The operation was aborted',
  'not usable',           // "An attempt was made to use an object that is not, or is no longer, usable"
  'no longer usable',
  'WebSocket',            // Any WebSocket lifecycle error
  'CLOSING',              // WebSocket CLOSING state errors
  'CLOSED',               // WebSocket CLOSED state errors
  'connection',           // Connection-related transient errors
  'socket hang up',       // Server closed connection
  'ECONNRESET',           // TCP connection reset
  'ETIMEDOUT',            // Connection timeout
  'fetch failed',         // Fetch API failures during background
  'Failed to fetch',      // Fetch API failures (alternate message)
  'Load failed',          // iOS network load failures on resume
  'PropertyDOM',          // react-native-screens internal error during navigation transitions
  'doesn\'t exist',       // Generic "Property X doesn't exist" from Fabric after background
  'does not exist',       // Alternate phrasing
  'not yet been mounted', // Screen not mounted yet after resume
  // Waitlist/invite code expected errors — handled inline by UI
  'invite code',
  'referral code',
  'INVALID_INVITE_CODE',
  'INVALID_CODE',
  'INVALID_REFERRAL',
  'INVITE_CODE_USED',
  'ALREADY_APPLIED',
  'ALREADY_CLAIMED',
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

    if (shouldIgnoreRejection(message)) {
      // Swallow entirely — don't chain to Sentry or any previous handler.
      // These are transient lifecycle errors (WebSocket, PropertyDOM, etc.)
      if (__DEV__) {
        console.log('[GlobalErrorHandler] Swallowed rejection:', message);
      }
      return;
    }

    reportFatalError({
      source: 'unhandled_rejection',
      title: 'Something went wrong',
      message: 'An unexpected error occurred. Please try again.',
      technicalMessage: message,
      originalError: reason,
    });

    // Chain previous handler (Sentry, etc.) only for non-transient errors
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
      // Swallow transient native errors entirely — don't show to user or chain
      // to RedBox/error overlay. These are iOS background lifecycle errors
      // (PropertyDOM, WebSocket) that resolve on the next render cycle.
      if (shouldIgnoreRejection(error.message)) {
        if (__DEV__) {
          console.log('[GlobalErrorHandler] Swallowed transient error:', error.message);
        }
        return; // Do NOT chain to previous handler — prevents error overlay
      }

      if (isFatal) {
        reportFatalError({
          source: 'unhandled_rejection',
          title: 'Something went wrong',
          message: 'The app encountered an unexpected error.',
          technicalMessage: error.message,
          originalError: error,
        });
      }

      // Chain previous handler (Sentry + RedBox in dev) only for non-transient errors
      previousErrorHandler(error, isFatal);
    });
  }
}
