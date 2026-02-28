/**
 * Auth API Service
 *
 * Dual-path OTP authentication:
 *   1. Supabase Auth (existing users + resend): Uses supabase.auth.signInWithOtp / verifyOtp
 *      directly. Supabase handles Twilio Programmable Messaging, OTP codes, and sessions.
 *   2. Cashfree M360 (new users): Calls auth-otp edge function for identity-enriched OTP.
 *      Edge function returns token_hash which is exchanged for a session via verifyOtp.
 *
 * The route_otp action determines which path to use based on user existence.
 * Resend ALWAYS uses Supabase Auth (M360 has ~45s cooldown, incompatible with 10s resend).
 */

import { supabase } from '../supabase';
import { tryCatch, logError, getErrorMessage } from '@/src/utils';

// ==============================================
// TYPES
// ==============================================

export type OtpMethod = 'supabase' | 'cashfree';

export interface SendOtpRequest {
  phone_number: string;
  name?: string;
}

export interface SendOtpResult {
  method: OtpMethod;
  otp_request_id?: string;
  expires_in?: number;
}

export interface VerifyOtpRequest {
  phone_number: string;
  otp: string;
  method: OtpMethod;
  name?: string;
  otp_request_id?: string;
}

export interface VerifyOtpResult {
  user_id: string;
  is_new_user: boolean;
  identity_status?: 'completed' | 'pending' | 'not_available' | null;
}

export type AuthErrorCode =
  | 'INVALID_PHONE'
  | 'PHONE_EXISTS'
  | 'RATE_LIMITED'
  | 'INVALID_OTP'
  | 'OTP_EXPIRED'
  | 'OTP_ALREADY_USED'
  | 'ALREADY_PROCESSED'
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
 * 1. Calls edge function route_otp to determine new vs existing user.
 * 2a. Existing user: calls signInWithOtp directly (Supabase Auth sends SMS).
 * 2b. New user: M360 OTP already sent by edge function.
 */
export async function sendOtp(
  request: SendOtpRequest
): Promise<{ data: SendOtpResult | null; error: AuthError | null }> {
  try {
    // 1. Call edge function for routing
    const { data: routeData, error: routeError } = await supabase.functions.invoke('auth-otp', {
      body: {
        action: 'route_otp',
        phone_number: request.phone_number,
        name: request.name,
      },
    });

    if (routeError) {
      return { data: null, error: await mapEdgeFunctionError(routeError) };
    }

    if (!routeData?.success) {
      return { data: null, error: await mapEdgeFunctionError(routeData) };
    }

    const method = routeData.data.method as OtpMethod;

    if (method === 'supabase') {
      // 2a. Existing user — Supabase Auth sends OTP directly
      const { error: signInError } = await supabase.auth.signInWithOtp({
        phone: request.phone_number,
      });

      if (signInError) {
        return { data: null, error: mapAuthError(signInError.message) };
      }

      return {
        data: { method: 'supabase' },
        error: null,
      };
    }

    // 2b. New user — M360 OTP already sent by edge function
    return {
      data: {
        method: 'cashfree',
        otp_request_id: routeData.data.otp_request_id,
        expires_in: routeData.data.expires_in,
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
 * Verify OTP code.
 * Supabase path: direct SDK call, session auto-created.
 * Cashfree path: edge function verify, then exchange token_hash for session.
 */
export async function verifyOtp(
  request: VerifyOtpRequest
): Promise<{ data: VerifyOtpResult | null; error: AuthError | null }> {
  if (request.method === 'supabase') {
    return verifyOtpViaSupabaseAuth(request);
  }
  return verifyOtpViaCashfree(request);
}

/**
 * Resend OTP — ALWAYS uses Supabase Auth.
 * M360 has ~45s cooldown, so resend switches to Supabase Auth permanently.
 */
export async function resendOtp(
  phoneNumber: string
): Promise<{ data: { method: 'supabase' } | null; error: AuthError | null }> {
  try {
    const { error } = await supabase.auth.signInWithOtp({
      phone: phoneNumber,
    });

    if (error) {
      return { data: null, error: mapAuthError(error.message) };
    }

    return { data: { method: 'supabase' }, error: null };
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
// SUPABASE AUTH VERIFY PATH
// ==============================================

async function verifyOtpViaSupabaseAuth(
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
        identity_status: null, // No M360 data for Supabase path
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
// CASHFREE M360 VERIFY PATH
// ==============================================

async function verifyOtpViaCashfree(
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
      return { data: null, error: await mapEdgeFunctionError(error) };
    }

    if (!data?.success) {
      return { data: null, error: await mapEdgeFunctionError(data) };
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

  if (lowerMessage.includes('already used') || lowerMessage.includes('already_used')) {
    return { code: 'OTP_EXPIRED', message: 'This code has already been used. Request a new one.' };
  }

  if (lowerMessage.includes('already processed') || lowerMessage.includes('already_processed')) {
    return { code: 'RATE_LIMITED', message: 'OTP already sent. Please check your SMS.' };
  }

  return { code: 'UNKNOWN_ERROR', message: errorMessage };
}

/**
 * Maps edge function error responses to AuthError.
 * Handles FunctionsHttpError (context is a Response object that must be awaited).
 */
async function mapEdgeFunctionError(error: unknown): Promise<AuthError> {
  if (!error) {
    return { code: 'UNKNOWN_ERROR', message: 'An unexpected error occurred' };
  }

  if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, unknown>;

    // Check for nested error in response data (plain JSON body)
    if (errObj.error && typeof errObj.error === 'object') {
      const nested = errObj.error as Record<string, unknown>;
      if (typeof nested.message === 'string') {
        return mapAuthError(nested.message);
      }
    }

    // FunctionsHttpError: context is a Response object — read the JSON body
    if (errObj.context && typeof (errObj.context as Response).json === 'function') {
      try {
        const body = await (errObj.context as Response).json();
        if (body?.error?.message) {
          return mapAuthError(body.error.message);
        }
        if (body?.message) {
          return mapAuthError(body.message);
        }
      } catch {
        // Response body couldn't be parsed — fall through
      }
    }

    // FunctionsHttpError.message
    if (typeof errObj.message === 'string') {
      return mapAuthError(errObj.message);
    }
  }

  if (typeof error === 'string') {
    return mapAuthError(error);
  }

  return { code: 'UNKNOWN_ERROR', message: 'An unexpected error occurred' };
}
