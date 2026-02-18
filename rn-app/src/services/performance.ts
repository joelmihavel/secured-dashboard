/**
 * Performance Monitoring Service (PR-115)
 *
 * Tracks key performance metrics for the app:
 * - Screen render times
 * - API response times
 * - App startup time
 * - Custom performance marks
 *
 * Uses a simple mark/measure pattern compatible with React Native.
 * Integrates with Sentry for production performance tracing.
 *
 * Usage:
 *   // Mark the start of an operation
 *   markStart('payment-flow');
 *
 *   // Mark the end and get duration
 *   const duration = markEnd('payment-flow');
 *   // -> logs: "[Perf] payment-flow: 1234ms"
 *
 *   // Track API call timing
 *   const data = await withTiming('fetch-dashboard', async () => {
 *     return await fetchDashboard();
 *   });
 */

import { InteractionManager } from 'react-native';
import { addBreadcrumb } from '../config/sentry';

// ==============================================
// TYPES
// ==============================================

export interface PerformanceMark {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface PerformanceReport {
  appStartupMs: number | null;
  screenRenders: Record<string, number[]>;
  apiCalls: Record<string, number[]>;
  customMarks: PerformanceMark[];
}

// ==============================================
// MARK STORAGE
// ==============================================

const marks = new Map<string, number>();
const completedMarks: PerformanceMark[] = [];
const screenRenderTimes: Record<string, number[]> = {};
const apiResponseTimes: Record<string, number[]> = {};

let appStartTime: number | null = null;
let appReadyTime: number | null = null;

// Maximum completed marks to keep in memory
const MAX_COMPLETED_MARKS = 200;

// ==============================================
// APP STARTUP TRACKING
// ==============================================

/**
 * Mark app startup time. Call as early as possible (before component rendering).
 * This is typically called at the module level in the entry point.
 */
export function markAppStart(): void {
  appStartTime = Date.now();
}

/**
 * Mark app as ready (interactive). Call after first meaningful paint.
 * Returns the startup duration in milliseconds.
 */
export function markAppReady(): number | null {
  if (appStartTime === null) return null;

  appReadyTime = Date.now();
  const duration = appReadyTime - appStartTime;

  addBreadcrumb('App startup completed', 'performance', {
    duration_ms: duration,
  });

  if (__DEV__) {
    console.log(`[Perf] App startup: ${duration}ms`);
  }

  return duration;
}

/**
 * Get the app startup time (null if not yet measured).
 */
export function getAppStartupTime(): number | null {
  if (appStartTime === null || appReadyTime === null) return null;
  return appReadyTime - appStartTime;
}

// ==============================================
// MARK / MEASURE API
// ==============================================

/**
 * Mark the start of a performance measurement.
 *
 * @param name - Unique name for this measurement
 */
export function markStart(name: string): void {
  marks.set(name, Date.now());
}

/**
 * Mark the end of a performance measurement and return the duration.
 *
 * @param name - The name used in markStart
 * @param metadata - Optional metadata to attach
 * @returns Duration in milliseconds, or null if start mark was not found
 */
export function markEnd(
  name: string,
  metadata?: Record<string, unknown>
): number | null {
  const startTime = marks.get(name);
  if (startTime === undefined) return null;

  const endTime = Date.now();
  const duration = endTime - startTime;

  marks.delete(name);

  const mark: PerformanceMark = {
    name,
    startTime,
    endTime,
    duration,
    metadata,
  };

  // Keep bounded history
  completedMarks.push(mark);
  if (completedMarks.length > MAX_COMPLETED_MARKS) {
    completedMarks.shift();
  }

  if (__DEV__) {
    console.log(`[Perf] ${name}: ${duration}ms`, metadata ?? '');
  }

  return duration;
}

// ==============================================
// SCREEN RENDER TRACKING
// ==============================================

/**
 * Track a screen render time.
 *
 * Call markStart(`screen:${screenName}`) when the component mounts,
 * and trackScreenRender when it finishes rendering.
 *
 * @param screenName - Name of the screen
 * @param durationMs - Render duration in milliseconds
 */
export function trackScreenRender(screenName: string, durationMs: number): void {
  if (!screenRenderTimes[screenName]) {
    screenRenderTimes[screenName] = [];
  }

  screenRenderTimes[screenName].push(durationMs);

  // Keep last 20 renders per screen
  if (screenRenderTimes[screenName].length > 20) {
    screenRenderTimes[screenName].shift();
  }

  addBreadcrumb(`Screen rendered: ${screenName}`, 'performance', {
    duration_ms: durationMs,
  });

  if (__DEV__) {
    console.log(`[Perf] Screen render ${screenName}: ${durationMs}ms`);
  }
}

/**
 * Get average render time for a screen.
 */
export function getAverageRenderTime(screenName: string): number | null {
  const times = screenRenderTimes[screenName];
  if (!times || times.length === 0) return null;

  const sum = times.reduce((a, b) => a + b, 0);
  return Math.round(sum / times.length);
}

// ==============================================
// API TIMING
// ==============================================

/**
 * Track an API call's response time.
 *
 * @param endpoint - API endpoint name
 * @param durationMs - Response time in milliseconds
 */
export function trackApiTime(endpoint: string, durationMs: number): void {
  if (!apiResponseTimes[endpoint]) {
    apiResponseTimes[endpoint] = [];
  }

  apiResponseTimes[endpoint].push(durationMs);

  // Keep last 50 calls per endpoint
  if (apiResponseTimes[endpoint].length > 50) {
    apiResponseTimes[endpoint].shift();
  }

  if (__DEV__ && durationMs > 3000) {
    console.warn(`[Perf] Slow API call ${endpoint}: ${durationMs}ms`);
  }
}

/**
 * Wrap an async function with automatic timing.
 *
 * @param name - Name for the measurement
 * @param fn - Async function to time
 * @param options - Whether to track as API or custom mark
 * @returns The result of the async function
 */
export async function withTiming<T>(
  name: string,
  fn: () => Promise<T>,
  options: { type?: 'api' | 'custom' } = {}
): Promise<T> {
  const { type = 'custom' } = options;
  const start = Date.now();

  try {
    const result = await fn();
    const duration = Date.now() - start;

    if (type === 'api') {
      trackApiTime(name, duration);
    } else {
      markStart(name);
      marks.set(name, start); // Override with actual start time
      markEnd(name);
    }

    return result;
  } catch (error) {
    const duration = Date.now() - start;

    if (type === 'api') {
      trackApiTime(`${name}:error`, duration);
    }

    throw error;
  }
}

// ==============================================
// INTERACTION TRACKING
// ==============================================

/**
 * Run a callback after all pending interactions are complete.
 * Useful for measuring time to interactive.
 *
 * @param name - Label for the measurement
 * @param callback - Function to run after interactions
 */
export function afterInteractions(
  name: string,
  callback: () => void
): void {
  const start = Date.now();

  InteractionManager.runAfterInteractions(() => {
    const duration = Date.now() - start;

    if (__DEV__) {
      console.log(`[Perf] After interactions ${name}: ${duration}ms`);
    }

    addBreadcrumb(`Interactions complete: ${name}`, 'performance', {
      duration_ms: duration,
    });

    callback();
  });
}

// ==============================================
// REPORTING
// ==============================================

/**
 * Get a performance report of all tracked metrics.
 */
export function getPerformanceReport(): PerformanceReport {
  return {
    appStartupMs: getAppStartupTime(),
    screenRenders: { ...screenRenderTimes },
    apiCalls: { ...apiResponseTimes },
    customMarks: [...completedMarks],
  };
}

/**
 * Clear all performance data.
 */
export function clearPerformanceData(): void {
  marks.clear();
  completedMarks.length = 0;
  Object.keys(screenRenderTimes).forEach((key) => delete screenRenderTimes[key]);
  Object.keys(apiResponseTimes).forEach((key) => delete apiResponseTimes[key]);
}

// Auto-mark app start time at module load
markAppStart();
