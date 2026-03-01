/**
 * Identity API Service
 *
 * Handles identity verification via Cashfree Mobile 360.
 * Called non-blocking after authentication when user has given consent.
 */

import { callEdgeFunction } from '../supabase';

// ==============================================
// TYPES
// ==============================================

export interface FetchIdentityRequest {
  action: 'fetch_with_consent';
  consent_timestamp: string;
  name?: string;
}

export interface RecordConsentResult {
  success: boolean;
  data: {
    consent_id: string;
    status: string;
    message: string;
    already_exists: boolean;
  };
}

export interface IdentityResult {
  success: boolean;
  data: {
    verification_id: string;
    status: string;
    name?: string;
    has_pan: boolean;
    has_aadhaar: boolean;
    credit_score?: number;
    risk_safe: boolean;
    message: string;
  };
}

export type IdentityErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export interface IdentityError {
  code: IdentityErrorCode;
  message: string;
}

// ==============================================
// API FUNCTIONS
// ==============================================

/**
 * Record user consent to the backend.
 * Called right after OTP verification when user gave Mobile 360 consent.
 * Persists consent_timestamp, IP, phone to identity_verifications table.
 */
export async function recordConsent(params: {
  consent_timestamp: string;
  name?: string;
}): Promise<{ data: RecordConsentResult | null; error: IdentityError | null }> {
  const { data, error, errorBody } = await callEdgeFunction<RecordConsentResult>(
    'verify-identity',
    {
      action: 'record_consent',
      consent_timestamp: params.consent_timestamp,
      name: params.name,
    },
    true // requireAuth
  );

  if (error) {
    return { data: null, error: mapIdentityError(error, errorBody) };
  }

  return { data, error: null };
}

/**
 * Fetch identity data using pre-recorded consent.
 * Called non-blocking after OTP verification when user gave Mobile 360 consent.
 */
export async function fetchIdentityWithConsent(params: {
  consent_timestamp: string;
  name?: string;
}): Promise<{ data: IdentityResult | null; error: IdentityError | null }> {
  const { data, error, errorBody } = await callEdgeFunction<IdentityResult>(
    'verify-identity',
    {
      action: 'fetch_with_consent',
      consent_timestamp: params.consent_timestamp,
      name: params.name,
    },
    true // requireAuth
  );

  if (error) {
    return {
      data: null,
      error: mapIdentityError(error, errorBody),
    };
  }

  return { data, error: null };
}

// ==============================================
// ERROR MAPPING
// ==============================================

function mapIdentityError(errorMessage: string, errorBody?: Record<string, unknown>): IdentityError {
  // Prefer structured error code from errorBody when available
  const structuredCode = errorBody?.code as string | undefined;
  if (structuredCode) {
    switch (structuredCode) {
      case 'AUTH_ERROR':
        return { code: 'NOT_AUTHENTICATED', message: 'Please sign in to continue' };
      case 'VALIDATION_ERROR':
        return { code: 'VALIDATION_ERROR', message: (errorBody?.message as string) ?? errorMessage };
      case 'RATE_LIMITED':
        return { code: 'UNKNOWN_ERROR', message: 'Too many requests. Please wait a moment.' };
      // Fall through for unknown structured codes — use string matching below
    }
  }

  const lower = errorMessage.toLowerCase();

  if (lower.includes('not authenticated') || lower.includes('unauthorized')) {
    return { code: 'NOT_AUTHENTICATED', message: 'Please sign in to continue' };
  }

  if (lower.includes('validation') || lower.includes('required')) {
    return { code: 'VALIDATION_ERROR', message: errorMessage };
  }

  if (lower.includes('network') || lower.includes('fetch') || lower.includes('timed out')) {
    return { code: 'NETWORK_ERROR', message: 'Please check your internet connection' };
  }

  return { code: 'UNKNOWN_ERROR', message: errorMessage };
}
