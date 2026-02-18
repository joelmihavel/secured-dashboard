/**
 * Tests for Analytics Service (PR-112)
 *
 * Tests event tracking, screen tracking, user identification,
 * provider abstraction, and pre-built event helpers.
 */

// Mock the config/analytics module
const mockConfigTrackEvent = jest.fn();
const mockConfigTrackScreen = jest.fn();
const mockConfigSetUser = jest.fn();
const mockConfigClearUser = jest.fn();

jest.mock('../../config/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockConfigTrackEvent(...args),
  trackScreen: (...args: unknown[]) => mockConfigTrackScreen(...args),
  setAnalyticsUser: (...args: unknown[]) => mockConfigSetUser(...args),
  clearAnalyticsUser: (...args: unknown[]) => mockConfigClearUser(...args),
  AnalyticsEvents: {
    OTP_REQUESTED: 'otp_requested',
    OTP_VERIFIED: 'otp_verified',
    PAYMENT_INITIATED: 'payment_initiated',
    PAYMENT_SUCCESS: 'payment_success',
    PAYMENT_FAILED: 'payment_failed',
  },
}));

jest.mock('../../config/sentry', () => ({
  addBreadcrumb: jest.fn(),
}));

import {
  trackEvent,
  trackScreen,
  identifyUser,
  resetAnalytics,
  setAnalyticsProvider,
  addAnalyticsProvider,
  initAnalytics,
  flushAnalytics,
  trackAuthStart,
  trackOtpVerified,
  trackPaymentInitiated,
  trackPaymentSuccess,
  trackPaymentFailed,
  AnalyticsEvents,
} from '../analytics';

describe('Analytics Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // CORE TRACKING
  // =========================================================================
  describe('trackEvent', () => {
    it('should call the underlying config trackEvent', () => {
      trackEvent('test_event', { key: 'value' });

      expect(mockConfigTrackEvent).toHaveBeenCalledWith(
        'test_event',
        { key: 'value' }
      );
    });

    it('should work without properties', () => {
      trackEvent('bare_event');

      expect(mockConfigTrackEvent).toHaveBeenCalledWith('bare_event', undefined);
    });
  });

  describe('trackScreen', () => {
    it('should call the underlying config trackScreen', () => {
      trackScreen('HomeScreen', { source: 'deep_link' });

      expect(mockConfigTrackScreen).toHaveBeenCalledWith(
        'HomeScreen',
        { source: 'deep_link' }
      );
    });
  });

  describe('identifyUser', () => {
    it('should call the underlying config setAnalyticsUser', () => {
      identifyUser('user_123', { phone: '+91...' });

      expect(mockConfigSetUser).toHaveBeenCalledWith(
        'user_123',
        { phone: '+91...' }
      );
    });
  });

  describe('resetAnalytics', () => {
    it('should call the underlying config clearAnalyticsUser', () => {
      resetAnalytics();

      expect(mockConfigClearUser).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // PROVIDER ABSTRACTION
  // =========================================================================
  describe('setAnalyticsProvider', () => {
    it('should swap the active provider', () => {
      const mockProvider = {
        name: 'mock',
        init: jest.fn().mockResolvedValue(undefined),
        track: jest.fn(),
        screen: jest.fn(),
        identify: jest.fn(),
        reset: jest.fn(),
      };

      setAnalyticsProvider(mockProvider);
      trackEvent('test', { a: 1 });

      expect(mockProvider.track).toHaveBeenCalledWith('test', { a: 1 });

      // Reset to default after test
      setAnalyticsProvider({
        name: 'console',
        init: async () => {},
        track: mockConfigTrackEvent,
        screen: mockConfigTrackScreen,
        identify: mockConfigSetUser,
        reset: mockConfigClearUser,
      });
    });
  });

  describe('addAnalyticsProvider', () => {
    it('should fan out events to additional providers', () => {
      const extraProvider = {
        name: 'extra',
        init: jest.fn().mockResolvedValue(undefined),
        track: jest.fn(),
        screen: jest.fn(),
        identify: jest.fn(),
        reset: jest.fn(),
      };

      addAnalyticsProvider(extraProvider);
      trackEvent('fan_out_event', { key: 'val' });

      expect(extraProvider.track).toHaveBeenCalledWith('fan_out_event', { key: 'val' });
    });
  });

  describe('initAnalytics', () => {
    it('should initialize providers', async () => {
      await expect(initAnalytics()).resolves.not.toThrow();
    });
  });

  describe('flushAnalytics', () => {
    it('should flush providers without error', async () => {
      await expect(flushAnalytics()).resolves.not.toThrow();
    });
  });

  // =========================================================================
  // PRE-BUILT EVENT HELPERS
  // =========================================================================
  describe('trackAuthStart', () => {
    it('should track otp_requested with masked phone', () => {
      trackAuthStart('9876543210');

      expect(mockConfigTrackEvent).toHaveBeenCalledWith(
        'otp_requested',
        expect.objectContaining({
          phone_masked: expect.stringContaining('****'),
        })
      );
    });
  });

  describe('trackOtpVerified', () => {
    it('should track otp_verified event', () => {
      trackOtpVerified();

      expect(mockConfigTrackEvent).toHaveBeenCalledWith('otp_verified', undefined);
    });
  });

  describe('trackPaymentInitiated', () => {
    it('should track payment_initiated with method and amount', () => {
      trackPaymentInitiated('upi', 3200000, 'tenancy-001');

      expect(mockConfigTrackEvent).toHaveBeenCalledWith(
        'payment_initiated',
        {
          method: 'upi',
          amount_paise: 3200000,
          tenancy_id: 'tenancy-001',
        }
      );
    });
  });

  describe('trackPaymentSuccess', () => {
    it('should track payment_success with transaction details', () => {
      trackPaymentSuccess('txn-123', 3200000, 'upi');

      expect(mockConfigTrackEvent).toHaveBeenCalledWith(
        'payment_success',
        {
          transaction_id: 'txn-123',
          amount_paise: 3200000,
          method: 'upi',
        }
      );
    });
  });

  describe('trackPaymentFailed', () => {
    it('should track payment_failed with error code', () => {
      trackPaymentFailed('INSUFFICIENT_FUNDS', 'upi', 3200000);

      expect(mockConfigTrackEvent).toHaveBeenCalledWith(
        'payment_failed',
        {
          error_code: 'INSUFFICIENT_FUNDS',
          method: 'upi',
          amount_paise: 3200000,
        }
      );
    });
  });

  // =========================================================================
  // EVENT CONSTANTS
  // =========================================================================
  describe('AnalyticsEvents', () => {
    it('should export event name constants', () => {
      expect(AnalyticsEvents.OTP_REQUESTED).toBe('otp_requested');
      expect(AnalyticsEvents.PAYMENT_INITIATED).toBe('payment_initiated');
      expect(AnalyticsEvents.PAYMENT_SUCCESS).toBe('payment_success');
      expect(AnalyticsEvents.PAYMENT_FAILED).toBe('payment_failed');
    });
  });
});
