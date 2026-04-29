/**
 * Auth API Service
 *
 * Dual-path OTP authentication:
 *   1. Supabase Auth (existing users): Edge function triggers OTP server-side via GoTrue,
 *      client only calls verifyOtp. If server-side trigger fails, falls back to signInWithOtp.
 *   2. Cashfree M360 (new users): Edge function sends OTP + exchanges session server-side.
 *      Returns {session} for setSession, or {token_hash} fallback for client-side exchange.
 *
 * The route_otp action determines which path to use based on user existence.
 * Resend stays on M360 if an otp_request_id exists (fresh verification_id each time)
 * to preserve identity data capture. Falls back to Supabase only if no M360 context.
 */

import * as SecureStore from 'expo-secure-store';
import { supabase } from '../supabase';
import { ExpoSecureStoreAdapter, SUPABASE_SESSION_STORAGE_KEY } from '../supabase/client';
import { env } from '@/src/config/env';
import { tryCatch, logError, getErrorMessage } from '@/src/utils';
import { isReviewPhone, activateReviewMode, isReviewMode, deactivateReviewMode, REVIEW_OTP } from '@/src/review/reviewMode';
import { isJourneyPhone, activateJourneyMode, isJourneyMode, deactivateJourneyMode, REVIEW_OTP as JOURNEY_OTP } from '@/src/review/journeyMode';
import { useAuthStore } from '@/src/stores/auth';

/**
 * SecureStore key holding a refresh token whose server-side revocation was
 * queued because the original signOut() failed (typically: offline). Drained
 * by AuthProvider on next cold start. Survives across signOut + clearAllStores
 * so the entry isn't lost in the same flow that created it. Wiped on
 * fresh-install detection (see installDetection.ts ALL_KEYCHAIN_KEYS).
 *
 * Format: JSON `{ refreshToken: string, queuedAt: number /* epoch ms *\/ }`
 */
export const PENDING_REVOCATION_KEY = 'flent_pending_revocation';

