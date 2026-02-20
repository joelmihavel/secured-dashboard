/**
 * Auth API Service
 *
 * Handles phone-based OTP authentication via Supabase Auth's built-in
 * Twilio integration. Uses signInWithOtp / verifyOtp for the phone flow.
 *
 * Previously this used a custom edge function (`auth-otp`) that called
 * Twilio Verify API directly — which caused "Code Expired" errors because
 * the edge function's createUser call would fail for existing users,
 * consuming the Twilio verification in the process.
 */

import { supabase } from '../supabase';
import { tryCatch, logError, getErrorMessage } from '@/src/utils';

// ==============================================
// TYPES
// ==============================================

export interface SendOtpRequest {
  phone_number: string;
  channel?: 'sms' | 'whatsapp';
}

export interface VerifyOtpRequest {
  phone_number: string;
  otp: string;
  name?: string;
}

export type AuthErrorCode =
  | 'INVALID_PHONE'
  | 'PHONE_EXISTS'
  | 'RATE_LIMITED'
  | 'INVALID_OTP'
  | 'OTP_EXPIRED'
  | 'MAX_ATTEMPTS'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'UNKNOWN_ERROR';

export interface AuthError {
  code: AuthErrorCode;
  message: string;
}

// ==============================================
// API FUNCTIONS
// ==============================================

/**
 * Send OTP to phone number via Supabase Auth (built-in Twilio integration)
 */
export async function sendOtp(
  request: SendOtpRequest
): Promise<{ data: { success: boolean } | null; error: AuthError | null }> {
  try {
    const { error } = await supabase.auth.signInWithOtp({
      phone: request.phone_number,
      options: {
        channel: request.channel ?? 'whatsapp',
      },
    });

    if (error) {
      return {
        data: null,
        error: mapAuthError(error.message),
      };
    }

    return { data: { success: true }, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Network error',
      },
    };
  }
}

/**
 * Verify OTP code via Supabase Auth.
 * Returns a session directly on success (no token_hash exchange needed).
 */
export async function verifyOtp(
  request: VerifyOtpRequest
): Promise<{
  data: { user_id: string; is_new_user: boolean } | null;
  error: AuthError | null;
}> {
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      phone: request.phone_number,
      token: request.otp,
      type: 'sms',
    });

    if (error) {
      return {
        data: null,
        error: mapAuthError(error.message),
      };
    }

    const user = data.user;
    if (!user) {
      return {
        data: null,
        error: { code: 'UNKNOWN_ERROR', message: 'Verification succeeded but no user returned' },
      };
    }

    // Update user name if provided (post-auth profile update)
    if (request.name) {
      await supabase.auth.updateUser({
        data: { name: request.name },
      });
    }

    // Heuristic: user created within the last 10 minutes is likely new
    const createdAt = new Date(user.created_at).getTime();
    const isNewUser = (Date.now() - createdAt) < 600_000;

    return {
      data: {
        user_id: user.id,
        is_new_user: isNewUser,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Network error',
      },
    };
  }
}

/**
 * Resend OTP to the same phone number
 */
export async function resendOtp(
  phoneNumber: string,
  channel: 'sms' | 'whatsapp' = 'whatsapp'
): Promise<{ data: { success: boolean } | null; error: AuthError | null }> {
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

  if (lowerMessage.includes('timed out') || lowerMessage.includes('aborted')) {
    return { code: 'TIMEOUT', message: 'Request timed out. Please try again.' };
  }

  if (lowerMessage.includes('already exists') || lowerMessage.includes('already registered')) {
    return { code: 'PHONE_EXISTS', message: 'This number already exists' };
  }

  if (lowerMessage.includes('invalid phone') || lowerMessage.includes('phone number')) {
    return { code: 'INVALID_PHONE', message: 'Please enter a valid phone number' };
  }

  if (lowerMessage.includes('rate') || lowerMessage.includes('too many') || lowerMessage.includes('exceeded')) {
    return { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait before trying again.' };
  }

  if ((lowerMessage.includes('invalid') && lowerMessage.includes('otp')) || lowerMessage.includes('wrong code') || lowerMessage.includes('token')) {
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
