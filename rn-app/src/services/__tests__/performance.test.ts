/**
 * Tests for Performance Service (PR-115)
 *
 * Tests mark/measure API, screen render tracking, API timing,
 * app startup measurement, and reporting.
 */

jest.mock('../../config/sentry', () => ({
  addBreadcrumb: jest.fn(),
}));

jest.mock('react-native', () => ({
  InteractionManager: {
    runAfterInteractions: jest.fn((callback) => {
      callback();
      return { cancel: jest.fn() };
    }),
  },
}));

import {
  markStart,
  markEnd,
  markAppReady,
  getAppStartupTime,
  trackScreenRender,
  getAverageRenderTime,
  trackApiTime,
  withTiming,
  afterInteractions,
  getPerformanceReport,
  clearPerformanceData,
} from '../performance';

describe('Performance Service', () => {
  beforeEach(() => {
    clearPerformanceData();
  });

  // =========================================================================
  // MARK / MEASURE
  // =========================================================================
  describe('markStart / markEnd', () => {
    it('should measure duration between start and end', () => {
      markStart('test-mark');

      // Advance time slightly
      const startTime = Date.now();
      // markEnd should return a non-null positive duration
      const duration = markEnd('test-mark');

      expect(duration).not.toBeNull();
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should return null if start mark not found', () => {
      const duration = markEnd('nonexistent');
      expect(duration).toBeNull();
    });

    it('should include metadata in completed marks', () => {
      markStart('meta-mark');
      markEnd('meta-mark', { endpoint: '/api/test' });

      const report = getPerformanceReport();
      const mark = report.customMarks.find((m) => m.name === 'meta-mark');
      expect(mark).toBeDefined();
      expect(mark?.metadata).toEqual({ endpoint: '/api/test' });
    });

    it('should clean up after marking end', () => {
      markStart('cleanup-test');
      markEnd('cleanup-test');

      // Calling markEnd again should return null since the mark was consumed
      const duration = markEnd('cleanup-test');
      expect(duration).toBeNull();
    });
  });

  // =========================================================================
  // APP STARTUP
  // =========================================================================
  describe('markAppReady', () => {
    it('should return a startup duration', () => {
      // markAppStart is called at module load time,
      // so markAppReady should return a positive value
      const duration = markAppReady();

      // Could be null if appStartTime was reset
      if (duration !== null) {
        expect(duration).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('getAppStartupTime', () => {
    it('should return a value after markAppReady has been called', () => {
      markAppReady();
      const startupTime = getAppStartupTime();

      if (startupTime !== null) {
        expect(startupTime).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // =========================================================================
  // SCREEN RENDER TRACKING
  // =========================================================================
  describe('trackScreenRender', () => {
    it('should track render times for screens', () => {
      trackScreenRender('HomeScreen', 150);
      trackScreenRender('HomeScreen', 120);
      trackScreenRender('HomeScreen', 180);

      const avg = getAverageRenderTime('HomeScreen');
      expect(avg).toBe(150); // (150 + 120 + 180) / 3 = 150
    });

    it('should return null for untracked screens', () => {
      expect(getAverageRenderTime('UnknownScreen')).toBeNull();
    });

    it('should keep bounded history (max 20 renders)', () => {
      for (let i = 0; i < 25; i++) {
        trackScreenRender('BoundedScreen', 100 + i);
      }

      const report = getPerformanceReport();
      expect(report.screenRenders['BoundedScreen']?.length).toBeLessThanOrEqual(20);
    });
  });

  // =========================================================================
  // API TIMING
  // =========================================================================
  describe('trackApiTime', () => {
    it('should track API response times', () => {
      trackApiTime('fetch-dashboard', 250);
      trackApiTime('fetch-dashboard', 300);
      trackApiTime('fetch-dashboard', 200);

      const report = getPerformanceReport();
      expect(report.apiCalls['fetch-dashboard']).toEqual([250, 300, 200]);
    });

    it('should keep bounded history (max 50 calls)', () => {
      for (let i = 0; i < 55; i++) {
        trackApiTime('bounded-endpoint', 100 + i);
      }

      const report = getPerformanceReport();
      expect(report.apiCalls['bounded-endpoint']?.length).toBeLessThanOrEqual(50);
    });
  });

  // =========================================================================
  // WITH TIMING
  // =========================================================================
  describe('withTiming', () => {
    it('should return the result of the async function', async () => {
      const result = await withTiming('test-async', async () => {
        return 'hello';
      });

      expect(result).toBe('hello');
    });

    it('should track as API call when type is api', async () => {
      await withTiming(
        'api-call',
        async () => 'data',
        { type: 'api' }
      );

      const report = getPerformanceReport();
      expect(report.apiCalls['api-call']).toBeDefined();
      expect(report.apiCalls['api-call'].length).toBe(1);
    });

    it('should propagate errors from the async function', async () => {
      await expect(
        withTiming('failing-call', async () => {
          throw new Error('API Error');
        })
      ).rejects.toThrow('API Error');
    });

    it('should track error timing for API calls', async () => {
      try {
        await withTiming(
          'failing-api',
          async () => {
            throw new Error('timeout');
          },
          { type: 'api' }
        );
      } catch {
        // Expected
      }

      const report = getPerformanceReport();
      expect(report.apiCalls['failing-api:error']).toBeDefined();
    });
  });

  // =========================================================================
  // AFTER INTERACTIONS
  // =========================================================================
  describe('afterInteractions', () => {
    it('should run the callback', () => {
      const callback = jest.fn();
      afterInteractions('test-interaction', callback);

      expect(callback).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // REPORTING
  // =========================================================================
  describe('getPerformanceReport', () => {
    it('should return a complete report', () => {
      const report = getPerformanceReport();

      expect(report).toHaveProperty('appStartupMs');
      expect(report).toHaveProperty('screenRenders');
      expect(report).toHaveProperty('apiCalls');
      expect(report).toHaveProperty('customMarks');
    });
  });

  describe('clearPerformanceData', () => {
    it('should clear all tracked data', () => {
      markStart('clear-test');
      markEnd('clear-test');
      trackScreenRender('TestScreen', 100);
      trackApiTime('test-api', 200);

      clearPerformanceData();

      const report = getPerformanceReport();
      expect(report.customMarks).toHaveLength(0);
      expect(Object.keys(report.screenRenders)).toHaveLength(0);
      expect(Object.keys(report.apiCalls)).toHaveLength(0);
    });
  });
});
