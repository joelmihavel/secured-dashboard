/**
 * Auth API Service
 *
 * Handles phone-based OTP authentication via Supabase edge functions.
 * Integrates with Twilio Verify API on the backend.
 */

import { callEdgeFunction, supabase } from '../supabase';
import { tryCatch, logError, getErrorMessage } from '@/src/utils';

// ==============================================
// TYPES
// ==============================================

export interface SendOtpRequest {
  phone_number: string;
  channel?: 'sms' | 'whatsapp' | 'call';
  consent_for_mobile360?: boolean;
}

export interface SendOtpResponse {
  success: boolean;
  data: {
    verification_sid: string;
    status: 'pending' | 'approved' | 'canceled' | 'max_attempts_reached' | 'expired' | 'failed';
    channel: string;
    phone_masked: string;
    message: string;
  };
}

export interface VerifyOtpRequest {
  phone_number: string;
  otp: string;
  name?: string;
  consent_for_mobile360?: boolean;
}

export interface VerifyOtpResponse {
  success: boolean;
  data: {
    user_id: string;
    is_new_user: boolean;
    consent_verification_id: string | null;
    consent_status: string | null;
    message: string;
    next_steps: string[];
  };
}

export type AuthErrorCode =
  | 'INVALID_PHONE'
  | 'RATE_LIMITED'
  | 'INVALID_OTP'
  | 'OTP_EXPIRED'
  | 'MAX_ATTEMPTS'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export interface AuthError {
  code: AuthErrorCode;
  message: string;
}

// ==============================================
// API FUNCTIONS
// ==============================================

/**
 * Send OTP to phone number
 *
 * @param request - Phone number and optional channel preference
 * @returns Promise with verification SID or error
 */
export async function sendOtp(
  request: SendOtpRequest
): Promise<{ data: SendOtpResponse | null; error: AuthError | null }> {
  const { data, error } = await callEdgeFunction<SendOtpResponse>('auth-otp', {
    action: 'send_otp',
    phone_number: request.phone_number,
    channel: request.channel ?? 'sms',
    consent_for_mobile360: request.consent_for_mobile360 ?? true,
  });

  if (error) {
    return {
      data: null,
      error: mapAuthError(error),
    };
  }

  return { data, error: null };
}

/**
 * Verify OTP code
 *
 * @param request - Phone number, OTP code, and optional user name
 * @returns Promise with user data or error
 */
export async function verifyOtp(
  request: VerifyOtpRequest
): Promise<{ data: VerifyOtpResponse | null; error: AuthError | null }> {
  const { data, error } = await callEdgeFunction<VerifyOtpResponse>('auth-otp', {
    action: 'verify_otp',
    phone_number: request.phone_number,
    otp: request.otp,
    name: request.name,
    consent_for_mobile360: request.consent_for_mobile360 ?? true,
  });

  if (error) {
    return {
      data: null,
      error: mapAuthError(error),
    };
  }

  return { data, error: null };
}

/**
 * Resend OTP to the same phone number
 */
export async function resendOtp(
  phoneNumber: string,
  channel: 'sms' | 'whatsapp' = 'sms'
): Promise<{ data: SendOtpResponse | null; error: AuthError | null }> {
  return sendOtp({ phone_number: phoneNumber, channel });
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<{ success: boolean; error: string | null }> {
  const result = await tryCatch(
    async () => {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      return true;
    },
    'Failed to sign out'
  );

  if (!result.success) {
    logError('signOut', result.error.originalError);
    return { success: false, error: getErrorMessage(result.error.originalError) || result.error.message };
  }

  return { success: true, error: null };
}

// ==============================================
// ERROR MAPPING
// ==============================================

function mapAuthError(errorMessage: string): AuthError {
  const lowerMessage = errorMessage.toLowerCase();

  if (lowerMessage.includes('invalid phone') || lowerMessage.includes('phone number')) {
    return { code: 'INVALID_PHONE', message: 'Please enter a valid phone number' };
  }

  if (lowerMessage.includes('rate') || lowerMessage.includes('too many')) {
    return { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait before trying again.' };
  }

  if (lowerMessage.includes('invalid otp') || lowerMessage.includes('wrong code')) {
    return { code: 'INVALID_OTP', message: 'The code you entered is incorrect' };
  }

  if (lowerMessage.includes('expired')) {
    return { code: 'OTP_EXPIRED', message: 'This code has expired. Please request a new one.' };
  }

  if (lowerMessage.includes('max attempt') || lowerMessage.includes('too many attempts')) {
    return { code: 'MAX_ATTEMPTS', message: 'Too many incorrect attempts. Please request a new code.' };
  }

  if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
    return { code: 'NETWORK_ERROR', message: 'Please check your internet connection' };
  }

  return { code: 'UNKNOWN_ERROR', message: errorMessage };
}
