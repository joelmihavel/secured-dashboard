/**
 * Tests for useAnalytics hook (PR-112)
 *
 * Tests screen auto-tracking, memoized tracking functions,
 * and pre-built event helpers.
 */

import { renderHook } from '@testing-library/react-native';
import { useAnalytics, useScreenAnalytics } from '../useAnalytics';

// Mock the analytics service
const mockTrackEvent = jest.fn();
const mockTrackScreen = jest.fn();
const mockIdentifyUser = jest.fn();
const mockResetAnalytics = jest.fn();

jest.mock('../../services/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  trackScreen: (...args: unknown[]) => mockTrackScreen(...args),
  identifyUser: (...args: unknown[]) => mockIdentifyUser(...args),
  resetAnalytics: (...args: unknown[]) => mockResetAnalytics(...args),
  trackAuthStart: jest.fn(),
  trackOtpVerified: jest.fn(),
  trackPaymentInitiated: jest.fn(),
  trackPaymentSuccess: jest.fn(),
  trackPaymentFailed: jest.fn(),
  AnalyticsEvents: {
    OTP_REQUESTED: 'otp_requested',
    PAYMENT_INITIATED: 'payment_initiated',
  },
}));

jest.mock('../../config/sentry', () => ({
  addBreadcrumb: jest.fn(),
}));

describe('useAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return tracking functions', () => {
    const { result } = renderHook(() => useAnalytics());

    expect(result.current.track).toBeInstanceOf(Function);
    expect(result.current.trackScreenView).toBeInstanceOf(Function);
    expect(result.current.identify).toBeInstanceOf(Function);
    expect(result.current.reset).toBeInstanceOf(Function);
  });

  it('should auto-track screen view when screenName is provided', () => {
    renderHook(() =>
      useAnalytics({
        screenName: 'PaymentScreen',
        screenProperties: { source: 'dashboard' },
      })
    );

    expect(mockTrackScreen).toHaveBeenCalledWith(
      'PaymentScreen',
      { source: 'dashboard' }
    );
  });

  it('should not auto-track when no screenName is provided', () => {
    renderHook(() => useAnalytics());

    expect(mockTrackScreen).not.toHaveBeenCalled();
  });

  it('should only track screen once (not on re-renders)', () => {
    const { rerender } = renderHook(() =>
      useAnalytics({ screenName: 'HomeScreen' })
    );

    rerender({});

    // Should still only be called once
    expect(mockTrackScreen).toHaveBeenCalledTimes(1);
  });

  it('should expose event name constants', () => {
    const { result } = renderHook(() => useAnalytics());

    expect(result.current.events.OTP_REQUESTED).toBe('otp_requested');
    expect(result.current.events.PAYMENT_INITIATED).toBe('payment_initiated');
  });

  it('track function should call trackEvent', () => {
    const { result } = renderHook(() => useAnalytics());

    result.current.track('custom_event', { key: 'val' });

    expect(mockTrackEvent).toHaveBeenCalledWith('custom_event', { key: 'val' });
  });

  it('identify function should call identifyUser', () => {
    const { result } = renderHook(() => useAnalytics());

    result.current.identify('user-001', { role: 'tenant' });

    expect(mockIdentifyUser).toHaveBeenCalledWith('user-001', { role: 'tenant' });
  });

  it('reset function should call resetAnalytics', () => {
    const { result } = renderHook(() => useAnalytics());

    result.current.reset();

    expect(mockResetAnalytics).toHaveBeenCalled();
  });
});

describe('useScreenAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should auto-track the given screen name', () => {
    renderHook(() => useScreenAnalytics('SetupScreen'));

    expect(mockTrackScreen).toHaveBeenCalledWith(
      'SetupScreen',
      undefined
    );
  });

  it('should pass properties for screen tracking', () => {
    renderHook(() =>
      useScreenAnalytics('ProfileScreen', { tab: 'overview' })
    );

    expect(mockTrackScreen).toHaveBeenCalledWith(
      'ProfileScreen',
      { tab: 'overview' }
    );
  });
});
