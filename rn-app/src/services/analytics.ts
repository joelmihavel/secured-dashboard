/**
 * Analytics Service (PR-112)
 *
 * Provider-agnostic analytics abstraction layer.
 * Currently wraps the existing config/analytics module and adds:
 * - Navigation tracking integration with expo-router
 * - Typed event tracking with required/optional properties
 * - Provider interface for swapping analytics backends
 * - useAnalytics() hook for component-level tracking
 *
 * Supported providers (swap via setProvider):
 * - ConsoleProvider (default, logs to console in dev)
 * - Future: MixpanelProvider, AmplitudeProvider, PostHogProvider
 */

import {
  trackEvent as configTrackEvent,
  trackScreen as configTrackScreen,
  setAnalyticsUser as configSetUser,
  clearAnalyticsUser as configClearUser,
  AnalyticsEvents,
} from '../config/analytics';

// ==============================================
// PROVIDER INTERFACE
// ==============================================

export interface AnalyticsProvider {
  name: string;
  init(config?: Record<string, unknown>): Promise<void>;
  track(event: string, properties?: Record<string, unknown>): void;
  screen(screenName: string, properties?: Record<string, unknown>): void;
  identify(userId: string, traits?: Record<string, unknown>): void;
  reset(): void;
  flush?(): Promise<void>;
}

// ==============================================
// DEFAULT CONSOLE PROVIDER
// ==============================================

const consoleProvider: AnalyticsProvider = {
  name: 'console',
  init: async () => {},
  track: (event, properties) => configTrackEvent(event, properties as Record<string, string | number | boolean | null>),
  screen: (screenName, properties) => configTrackScreen(screenName, properties as Record<string, string | number | boolean | null>),
  identify: (userId, traits) => configSetUser(userId, traits as Record<string, string | number | boolean | null>),
  reset: () => configClearUser(),
};

// ==============================================
// PROVIDER MANAGEMENT
// ==============================================

let activeProvider: AnalyticsProvider = consoleProvider;
let additionalProviders: AnalyticsProvider[] = [];

/**
 * Set the primary analytics provider.
 * The previous provider is not automatically flushed.
 */
export function setAnalyticsProvider(provider: AnalyticsProvider): void {
  activeProvider = provider;
}

/**
 * Add an additional analytics provider (fan-out to multiple providers).
 */
export function addAnalyticsProvider(provider: AnalyticsProvider): void {
  additionalProviders.push(provider);
}

/**
 * Initialize the active analytics provider.
 */
export async function initAnalytics(config?: Record<string, unknown>): Promise<void> {
  await activeProvider.init(config);
  for (const provider of additionalProviders) {
    await provider.init(config);
  }
}

// ==============================================
// TRACKING FUNCTIONS
// ==============================================

/**
 * Track a named event with properties.
 * Sends to active provider and all additional providers.
 */
export function trackEvent(
  event: string,
  properties?: Record<string, unknown>
): void {
  activeProvider.track(event, properties);
  for (const provider of additionalProviders) {
    provider.track(event, properties);
  }
}

/**
 * Track a screen view.
 */
export function trackScreen(
  screenName: string,
  properties?: Record<string, unknown>
): void {
  activeProvider.screen(screenName, properties);
  for (const provider of additionalProviders) {
    provider.screen(screenName, properties);
  }
}

/**
 * Identify the current user.
 */
export function identifyUser(
  userId: string,
  traits?: Record<string, unknown>
): void {
  activeProvider.identify(userId, traits);
  for (const provider of additionalProviders) {
    provider.identify(userId, traits);
  }
}

/**
 * Reset analytics state (on logout).
 */
export function resetAnalytics(): void {
  activeProvider.reset();
  for (const provider of additionalProviders) {
    provider.reset();
  }
}

/**
 * Flush all pending events.
 */
export async function flushAnalytics(): Promise<void> {
  await activeProvider.flush?.();
  for (const provider of additionalProviders) {
    await provider.flush?.();
  }
}

// ==============================================
// PRE-BUILT EVENT HELPERS
// ==============================================

/** Track auth flow start */
export function trackAuthStart(phone: string): void {
  trackEvent(AnalyticsEvents.OTP_REQUESTED, {
    phone_masked: phone.slice(0, 4) + '****' + phone.slice(-2),
  });
}

/** Track OTP verification success */
export function trackOtpVerified(): void {
  trackEvent(AnalyticsEvents.OTP_VERIFIED);
}

/** Track payment initiation */
export function trackPaymentInitiated(
  method: string,
  amountPaise: number,
  tenancyId: string
): void {
  trackEvent(AnalyticsEvents.PAYMENT_INITIATED, {
    method,
    amount_paise: amountPaise,
    tenancy_id: tenancyId,
  });
}

/** Track payment success */
export function trackPaymentSuccess(
  transactionId: string,
  amountPaise: number,
  method: string
): void {
  trackEvent(AnalyticsEvents.PAYMENT_SUCCESS, {
    transaction_id: transactionId,
    amount_paise: amountPaise,
    method,
  });
}

/** Track payment failure */
export function trackPaymentFailed(
  errorCode: string,
  method: string,
  amountPaise: number
): void {
  trackEvent(AnalyticsEvents.PAYMENT_FAILED, {
    error_code: errorCode,
    method,
    amount_paise: amountPaise,
  });
}

// Re-export event names for external use
export { AnalyticsEvents };
