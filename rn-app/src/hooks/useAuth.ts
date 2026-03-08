/**
 * Auth Hooks
 *
 * React Query hooks for authentication operations.
 * Dual-path: Supabase Auth (existing users + resend) and Cashfree M360 (new users).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { sendOtp, verifyOtp, resendOtp, signOut as apiSignOut, SendOtpRequest, VerifyOtpRequest } from '../services/api/auth';
import { isReviewMode, deactivateReviewMode } from '../review/reviewMode';
import { useAuthStore } from '../stores/auth';
import { useRecordConsent, useIdentityFetch } from './useIdentityVerification';
import { supabase } from '../services/supabase/client';
import { queryClient as globalQueryClient } from '../providers/QueryProvider';
import { setUserContext, clearUserContext } from '../config/sentry';
import { clearAllStores } from '../stores/resetAll';
import { markUserInitiatedSignOut } from '../providers/AuthProvider';

// ==============================================
// ERROR NORMALIZATION
// ==============================================

function normalizeError(error: unknown): { code: string; message: string } {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    'message' in error &&
    typeof (error as { code: unknown }).code === 'string' &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return error as { code: string; message: string };
  }
  if (error instanceof Error) {
    return { code: 'UNKNOWN_ERROR', message: error.message };
  }
  if (typeof error === 'string') {
    return { code: 'UNKNOWN_ERROR', message: error };
  }
  return { code: 'UNKNOWN_ERROR', message: 'An unexpected error occurred' };
}

// ==============================================
// QUERY KEYS
// ==============================================

export const authKeys = {
  all: ['auth'] as const,
  session: () => [...authKeys.all, 'session'] as const,
  user: (userId: string) => [...authKeys.all, 'user', userId] as const,
};

// ==============================================
// SEND OTP MUTATION
// ==============================================

export function useSendOtp() {
  const { setPhoneNumber, setOtpSent, setError } = useAuthStore();

  return useMutation({
    mutationFn: async (request: SendOtpRequest) => {
      const result = await sendOtp(request);
      if (result.error) {
        throw result.error;
      }
      return result.data!;
    },
    meta: { suppressGlobalError: true },
    onMutate: (variables) => {
      setPhoneNumber(variables.phone_number);
    },
    onSuccess: (data) => {
      // Store method and otp_request_id
      setOtpSent(data.otp_request_id, data.method);
    },
    onError: (error: unknown) => {
      const normalized = normalizeError(error);
      setError(normalized.code, normalized.message);
    },
  });
}

// ==============================================
// VERIFY OTP MUTATION
// ==============================================

export function useVerifyOtp() {
  const queryClient = useQueryClient();
  const { setVerifying, setError } = useAuthStore();

  return useMutation({
    mutationFn: async (request: VerifyOtpRequest) => {
      const result = await verifyOtp(request);
      if (result.error) {
        throw result.error;
      }
      return result.data!;
    },
    meta: { suppressGlobalError: true },
    onMutate: () => {
      setVerifying();
    },
    onSuccess: (data) => {
      useAuthStore.getState().setAuthenticated(
        data.user_id,
        data.is_new_user ?? false,
        data.identity_status ?? null,
      );
      setUserContext(data.user_id);
      queryClient.invalidateQueries({ queryKey: authKeys.session() });
    },
    onError: (error: unknown) => {
      const normalized = normalizeError(error);
      setError(normalized.code, normalized.message);
    },
  });
}

// ==============================================
// RESEND OTP MUTATION
// ==============================================

export function useResendOtp() {
  const { setOtpSent, setError, clearError } = useAuthStore();

  return useMutation({
    mutationFn: async () => {
      // Read from store imperatively to avoid stale closure
      const { phoneNumber, otpRequestId } = useAuthStore.getState();
      if (!phoneNumber) {
        throw { code: 'NO_PHONE', message: 'No phone number to resend to' };
      }
      // Resend via M360 if we have an otp_request_id (preserves identity capture),
      // otherwise fall back to Supabase Auth.
      const result = await resendOtp(phoneNumber, otpRequestId);
      if (result.error) {
        throw result.error;
      }
      return result.data!;
    },
    meta: { suppressGlobalError: true },
    onMutate: () => {
      clearError();
    },
    onSuccess: (data) => {
      // Update with new otp_request_id if M360 resend succeeded
      setOtpSent(data.otp_request_id, data.method);
    },
    onError: (error: unknown) => {
      const normalized = normalizeError(error);
      setError(normalized.code, normalized.message);
    },
  });
}

// ==============================================
// COMBINED AUTH HOOK
// ==============================================

export function useAuth() {
  const authStore = useAuthStore();
  const sendOtpMutation = useSendOtp();
  const verifyOtpMutation = useVerifyOtp();
  const resendOtpMutation = useResendOtp();
  const recordConsentMutation = useRecordConsent();
  const identityFetchMutation = useIdentityFetch();
  const identityFiredRef = useRef(false);

  // Hydrate userName from Supabase session for returning users
  useEffect(() => {
    if (authStore.status === 'authenticated' && !authStore.userName) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        const name = session?.user?.user_metadata?.name;
        if (name) authStore.setUserName(name);
      }).catch(() => {
        // Non-critical
      });
    }
  }, [authStore.status]);

  // Non-blocking Mobile 360 flow after OTP verification.
  // SKIP when auth was via Cashfree M360 — auth-otp already handles identity
  // verification in its fire-and-forget background work. Running verify-identity
  // on top would create duplicate CONSENT_GIVEN records that never progress.
  useEffect(() => {
    if (
      authStore.status === 'authenticated' &&
      authStore.isNewUser &&
      authStore.consentForMobile360 &&
      authStore.otpMethod !== 'cashfree' && // auth-otp already handles M360 identity
      authStore.identityStatus !== 'completed' &&
      authStore.identityStatus !== 'not_available' &&
      !identityFiredRef.current
    ) {
      identityFiredRef.current = true;
      const consentTimestamp = authStore.consentTimestamp || new Date().toISOString();
      const userName = authStore.userName || undefined;

      recordConsentMutation.mutate(
        { consent_timestamp: consentTimestamp, name: userName },
        {
          onSuccess: () => {
            identityFetchMutation.mutate({
              consent_timestamp: consentTimestamp,
              name: userName,
            });
          },
          onError: () => {
            identityFetchMutation.mutate({
              consent_timestamp: consentTimestamp,
              name: userName,
            });
          },
        }
      );
    }
  }, [authStore.status, authStore.isNewUser, authStore.consentForMobile360, authStore.identityStatus]);

  const sendCode = useCallback(
    (phoneNumber: string, name?: string, onSuccess?: () => void) => {
      sendOtpMutation.mutate(
        {
          phone_number: phoneNumber,
          name,
        },
        onSuccess ? { onSuccess } : undefined,
      );
    },
    [sendOtpMutation]
  );

  const verifyCode = useCallback(
    (otp: string, name?: string) => {
      verifyOtpMutation.mutate({
        phone_number: authStore.phoneNumber,
        otp,
        method: authStore.otpMethod ?? 'supabase',
        name,
        otp_request_id: authStore.otpRequestId ?? undefined,
      });
    },
    [verifyOtpMutation, authStore.phoneNumber, authStore.otpRequestId, authStore.otpMethod]
  );

  const resendCode = useCallback(
    () => {
      resendOtpMutation.mutate();
    },
    [resendOtpMutation]
  );

  const signOut = useCallback(async () => {
    // Signal to AuthProvider that this is a user-initiated sign-out.
    // Prevents the delayed SIGNED_OUT handler from redundantly clearing
    // stores and navigating a second time 2 seconds later.
    markUserInitiatedSignOut();

    if (isReviewMode()) deactivateReviewMode();

    // Try SDK signOut (revokes refresh token server-side + clears local session).
    // If this fails (server 500, network error), the SDK does NOT clear the
    // session from SecureStore. clearAllStores() handles this — it explicitly
    // deletes the Supabase session key from SecureStore as a fallback.
    await apiSignOut().catch(() => {});

    clearUserContext();
    // Nuclear cleanup: resets all Zustand stores, explicitly deletes all
    // persisted SecureStore keys (including Supabase session + chunks),
    // tears down WebSocket channels, and clears React Query cache.
    clearAllStores();
    globalQueryClient.clear();
  }, []);

  return {
    // State
    status: authStore.status,
    phoneNumber: authStore.phoneNumber,
    userName: authStore.userName,
    userId: authStore.userId,
    isNewUser: authStore.isNewUser,
    identityStatus: authStore.identityStatus,
    error: authStore.error,

    // Mutations
    sendCode,
    verifyCode,
    resendCode,

    // Loading states
    isSendingOtp: sendOtpMutation.isPending,
    isVerifyingOtp: verifyOtpMutation.isPending,
    isResendingOtp: resendOtpMutation.isPending,

    // Actions
    clearError: authStore.clearError,
    reset: authStore.reset,
    signOut,
  };
}
