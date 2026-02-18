/**
 * Analytics Hook (PR-112)
 *
 * React hook wrapper around the analytics service.
 * Provides convenient tracking functions for use in components.
 *
 * Features:
 * - Auto-tracks screen views when used with screen name
 * - Memoized tracking functions to avoid re-renders
 * - Typed event tracking
 * - Integrates with expo-router navigation state
 *
 * Usage:
 *   const { track, trackScreenView } = useAnalytics();
 *
 *   // Track a custom event
 *   track('button_pressed', { button: 'pay_now' });
 *
 *   // Track screen view (auto-tracked in screen components)
 *   trackScreenView('PaymentScreen');
 */

import { useEffect, useCallback, useRef } from 'react';
import {
  trackEvent,
  trackScreen,
  identifyUser,
  resetAnalytics,
  trackAuthStart,
  trackOtpVerified,
  trackPaymentInitiated,
  trackPaymentSuccess,
  trackPaymentFailed,
  AnalyticsEvents,
} from '../services/analytics';

// ==============================================
// MAIN HOOK
// ==============================================

interface UseAnalyticsOptions {
  /** Screen name to auto-track on mount */
  screenName?: string;
  /** Additional properties for the auto screen track */
  screenProperties?: Record<string, unknown>;
}

/**
 * Analytics hook for tracking events and screen views.
 *
 * @param options - Optional auto-tracking configuration
 * @returns Tracking functions
 */
export function useAnalytics(options: UseAnalyticsOptions = {}) {
  const { screenName, screenProperties } = options;
  const hasTrackedScreen = useRef(false);

  // Auto-track screen view on mount
  useEffect(() => {
    if (screenName && !hasTrackedScreen.current) {
      trackScreen(screenName, screenProperties);
      hasTrackedScreen.current = true;
    }
  }, [screenName, screenProperties]);

  // Memoized tracking functions
  const track = useCallback(
    (event: string, properties?: Record<string, unknown>) => {
      trackEvent(event, properties);
    },
    []
  );

  const trackScreenView = useCallback(
    (name: string, properties?: Record<string, unknown>) => {
      trackScreen(name, properties);
    },
    []
  );

  const identify = useCallback(
    (userId: string, traits?: Record<string, unknown>) => {
      identifyUser(userId, traits);
    },
    []
  );

  const reset = useCallback(() => {
    resetAnalytics();
  }, []);

  return {
    // Core tracking
    track,
    trackScreenView,
    identify,
    reset,

    // Pre-built event helpers
    trackAuthStart,
    trackOtpVerified,
    trackPaymentInitiated,
    trackPaymentSuccess,
    trackPaymentFailed,

    // Event name constants
    events: AnalyticsEvents,
  };
}

/**
 * Hook for screen-level analytics.
 *
 * Use this at the top level of screen components
 * to automatically track screen views.
 *
 * Usage:
 *   function PaymentScreen() {
 *     useScreenAnalytics('PaymentScreen', { source: 'dashboard' });
 *     return <View>...</View>;
 *   }
 */
export function useScreenAnalytics(
  screenName: string,
  properties?: Record<string, unknown>
) {
  return useAnalytics({ screenName, screenProperties: properties });
}
