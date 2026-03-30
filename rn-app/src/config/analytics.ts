/**
 * Analytics Configuration
 *
 * Lightweight analytics wrapper for tracking user events.
 * Currently logs to console in dev; ready to integrate with
 * Mixpanel, Amplitude, or PostHog when a provider is selected.
 *
 * Usage:
 *   trackEvent('payment_initiated', { method: 'upi', amount: 50000 });
 *   trackScreen('home');
 *   setAnalyticsUser('user_123', { phone: '+91...' });
 */

import { addBreadcrumb } from './sentry';

type EventProperties = Record<string, string | number | boolean | null>;

let analyticsUserId: string | null = null;
let analyticsUserProperties: EventProperties = {};

/**
 * Track a named event with optional properties.
 * In production, this would send to Mixpanel/Amplitude/PostHog.
 */
export function trackEvent(name: string, properties?: EventProperties): void {
  const enrichedProperties = {
    ...properties,
    user_id: analyticsUserId,
    timestamp: new Date().toISOString(),
  };

  // Always add as Sentry breadcrumb for crash context
  addBreadcrumb(`analytics:${name}`, 'analytics', enrichedProperties);

  if (__DEV__) {
    console.log(`[Analytics] ${name}`, enrichedProperties);
  }

  // TODO: Send to analytics provider when integrated
  // Example: mixpanel.track(name, enrichedProperties);
}

/**
 * Track a screen view.
 */
export function trackScreen(screenName: string, properties?: EventProperties): void {
  trackEvent('screen_view', { screen: screenName, ...properties });
}

/**
 * Set the current user for analytics attribution.
 */
export function setAnalyticsUser(
  userId: string,
  properties?: EventProperties
): void {
  analyticsUserId = userId;
  if (properties) {
    analyticsUserProperties = { ...analyticsUserProperties, ...properties };
  }

  if (__DEV__) {
    console.log(`[Analytics] User identified: ${userId}`, properties);
  }
}

/**
 * Clear analytics user (on logout).
 */
export function clearAnalyticsUser(): void {
  analyticsUserId = null;
  analyticsUserProperties = {};
}

// ==============================================
// PRE-DEFINED EVENT NAMES
// ==============================================

export const AnalyticsEvents = {
  // Auth
  OTP_REQUESTED: 'otp_requested',
  OTP_VERIFIED: 'otp_verified',
  AUTH_SIGNED_IN: 'auth_signed_in',
  AUTH_SIGNED_OUT: 'auth_signed_out',

  // Waitlist
  WAITLIST_JOINED: 'waitlist_joined',
  REFERRAL_APPLIED: 'referral_applied',
  REFERRAL_SHARED: 'referral_shared',

  // Agreement
  DOCUMENT_UPLOADED: 'document_uploaded',
  DOCUMENT_PROCESSED: 'document_processed',
  AGREEMENT_CONFIRMED: 'agreement_confirmed',

  // Setup
  BANK_VERIFIED: 'bank_verified',
  UTILITY_VERIFIED: 'utility_verified',
  LANDLORD_INVITED: 'landlord_invited',

  // Payments
  PAYMENT_INITIATED: 'payment_initiated',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  PAYMENT_METHOD_ADDED: 'payment_method_added',
  PAYMENT_METHOD_DELETED: 'payment_method_deleted',
  SCHEDULE_CREATED: 'schedule_created',
  SCHEDULE_PAUSED: 'schedule_paused',
  SCHEDULE_CANCELLED: 'schedule_cancelled',

  // Profile
  PROFILE_UPDATED: 'profile_updated',

  // OTA Updates
  OTA_CHECK: 'ota_check',
  OTA_DOWNLOADED: 'ota_downloaded',
  OTA_RELOAD: 'ota_reload',
  OTA_EMERGENCY_LAUNCH: 'ota_emergency_launch',
  OTA_BANNER_DISMISSED: 'ota_banner_dismissed',
  OTA_BANNER_APPLY_TAPPED: 'ota_banner_apply_tapped',
  OTA_CRITICAL_AUTO_APPLY: 'ota_critical_auto_apply',
  OTA_ERROR: 'ota_error',
} as const;
