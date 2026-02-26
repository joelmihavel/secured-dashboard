/**
 * Auth API Service
 *
 * Handles phone-based OTP authentication.
 *
 * Two paths (feature-flagged via EXPO_PUBLIC_USE_OTP_ROUTING):
 *   1. OTP Routing (new): Calls auth-otp edge function which routes to
 *      Twilio or Cashfree M360 server-side. Client is provider-agnostic.
 *   2. GoTrue SDK (legacy): Uses supabase.auth.signInWithOtp / verifyOtp
 *      directly. Kept as fallback.
 *
 * The OTP routing path returns an opaque otp_request_id. On verify,
 * the server looks up the provider and handles accordingly.
 */

import { supabase } from '../supabase';
import { tryCatch, logError, getErrorMessage } from '@/src/utils';

// ==============================================
// FEATURE FLAG
// ==============================================

const USE_OTP_ROUTING = process.env.EXPO_PUBLIC_USE_OTP_ROUTING === 'true';

// ==============================================
// TYPES
// ==============================================

export interface SendOtpRequest {
  phone_number: string;
  name?: string;
  channel?: 'sms' | 'whatsapp';
}

export interface SendOtpResult {
  success: boolean;
  otp_request_id?: string;
  verification_sid?: string;
}

export interface VerifyOtpRequest {
  phone_number: string;
  otp: string;
  name?: string;
  otp_request_id?: string;
}

export interface VerifyOtpResult {
  user_id: string;
  is_new_user: boolean;
  identity_status?: 'completed' | 'pending' | 'not_available';
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
 * Send OTP to phone number.
 * Uses auth-otp edge function (routed) or GoTrue SDK (legacy).
 */
export async function sendOtp(
  request: SendOtpRequest
): Promise<{ data: SendOtpResult | null; error: AuthError | null }> {
  if (USE_OTP_ROUTING) {
    return sendOtpViaEdgeFunction(request);
  }
  return sendOtpViaGoTrue(request);
}

/**
 * Verify OTP code.
 * Uses auth-otp edge function (routed) or GoTrue SDK (legacy).
 */
export async function verifyOtp(
  request: VerifyOtpRequest
): Promise<{ data: VerifyOtpResult | null; error: AuthError | null }> {
  if (USE_OTP_ROUTING && request.otp_request_id) {
    return verifyOtpViaEdgeFunction(request);
  }
  return verifyOtpViaGoTrue(request);
}

/**
 * Resend OTP using server-side otp_request_id (same provider).
 * Falls back to sendOtp if no otp_request_id.
 */
export async function resendOtp(
  phoneNumber: string,
  channel: 'sms' | 'whatsapp' = 'whatsapp',
  otpRequestId?: string
): Promise<{ data: SendOtpResult | null; error: AuthError | null }> {
  if (USE_OTP_ROUTING && otpRequestId) {
    return resendOtpViaEdgeFunction(otpRequestId);
  }
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
// OTP ROUTING PATH (new)
// ==============================================

async function sendOtpViaEdgeFunction(
  request: SendOtpRequest
): Promise<{ data: SendOtpResult | null; error: AuthError | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('auth-otp', {
      body: {
        action: 'send_otp',
        phone_number: request.phone_number,
        name: request.name,
        channel: request.channel ?? 'whatsapp',
      },
    });

    if (error) {
      return { data: null, error: mapEdgeFunctionError(error) };
    }

    if (!data?.success) {
      return { data: null, error: mapEdgeFunctionError(data) };
    }

    return {
      data: {
        success: true,
        otp_request_id: data.data.otp_request_id,
        verification_sid: data.data.verification_sid,
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

async function verifyOtpViaEdgeFunction(
  request: VerifyOtpRequest
): Promise<{ data: VerifyOtpResult | null; error: AuthError | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('auth-otp', {
      body: {
        action: 'verify_otp',
        otp_request_id: request.otp_request_id,
        otp: request.otp,
        phone_number: request.phone_number,
        name: request.name,
      },
    });

    if (error) {
      return { data: null, error: mapEdgeFunctionError(error) };
    }

    if (!data?.success) {
      return { data: null, error: mapEdgeFunctionError(data) };
    }

    // Exchange token_hash for a real Supabase session
    if (data.data.token_hash) {
      const { error: sessionError } = await supabase.auth.verifyOtp({
        token_hash: data.data.token_hash,
        type: 'magiclink',
      });

      if (sessionError) {
        return { data: null, error: mapAuthError(sessionError.message) };
      }
    }

    return {
      data: {
        user_id: data.data.user_id,
        is_new_user: data.data.is_new_user,
        identity_status: data.data.identity_status,
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

async function resendOtpViaEdgeFunction(
  otpRequestId: string
): Promise<{ data: SendOtpResult | null; error: AuthError | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('auth-otp', {
      body: {
        action: 'resend_otp',
        otp_request_id: otpRequestId,
      },
    });

    if (error) {
      return { data: null, error: mapEdgeFunctionError(error) };
    }

    if (!data?.success) {
      return { data: null, error: mapEdgeFunctionError(data) };
    }

    return {
      data: {
        success: true,
        otp_request_id: data.data.otp_request_id,
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

// ==============================================
// GOTRUE SDK PATH (legacy)
// ==============================================

async function sendOtpViaGoTrue(
  request: SendOtpRequest
): Promise<{ data: SendOtpResult | null; error: AuthError | null }> {
  try {
    const { error } = await supabase.auth.signInWithOtp({
      phone: request.phone_number,
      options: {
        channel: request.channel ?? 'whatsapp',
      },
    });

    if (error) {
      return { data: null, error: mapAuthError(error.message) };
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

async function verifyOtpViaGoTrue(
  request: VerifyOtpRequest
): Promise<{ data: VerifyOtpResult | null; error: AuthError | null }> {
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      phone: request.phone_number,
      token: request.otp,
      type: 'sms',
    });

    if (error) {
      return { data: null, error: mapAuthError(error.message) };
    }

    const user = data.user;
    if (!user) {
      return {
        data: null,
        error: { code: 'UNKNOWN_ERROR', message: 'Verification succeeded but no user returned' },
      };
    }

    // Update user name if provided
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

/**
 * Maps edge function error responses to AuthError.
 */
function mapEdgeFunctionError(error: unknown): AuthError {
  if (!error) {
    return { code: 'UNKNOWN_ERROR', message: 'An unexpected error occurred' };
  }

  // Edge function returns { error: { message, code } } or FunctionsHttpError
  if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, unknown>;

    // Check for nested error in response data
    if (errObj.error && typeof errObj.error === 'object') {
      const nested = errObj.error as Record<string, unknown>;
      if (typeof nested.message === 'string') {
        return mapAuthError(nested.message);
      }
    }

    // FunctionsHttpError shape
    if (typeof errObj.message === 'string') {
      return mapAuthError(errObj.message);
    }

    // Response body with error details
    if (typeof errObj.context === 'object' && errObj.context !== null) {
      const ctx = errObj.context as Record<string, unknown>;
      if (typeof ctx.message === 'string') {
        return mapAuthError(ctx.message);
      }
    }
  }

  if (typeof error === 'string') {
    return mapAuthError(error);
  }

  return { code: 'UNKNOWN_ERROR', message: 'An unexpected error occurred' };
}