/** Refresh tokens default to 30-day lifetime; drop queue entries older than 35d. */
const PENDING_REVOCATION_MAX_AGE_MS = 35 * 24 * 60 * 60 * 1000;

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
  // Review mode: intercept before any network call
  if (isReviewPhone(request.phone_number)) {
    activateReviewMode();
    return { data: { method: 'supabase' as OtpMethod }, error: null };
  }

  // Journey demo mode: intercept before any network call
  if (isJourneyPhone(request.phone_number)) {
    activateJourneyMode();
    return { data: { method: 'supabase' as OtpMethod }, error: null };
  }

  try {
    // 1. Call edge function for routing
    const { data: routeData, error: routeError } = await supabase.functions.invoke('auth-otp', {
      body: {
        action: 'route_otp',
        phone_number: request.phone_number,
        name: request.name,
      },
      region: 'ap-south-1',
    });

    if (routeError) {
      return { data: null, error: await mapEdgeFunctionError(routeError) };
    }

    if (!routeData?.success) {
      return { data: null, error: await mapEdgeFunctionError(routeData) };
    }

    const method = routeData.data.method as OtpMethod;

    if (method === 'supabase') {
      // OPT-1: If server already triggered OTP, skip client-side signInWithOtp
      if (!routeData.data.otp_triggered) {
        const { error: signInError } = await supabase.auth.signInWithOtp({
          phone: request.phone_number,
        });

        if (signInError) {
          return { data: null, error: mapAuthError(signInError.message) };
        }
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
  // Review mode: validate OTP locally, return mock success.
  // Navigation is handled by otp.tsx watching auth store status (not Supabase events).
  // AuthProvider treats isReviewMode() as authenticated (no real session needed).
  if (isReviewMode()) {
    if (request.otp !== REVIEW_OTP) {
      return { data: null, error: { code: 'INVALID_OTP', message: 'The code you entered is incorrect' } };
    }

    return {
      data: { user_id: 'review-user-id', is_new_user: false, identity_status: null },
      error: null,
    };
  }

  // Journey demo mode: validate OTP locally, return mock new user.
  if (isJourneyMode()) {
    if (request.otp !== JOURNEY_OTP) {
      return { data: null, error: { code: 'INVALID_OTP', message: 'The code you entered is incorrect' } };
    }

    return {
      data: { user_id: 'journey-user-id', is_new_user: true, identity_status: null },
      error: null,
    };
  }

  if (request.method === 'supabase') {
    return verifyOtpViaSupabaseAuth(request);
  }
  return verifyOtpViaCashfree(request);
}

/**
 * Resend OTP — tries M360 first (if otp_request_id exists), falls back to Supabase Auth.
 * M360 resend uses a fresh verification_id to preserve identity data capture.
 */
export async function resendOtp(
  phoneNumber: string,
  otpRequestId?: string | null
): Promise<{ data: SendOtpResult | null; error: AuthError | null }> {
  try {
    // If we have an M360 otp_request_id, try resend via M360 (fresh verification_id)
    // to preserve identity data capture on the same OTP flow.
    if (otpRequestId) {
      try {
        const { data: resendData, error: resendError } = await supabase.functions.invoke('auth-otp', {
          body: {
            action: 'resend_otp',
            otp_request_id: otpRequestId,
          },
          region: 'ap-south-1',
        });

        if (!resendError && resendData?.success) {
          return {
            data: {
              method: 'cashfree',
              otp_request_id: resendData.data.otp_request_id,
              expires_in: resendData.data.expires_in,
            },
            error: null,
          };
        }

        // M360 resend failed — fall through to Supabase
        console.warn('[auth] M360 resend failed, falling back to Supabase Auth');
      } catch {
        console.warn('[auth] M360 resend threw, falling back to Supabase Auth');
      }
    }

    // Supabase Auth fallback (also the primary path for existing users)
    const { error } = await supabase.auth.signInWithOtp({
      phone: phoneNumber,
    });

    if (error) {
      return { data: null, error: mapAuthError(error.message) };
    }

    return { data: { method: 'supabase', otp_request_id: undefined }, error: null };
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
 * Sign out the current user.
 *
 * @param explicitUserId - Pre-snapshotted userId from the caller. Required when
 *   signOut is called AFTER clearAllStores (the standard order in useAuth.signOut),
 *   because the auth store has already been reset and `useAuthStore.getState().userId`
 *   will be null at that point. Falls back to the store for backward compatibility.
 */
export async function signOut(explicitUserId?: string): Promise<{ success: boolean; error: string | null }> {
  // Review mode: deactivate, then clear the fake session from SecureStore
  if (isReviewMode()) {
    deactivateReviewMode();
    // Let the real sign-out run to clear SecureStore + fire SIGNED_OUT event
  }

  // Journey demo mode: deactivate and reset stage
  if (isJourneyMode()) {
    deactivateJourneyMode();
  }

  // Deactivate push token before signing out (H6: prevent ghost notifications)
  // NEVER use getSession() here — it triggers _callRefreshToken() which races
  // with autoRefreshToken and can cause double refresh token consumption (lesson #33).
  // Use the explicit snapshot from the caller; fall back to the store only when
  // signOut is invoked outside the standard useAuth flow (e.g. tests, legacy paths).
  try {
    const userId = explicitUserId ?? useAuthStore.getState().userId;
    if (userId) {
      await supabase
        .from('device_tokens')
        .update({ is_active: false })
        .eq('user_id', userId);
    }
  } catch {
    // Best-effort — don't block sign-out
  }

  // Capture refresh_token BEFORE the SDK clears the session, so we can queue
  // server-side revocation if signOut fails (e.g., offline). (Gap #6)
  const refreshTokenSnapshot = await readRefreshTokenForRevocationQueue();

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
    // Server-side revocation didn't happen. The local session is wiped by
    // clearAllStores(), but the refresh token stays valid on the server for
    // up to 30 days. Queue it for revocation on next online launch.
    if (refreshTokenSnapshot) {
      const entry = JSON.stringify({
        refreshToken: refreshTokenSnapshot,
        queuedAt: Date.now(),
      });
      await SecureStore.setItemAsync(PENDING_REVOCATION_KEY, entry).catch(() => {});
    }
    return { success: false, error: getErrorMessage(result.error.originalError) || result.error.message };
  }

  return { success: true, error: null };
}

/**
 * Read the refresh token from SecureStore via the SDK's adapter (handles
 * generation-based chunking). Returns null if no session is persisted or the
 * stored payload is unreadable. Side-effect-free — no SDK auth calls.
 */
async function readRefreshTokenForRevocationQueue(): Promise<string | null> {
  try {
    const raw = await ExpoSecureStoreAdapter.getItem(SUPABASE_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const candidate = parsed?.currentSession ?? parsed;
    return typeof candidate?.refresh_token === 'string' ? candidate.refresh_token : null;
  } catch {
    return null;
  }
}

/**
 * Drain any queued refresh-token revocations from prior offline sign-outs.
 *
 * Called once on AuthProvider cold-start. Best-effort: if revocation fails
 * (network error, GoTrue down) the queue entry stays for the next launch.
 * If the entry is older than the max refresh-token lifetime it's dropped
 * without an attempt (the token is already expired server-side anyway).
 *
 * Two-step revocation:
 *  1. Exchange the queued refresh_token for a fresh access_token via
 *     /auth/v1/token. Token rotation invalidates the queued refresh token —
 *     this alone achieves the security goal.
 *  2. Use the new access_token to call /auth/v1/logout?scope=global to
 *     revoke ALL sessions for the user, killing the orphaned new refresh
 *     token that step 1 minted.
 *
 * Uses raw fetch (not the SDK) so we don't disturb the SDK's session state —
 * AuthProvider's own initSession runs in parallel and we must not flip the
 * authenticated state during that window.
 */
export async function drainPendingRevocations(): Promise<void> {
  let raw: string | null = null;
  try {
    raw = await SecureStore.getItemAsync(PENDING_REVOCATION_KEY);
  } catch {
    return;
  }
  if (!raw) return;

  let entry: { refreshToken?: unknown; queuedAt?: unknown };
  try {
    entry = JSON.parse(raw);
  } catch {
    // Corrupt — drop
    await SecureStore.deleteItemAsync(PENDING_REVOCATION_KEY).catch(() => {});
    return;
  }

  const refreshToken = typeof entry.refreshToken === 'string' ? entry.refreshToken : null;
  const queuedAt = typeof entry.queuedAt === 'number' ? entry.queuedAt : 0;

  if (!refreshToken) {
    await SecureStore.deleteItemAsync(PENDING_REVOCATION_KEY).catch(() => {});
    return;
  }

  // TTL: drop entries older than the max refresh-token lifetime.
  if (queuedAt && Date.now() - queuedAt > PENDING_REVOCATION_MAX_AGE_MS) {
    await SecureStore.deleteItemAsync(PENDING_REVOCATION_KEY).catch(() => {});
    return;
  }

  try {
    // Step 1: rotation invalidates the queued refresh token.
    const refreshResp = await fetch(
      `${env.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
      {
        method: 'POST',
        headers: {
          'apikey': env.supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }
    );

    // 4xx (commonly 400/401) means the token is already invalid — security
    // goal achieved by some other path, drop the queue entry.
    if (refreshResp.status >= 400 && refreshResp.status < 500) {
      await SecureStore.deleteItemAsync(PENDING_REVOCATION_KEY).catch(() => {});
      return;
    }

    if (!refreshResp.ok) {
      // 5xx — keep the entry, retry next launch.
      return;
    }

    const tokens = await refreshResp.json().catch(() => null);
    if (!tokens?.access_token) {
      await SecureStore.deleteItemAsync(PENDING_REVOCATION_KEY).catch(() => {});
      return;
    }

    // Step 2: revoke the orphaned new session.
    await fetch(`${env.supabaseUrl}/auth/v1/logout?scope=global`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'apikey': env.supabaseAnonKey,
      },
    }).catch(() => {});

    await SecureStore.deleteItemAsync(PENDING_REVOCATION_KEY).catch(() => {});
  } catch {
    // Network error — leave queue intact, retry on next launch.
  }
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
      region: 'ap-south-1',
    });

    if (error) {
      return { data: null, error: await mapEdgeFunctionError(error) };
    }

    if (!data?.success) {
      return { data: null, error: await mapEdgeFunctionError(data) };
    }

    // OPT-2: If server exchanged token, use setSession (saves 200-400ms round-trip).
    // If setSession fails (e.g. SecureStore write error), fall back to token_hash
    // exchange so the user doesn't have to re-enter their OTP.
    if (data.data.session?.access_token) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.data.session.access_token,
        refresh_token: data.data.session.refresh_token,
      });

      if (sessionError && data.data.token_hash) {
        // setSession failed — fall back to client-side token exchange
        console.warn('[auth] setSession failed, falling back to verifyOtp:', sessionError.message);
        const { error: fallbackError } = await supabase.auth.verifyOtp({
          token_hash: data.data.token_hash,
          type: 'magiclink',
        });
        if (fallbackError) {
          return { data: null, error: mapAuthError(fallbackError.message) };
        }
      } else if (sessionError) {
        return { data: null, error: mapAuthError(sessionError.message) };
      }
    } else if (data.data.token_hash) {
      // Fallback: client-side token exchange
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
    return { code: 'TIMEOUT', message: 'Request timed out. Please try again' };
  }

  if (lowerMessage.includes('already exists') || lowerMessage.includes('already registered')) {
    return { code: 'PHONE_EXISTS', message: 'This number already exists' };
  }

  if (lowerMessage.includes('invalid phone') || lowerMessage.includes('phone number')) {
    return { code: 'INVALID_PHONE', message: 'Please enter a valid phone number' };
  }

  if (lowerMessage.includes('rate') || lowerMessage.includes('too many') || lowerMessage.includes('exceeded')) {
    return { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait before trying again' };
  }

  if ((lowerMessage.includes('invalid') && lowerMessage.includes('otp')) || lowerMessage.includes('wrong code') || lowerMessage.includes('token')) {
    return { code: 'INVALID_OTP', message: 'The code you entered is incorrect' };
  }

  if (lowerMessage.includes('expired')) {
    return { code: 'OTP_EXPIRED', message: 'This code has expired. Please request a new one' };
  }

  if (lowerMessage.includes('max attempt') || lowerMessage.includes('too many attempts')) {
    return { code: 'MAX_ATTEMPTS', message: 'Too many incorrect attempts. Please request a new code' };
  }

  if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
    return { code: 'NETWORK_ERROR', message: 'Please check your internet connection' };
  }

  if (lowerMessage.includes('already used') || lowerMessage.includes('already_used')) {
    return { code: 'OTP_EXPIRED', message: 'This code has already been used. Request a new one' };
  }

  if (lowerMessage.includes('already processed') || lowerMessage.includes('already_processed')) {
    return { code: 'RATE_LIMITED', message: 'OTP already sent. Please check your SMS' };
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
