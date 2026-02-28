/**
 * Error Reporting Service -- Unit Tests
 *
 * Tests the central error event bus: ID generation, loop detection,
 * listener management, Sentry integration, and support email URI building.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCaptureError = jest.fn();

jest.mock('../../config/sentry', () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  generateErrorId,
  resetLoopDetection,
  setErrorListener,
  reportFatalError,
  buildSupportEmailUri,
} from '../errorReporting';
import type { ErrorReport } from '../errorReporting';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Cleanup listener + loop state between tests */
function cleanupModule() {
  resetLoopDetection();
  // Unsubscribe any active listener by setting a dummy and immediately unsetting
  const unsub = setErrorListener(() => {});
  unsub();
}

const baseErrorInput = {
  source: 'manual' as const,
  title: 'Test Error',
  message: 'Something went wrong',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('errorReporting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cleanupModule();
  });

  // ===================================================
  // generateErrorId
  // ===================================================

  describe('generateErrorId', () => {
    it('generates IDs matching ERR-XXXXX-XXXX format', () => {
      const id = generateErrorId();
      expect(id).toMatch(/^ERR-[A-Z0-9]{5}-[A-Z0-9]{4}$/);
    });

    it('generates unique IDs across 100 calls', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateErrorId());
      }
      expect(ids.size).toBe(100);
    });

    it('starts with ERR- prefix', () => {
      const id = generateErrorId();
      expect(id.startsWith('ERR-')).toBe(true);
    });

    it('has three parts separated by hyphens', () => {
      const id = generateErrorId();
      const parts = id.split('-');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('ERR');
      expect(parts[1]).toHaveLength(5);
      expect(parts[2]).toHaveLength(4);
    });
  });

  // ===================================================
  // LOOP DETECTION
  // ===================================================

  describe('loop detection', () => {
    it('detects looping when 3+ errors occur within 30s', () => {
      const listener = jest.fn();
      setErrorListener(listener);

      // Fire 3 errors rapidly (all within same tick = same Date.now())
      reportFatalError({ ...baseErrorInput, message: 'Error 1' });
      reportFatalError({ ...baseErrorInput, message: 'Error 2' });
      reportFatalError({ ...baseErrorInput, message: 'Error 3' });

      // The 3rd error should have isLooping = true
      expect(listener).toHaveBeenCalledTimes(3);
      const thirdReport: ErrorReport = listener.mock.calls[2][0];
      expect(thirdReport.isLooping).toBe(true);
    });

    it('does not detect looping for fewer than 3 errors', () => {
      const listener = jest.fn();
      setErrorListener(listener);

      reportFatalError({ ...baseErrorInput, message: 'Error 1' });
      reportFatalError({ ...baseErrorInput, message: 'Error 2' });

      const firstReport: ErrorReport = listener.mock.calls[0][0];
      const secondReport: ErrorReport = listener.mock.calls[1][0];
      expect(firstReport.isLooping).toBe(false);
      expect(secondReport.isLooping).toBe(false);
    });

    it('does not detect looping when errors are spread beyond 30s', () => {
      const listener = jest.fn();
      setErrorListener(listener);

      reportFatalError({ ...baseErrorInput, message: 'Error 1' });

      // Advance past the 30s window
      jest.advanceTimersByTime(31_000);

      reportFatalError({ ...baseErrorInput, message: 'Error 2' });

      jest.advanceTimersByTime(31_000);

      reportFatalError({ ...baseErrorInput, message: 'Error 3' });

      // Each error is in its own window -- no looping
      const thirdReport: ErrorReport = listener.mock.calls[2][0];
      expect(thirdReport.isLooping).toBe(false);
    });

    it('resets loop detection via resetLoopDetection', () => {
      const listener = jest.fn();
      setErrorListener(listener);

      // Trigger 2 errors
      reportFatalError({ ...baseErrorInput, message: 'Error 1' });
      reportFatalError({ ...baseErrorInput, message: 'Error 2' });

      // Reset loop state
      resetLoopDetection();

      // Next error starts fresh count
      reportFatalError({ ...baseErrorInput, message: 'Error 3' });

      const thirdReport: ErrorReport = listener.mock.calls[2][0];
      expect(thirdReport.isLooping).toBe(false);
    });
  });

  // ===================================================
  // LISTENER MANAGEMENT
  // ===================================================

  describe('setErrorListener', () => {
    it('sets listener and returns unsubscribe function', () => {
      const listener = jest.fn();
      const unsub = setErrorListener(listener);

      expect(typeof unsub).toBe('function');

      reportFatalError(baseErrorInput);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('flushes pending error when listener is set', () => {
      // Report an error before any listener is attached
      reportFatalError({ ...baseErrorInput, message: 'Queued error' });

      // Now attach listener -- should receive the queued error immediately
      const listener = jest.fn();
      setErrorListener(listener);

      expect(listener).toHaveBeenCalledTimes(1);
      const flushedReport: ErrorReport = listener.mock.calls[0][0];
      expect(flushedReport.message).toBe('Queued error');
    });

    it('unsubscribe removes listener, new errors queue as pending', () => {
      const listener = jest.fn();
      const unsub = setErrorListener(listener);

      // Listener works
      reportFatalError({ ...baseErrorInput, message: 'Before unsub' });
      expect(listener).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsub();

      // Reset mock to verify no more calls
      listener.mockClear();

      // This error should be queued, not sent to the old listener
      reportFatalError({ ...baseErrorInput, message: 'After unsub' });
      expect(listener).not.toHaveBeenCalled();

      // New listener should get the queued error
      const newListener = jest.fn();
      setErrorListener(newListener);
      expect(newListener).toHaveBeenCalledTimes(1);
      expect(newListener.mock.calls[0][0].message).toBe('After unsub');
    });

    it('replaces previous listener when called again', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      setErrorListener(listener1);
      setErrorListener(listener2);

      reportFatalError(baseErrorInput);

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  // ===================================================
  // reportFatalError
  // ===================================================

  describe('reportFatalError', () => {
    it('creates full ErrorReport with id, timestamp, and isLooping', () => {
      const listener = jest.fn();
      setErrorListener(listener);

      const beforeTime = Date.now();
      reportFatalError(baseErrorInput);

      expect(listener).toHaveBeenCalledTimes(1);
      const report: ErrorReport = listener.mock.calls[0][0];

      expect(report.id).toMatch(/^ERR-[A-Z0-9]{5}-[A-Z0-9]{4}$/);
      expect(report.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(report.isLooping).toBe(false);
      expect(report.source).toBe('manual');
      expect(report.title).toBe('Test Error');
      expect(report.message).toBe('Something went wrong');
    });

    it('queues error as pendingError when no listener is set', () => {
      // No listener set -- error should be queued
      reportFatalError({ ...baseErrorInput, message: 'Pending one' });

      // Attach listener to verify it was queued
      const listener = jest.fn();
      setErrorListener(listener);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].message).toBe('Pending one');
    });

    it('only queues the latest pending error (overwrites previous)', () => {
      // Fire two errors with no listener
      reportFatalError({ ...baseErrorInput, message: 'First pending' });
      reportFatalError({ ...baseErrorInput, message: 'Second pending' });

      const listener = jest.fn();
      setErrorListener(listener);

      // Only the second (latest) should be flushed
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].message).toBe('Second pending');
    });

    it('calls captureError in production (non-__DEV__)', () => {
      const originalDev = (global as Record<string, unknown>).__DEV__;
      (global as Record<string, unknown>).__DEV__ = false;

      const listener = jest.fn();
      setErrorListener(listener);

      const originalError = new Error('Original crash');
      reportFatalError({
        ...baseErrorInput,
        originalError,
      });

      expect(mockCaptureError).toHaveBeenCalledTimes(1);
      expect(mockCaptureError).toHaveBeenCalledWith(
        originalError,
        expect.objectContaining({
          errorId: expect.stringMatching(/^ERR-/),
          source: 'manual',
          isLooping: false,
        })
      );

      (global as Record<string, unknown>).__DEV__ = originalDev;
    });

    it('creates Error from message when originalError is not an Error instance in production', () => {
      const originalDev = (global as Record<string, unknown>).__DEV__;
      (global as Record<string, unknown>).__DEV__ = false;

      const listener = jest.fn();
      setErrorListener(listener);

      reportFatalError({
        ...baseErrorInput,
        technicalMessage: 'HTTP 500 from server',
        originalError: 'string error',
      });

      expect(mockCaptureError).toHaveBeenCalledTimes(1);
      const capturedError = mockCaptureError.mock.calls[0][0];
      expect(capturedError).toBeInstanceOf(Error);
      expect(capturedError.message).toBe('HTTP 500 from server');

      (global as Record<string, unknown>).__DEV__ = originalDev;
    });

    it('uses message when technicalMessage is not provided in production', () => {
      const originalDev = (global as Record<string, unknown>).__DEV__;
      (global as Record<string, unknown>).__DEV__ = false;

      const listener = jest.fn();
      setErrorListener(listener);

      reportFatalError({
        source: 'network_fatal',
        title: 'Network down',
        message: 'Could not reach server',
      });

      expect(mockCaptureError).toHaveBeenCalledTimes(1);
      const capturedError = mockCaptureError.mock.calls[0][0];
      expect(capturedError).toBeInstanceOf(Error);
      expect(capturedError.message).toBe('Could not reach server');

      (global as Record<string, unknown>).__DEV__ = originalDev;
    });

    it('calls captureError in __DEV__ mode (environment tag differentiates)', () => {
      // __DEV__ is true by default in test environment — Sentry should still capture
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const listener = jest.fn();
      setErrorListener(listener);

      reportFatalError(baseErrorInput);

      expect(mockCaptureError).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('logs to console.error in __DEV__ mode', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const listener = jest.fn();
      setErrorListener(listener);

      reportFatalError(baseErrorInput);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ErrorReporting] manual:',
        'Something went wrong',
        undefined, // no originalError provided
      );

      consoleErrorSpy.mockRestore();
    });

    it('includes technicalMessage and action fields when provided', () => {
      const listener = jest.fn();
      setErrorListener(listener);

      reportFatalError({
        ...baseErrorInput,
        technicalMessage: 'ECONNREFUSED at https://api.flent.in',
        action: 'retry',
        actionLabel: 'Try Again',
      });

      const report: ErrorReport = listener.mock.calls[0][0];
      expect(report.technicalMessage).toBe('ECONNREFUSED at https://api.flent.in');
      expect(report.action).toBe('retry');
      expect(report.actionLabel).toBe('Try Again');
    });
  });

  // ===================================================
  // buildSupportEmailUri
  // ===================================================

  describe('buildSupportEmailUri', () => {
    it('returns a mailto: URI with encoded subject and body', () => {
      const report: Partial<ErrorReport> = {
        id: 'ERR-M3K7P-A2XF',
        timestamp: 1740000000000,
        source: 'react_render',
        title: 'Component Crash',
        message: 'Cannot read property of undefined',
      };

      const uri = buildSupportEmailUri(report);

      expect(uri).toContain('mailto:support@flent.in');
      expect(uri).toContain('subject=');
      expect(uri).toContain('body=');

      // Decode and check content
      const subjectMatch = uri.match(/subject=([^&]*)/);
      expect(subjectMatch).not.toBeNull();
      const decodedSubject = decodeURIComponent(subjectMatch![1]);
      expect(decodedSubject).toBe('App Error: ERR-M3K7P-A2XF');

      const bodyMatch = uri.match(/body=(.*)/);
      expect(bodyMatch).not.toBeNull();
      const decodedBody = decodeURIComponent(bodyMatch![1]);
      expect(decodedBody).toContain('Error ID: ERR-M3K7P-A2XF');
      expect(decodedBody).toContain('Source: react_render');
      expect(decodedBody).toContain('Title: Component Crash');
      expect(decodedBody).toContain('Message: Cannot read property of undefined');
      expect(decodedBody).toContain('Time:');
      expect(decodedBody).toContain('Please describe what you were doing');
    });

    it('handles partial report with missing fields', () => {
      const uri = buildSupportEmailUri({});

      const subjectMatch = uri.match(/subject=([^&]*)/);
      const decodedSubject = decodeURIComponent(subjectMatch![1]);
      expect(decodedSubject).toBe('App Error: Unknown');

      const bodyMatch = uri.match(/body=(.*)/);
      const decodedBody = decodeURIComponent(bodyMatch![1]);
      expect(decodedBody).toContain('Error ID: N/A');
      expect(decodedBody).toContain('Time: N/A');
      expect(decodedBody).toContain('Source: N/A');
      expect(decodedBody).toContain('Title: N/A');
      expect(decodedBody).toContain('Message: N/A');
    });

    it('includes ISO timestamp in body when timestamp is provided', () => {
      const ts = 1740000000000;
      const uri = buildSupportEmailUri({ timestamp: ts });
      const bodyMatch = uri.match(/body=(.*)/);
      const decodedBody = decodeURIComponent(bodyMatch![1]);

      const expectedIso = new Date(ts).toISOString();
      expect(decodedBody).toContain(`Time: ${expectedIso}`);
    });
  });
});
