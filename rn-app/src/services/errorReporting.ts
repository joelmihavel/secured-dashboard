/**
 * Error Reporting — Central Event Bus
 *
 * Coordinates between error sources (global handlers, React Query, ErrorBoundary)
 * and the error screen. Single Sentry capture point to prevent duplicates.
 */

import { captureError } from '../config/sentry';

// ==============================================
// TYPES
// ==============================================

export type ErrorSource =
  | 'unhandled_rejection'
  | 'react_render'
  | 'query_error'
  | 'mutation_error'
  | 'network_fatal'
  | 'manual';

export interface ErrorReport {
  id: string;
  timestamp: number;
  source: ErrorSource;
  title: string;
  message: string;
  technicalMessage?: string;
  action?: string;
  actionLabel?: string;
  isLooping?: boolean;
  originalError?: unknown;
}

// ==============================================
// ERROR ID GENERATION
// ==============================================

/**
 * Generate a short, human-readable error ID.
 * Format: ERR-{base36_timestamp}-{random}
 * Example: ERR-M3K7P-A2XF
 */
export function generateErrorId(): string {
  const ts = Date.now().toString(36).toUpperCase().slice(-5);
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ERR-${ts}-${rand}`;
}

// ==============================================
// LOOP DETECTION
// ==============================================

const ERROR_TIMESTAMPS: number[] = [];
const LOOP_WINDOW_MS = 30_000; // 30 seconds
const LOOP_THRESHOLD = 3;

function detectLoop(): boolean {
  const now = Date.now();
  ERROR_TIMESTAMPS.push(now);

  // Keep only timestamps within the window
  while (ERROR_TIMESTAMPS.length > 0 && now - ERROR_TIMESTAMPS[0] > LOOP_WINDOW_MS) {
    ERROR_TIMESTAMPS.shift();
  }

  return ERROR_TIMESTAMPS.length >= LOOP_THRESHOLD;
}

/** Reset loop detection state (useful after successful recovery) */
export function resetLoopDetection(): void {
  ERROR_TIMESTAMPS.length = 0;
}

// ==============================================
// EVENT BUS — Single Consumer
// ==============================================

type ErrorListener = (report: ErrorReport) => void;

let listener: ErrorListener | null = null;
let pendingError: ErrorReport | null = null;

/**
 * Set the single error listener (useErrorNavigation hook).
 * If a pending error exists, it flushes immediately.
 */
export function setErrorListener(fn: ErrorListener): () => void {
  listener = fn;

  // Flush any error that fired before the listener attached
  if (pendingError) {
    const queued = pendingError;
    pendingError = null;
    fn(queued);
  }

  return () => {
    listener = null;
  };
}

/**
 * Report a fatal error — single Sentry capture point.
 *
 * All error sources (global handlers, React Query, ErrorBoundary) route through here.
 * Do NOT call captureError() from anywhere else for the same error.
 */
export function reportFatalError(report: Omit<ErrorReport, 'id' | 'timestamp' | 'isLooping'>): void {
  const isLooping = detectLoop();

  const fullReport: ErrorReport = {
    ...report,
    id: generateErrorId(),
    timestamp: Date.now(),
    isLooping,
  };

  // Single Sentry capture point
  if (!__DEV__) {
    const error =
      report.originalError instanceof Error
        ? report.originalError
        : new Error(report.technicalMessage || report.message);

    captureError(error, {
      errorId: fullReport.id,
      source: fullReport.source,
      isLooping,
    });
  }

  if (__DEV__) {
    console.error(`[ErrorReporting] ${fullReport.source}:`, fullReport.message, report.originalError);
  }

  if (listener) {
    listener(fullReport);
  } else {
    // Queue for later — router may not be mounted yet
    pendingError = fullReport;
  }
}

// ==============================================
// SUPPORT EMAIL
// ==============================================

const SUPPORT_EMAIL = 'support@flent.in';

/**
 * Build a pre-filled mailto URI with all error context.
 */
export function buildSupportEmailUri(report: Partial<ErrorReport>): string {
  const subject = encodeURIComponent(`App Error: ${report.id || 'Unknown'}`);
  const body = encodeURIComponent(
    [
      `Error ID: ${report.id || 'N/A'}`,
      `Time: ${report.timestamp ? new Date(report.timestamp).toISOString() : 'N/A'}`,
      `Source: ${report.source || 'N/A'}`,
      `Title: ${report.title || 'N/A'}`,
      `Message: ${report.message || 'N/A'}`,
      '',
      'Please describe what you were doing when this error occurred:',
      '',
    ].join('\n')
  );

  return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
}
