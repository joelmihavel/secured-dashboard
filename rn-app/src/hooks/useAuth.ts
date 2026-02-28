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
import { useUploadStore } from '../stores/upload';
import { useWaitlistStore } from '../stores/waitlist';
import { usePaymentStore } from '../stores/payment';
import { useSetupStore } from '../stores/setup';
import { useProfileStore } from '../stores/profile';
import { useRecordConsent, useIdentityFetch } from './useIdentityVerification';
import { supabase } from '../services/supabase/client';
import { queryClient as globalQueryClient } from '../providers/QueryProvider';
import { setUserContext, clearUserContext } from '../config/sentry';

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
  const { phoneNumber, setOtpSent, setOtpMethod, setError, clearError } = useAuthStore();

  return useMutation({
    mutationFn: async () => {
      if (!phoneNumber) {
        throw { code: 'NO_PHONE', message: 'No phone number to resend to' };
      }
      // Resend ALWAYS uses Supabase Auth
      const result = await resendOtp(phoneNumber);
      if (result.error) {
        throw result.error;
      }
      return result.data!;
    },
    meta: { suppressGlobalError: true },
    onMutate: () => {
      clearError();
    },
    onSuccess: () => {
      // Switch to Supabase method permanently (M360 gets one shot)
      setOtpMethod('supabase');
      // Clear otp_request_id since we're now on Supabase path
      setOtpSent(undefined, 'supabase');
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

  // Non-blocking Mobile 360 flow after OTP verification
  useEffect(() => {
    if (
      authStore.status === 'authenticated' &&
      authStore.isNewUser &&
      authStore.consentForMobile360 &&
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
    if (isReviewMode()) deactivateReviewMode();
    await apiSignOut();
    clearUserContext();
    authStore.reset();
    useUploadStore.getState().reset();
    useWaitlistStore.getState().reset();
    usePaymentStore.getState().reset();
    useSetupStore.getState().reset();
    useProfileStore.getState().reset();
    globalQueryClient.clear();
  }, [authStore]);

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
