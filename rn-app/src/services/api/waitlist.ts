/**
 * Waitlist API Service
 *
 * Handles waitlist status and referral code operations via Supabase edge functions.
 * Implements the same patterns as the iOS WaitlistViewModel.
 */

import { callEdgeFunction } from '../supabase';

// ==============================================
// TYPES
// ==============================================

export type WaitlistState =
  | 'pending'
  | 'pending_long'
  | 'approved'
  | 'rejected';

export interface WaitlistStatusData {
  state: WaitlistState;
  position: number | null;
  estimatedWaitDays: number | null;
  submissionDate: string | null;
  currentOnboarded: number;
  totalMemberSlots: number;
  estimatedReviewTime: string;
  rejectionReasons: string[];
  nextApplicationCountdown: number;
}

export interface WaitlistStatusResponse {
  success: boolean;
  data: WaitlistStatusData;
}

export interface ApplyReferralRequest {
  code: string;
}

export interface ApplyReferralResponse {
  success: boolean;
  data: {
    valid: boolean;
    message: string;
    newPosition?: number;
    priorityAccess?: boolean;
  };
}

export interface ValidateReferralResponse {
  success: boolean;
  data: {
    valid: boolean;
    message: string;
  };
}

export type WaitlistErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'INVALID_REFERRAL'
  | 'REFERRAL_EXPIRED'
  | 'REFERRAL_ALREADY_USED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export interface WaitlistError {
  code: WaitlistErrorCode;
  message: string;
}

// ==============================================
// API FUNCTIONS
// ==============================================

/**
 * Get current waitlist status for the authenticated user
 *
 * @returns Promise with waitlist status data or error
 */
export async function getWaitlistStatus(): Promise<{
  data: WaitlistStatusData | null;
  error: WaitlistError | null;
}> {
  const { data, error } = await callEdgeFunction<WaitlistStatusResponse>(
    'get-waitlist-status',
    {},
    true // requireAuth
  );

  if (error) {
    return {
      data: null,
      error: mapWaitlistError(error),
    };
  }

  if (!data?.success) {
    return {
      data: null,
      error: { code: 'UNKNOWN_ERROR', message: 'Failed to get waitlist status' },
    };
  }

  return { data: data.data, error: null };
}

/**
 * Apply a referral code to get priority access
 *
 * @param code - 4-character referral code
 * @returns Promise with referral result or error
 */
export async function applyReferralCode(
  code: string
): Promise<{ data: ApplyReferralResponse['data'] | null; error: WaitlistError | null }> {
  // Validate code format
  if (!code || code.length !== 4) {
    return {
      data: null,
      error: { code: 'INVALID_REFERRAL', message: 'Referral code must be 4 characters' },
    };
  }

  const { data, error } = await callEdgeFunction<ApplyReferralResponse>(
    'apply-referral-code',
    { code: code.toUpperCase() },
    true // requireAuth
  );

  if (error) {
    return {
      data: null,
      error: mapWaitlistError(error),
    };
  }

  if (!data?.success) {
    return {
      data: null,
      error: { code: 'UNKNOWN_ERROR', message: 'Failed to apply referral code' },
    };
  }

  if (!data.data.valid) {
    return {
      data: null,
      error: { code: 'INVALID_REFERRAL', message: data.data.message },
    };
  }

  return { data: data.data, error: null };
}

/**
 * Validate a referral code without applying it
 *
 * @param code - 4-character referral code
 * @returns Promise with validation result or error
 */
export async function validateReferralCode(
  code: string
): Promise<{ data: ValidateReferralResponse['data'] | null; error: WaitlistError | null }> {
  // Validate code format
  if (!code || code.length !== 4) {
    return {
      data: null,
      error: { code: 'INVALID_REFERRAL', message: 'Referral code must be 4 characters' },
    };
  }

  const { data, error } = await callEdgeFunction<ValidateReferralResponse>(
    'validate-referral-code',
    { code: code.toUpperCase() },
    false // no auth required for validation only
  );

  if (error) {
    return {
      data: null,
      error: mapWaitlistError(error),
    };
  }

  return { data: data?.data ?? null, error: null };
}

// ==============================================
// ERROR MAPPING
// ==============================================

function mapWaitlistError(errorMessage: string): WaitlistError {
  const lowerMessage = errorMessage.toLowerCase();

  if (lowerMessage.includes('not authenticated') || lowerMessage.includes('unauthorized')) {
    return { code: 'NOT_AUTHENTICATED', message: 'Please sign in to continue' };
  }

  if (lowerMessage.includes('invalid') && lowerMessage.includes('referral')) {
    return { code: 'INVALID_REFERRAL', message: 'This referral code is not valid' };
  }

  if (lowerMessage.includes('expired')) {
    return { code: 'REFERRAL_EXPIRED', message: 'This referral code has expired' };
  }

  if (lowerMessage.includes('already used') || lowerMessage.includes('claimed')) {
    return { code: 'REFERRAL_ALREADY_USED', message: 'This referral code has already been used' };
  }

  if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
    return { code: 'NETWORK_ERROR', message: 'Please check your internet connection' };
  }

  return { code: 'UNKNOWN_ERROR', message: errorMessage };
}

// ==============================================
// MOCK DATA FOR DEVELOPMENT
// ==============================================

/**
 * Mock waitlist status for development/testing
 */
export function getMockWaitlistStatus(state: WaitlistState = 'pending'): WaitlistStatusData {
  const baseData = {
    position: 42,
    estimatedWaitDays: 1,
    submissionDate: '27 Jan 2026',
    currentOnboarded: 18,
    totalMemberSlots: 150,
    estimatedReviewTime: 'Approximately 24 hrs',
    rejectionReasons: [],
    nextApplicationCountdown: 0,
  };

  switch (state) {
    case 'pending':
      return { ...baseData, state: 'pending' };
    case 'pending_long':
      return {
        ...baseData,
        state: 'pending_long',
        estimatedWaitDays: 7,
        estimatedReviewTime: 'Approximately 24-48 hrs',
      };
    case 'approved':
      return { ...baseData, state: 'approved', position: null };
    case 'rejected':
      return {
        ...baseData,
        state: 'rejected',
        position: null,
        rejectionReasons: [
          "You're renting outside Bangalore",
          'You did not use an invite code.',
          "Your rent agreement didn't qualify.",
        ],
        nextApplicationCountdown: 102264, // ~28 hours in seconds
      };
    default:
      return { ...baseData, state: 'pending' };
  }
}
