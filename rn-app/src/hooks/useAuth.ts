/**
 * Auth Hooks
 *
 * React Query hooks for authentication operations.
 * Uses Supabase Auth's built-in phone OTP (signInWithOtp / verifyOtp).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { sendOtp, verifyOtp, resendOtp, signOut as apiSignOut, SendOtpRequest, VerifyOtpRequest } from '../services/api/auth';
import { useAuthStore } from '../stores/auth';
import { useIdentityFetch } from './useIdentityVerification';
import { supabase } from '../services/supabase/client';

// ==============================================
// ERROR NORMALIZATION
// ==============================================

/**
 * Normalize any thrown error into a { code, message } shape.
 * Handles plain Error objects, string throws, and structured auth errors.
 */
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
    onMutate: (variables) => {
      setPhoneNumber(variables.phone_number);
    },
    onSuccess: () => {
      setOtpSent();
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
  const { setVerifying, setAuthenticated, setError } = useAuthStore();

  return useMutation({
    mutationFn: async (request: VerifyOtpRequest) => {
      const result = await verifyOtp(request);
      if (result.error) {
        throw result.error;
      }
      return result.data!;
    },
    onMutate: () => {
      setVerifying();
    },
    onSuccess: (data) => {
      // Session is already established by supabase.auth.verifyOtp()
      setAuthenticated(data.user_id, data.is_new_user);
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
  const { phoneNumber, setOtpSent, setError, clearError } = useAuthStore();

  return useMutation({
    mutationFn: async (channel: 'sms' | 'whatsapp' = 'whatsapp') => {
      if (!phoneNumber) {
        throw { code: 'NO_PHONE', message: 'No phone number to resend to' };
      }
      const result = await resendOtp(phoneNumber, channel);
      if (result.error) {
        throw result.error;
      }
      return result.data!;
    },
    onMutate: () => {
      clearError();
    },
    onSuccess: () => {
      setOtpSent();
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

/**
 * Combined hook for auth operations
 * Provides all auth mutations and state in one hook
 */
export function useAuth() {
  const authStore = useAuthStore();
  const sendOtpMutation = useSendOtp();
  const verifyOtpMutation = useVerifyOtp();
  const resendOtpMutation = useResendOtp();
  const identityFetchMutation = useIdentityFetch();
  const identityFiredRef = useRef(false);

  // Hydrate userName from Supabase session for returning users
  useEffect(() => {
    if (authStore.status === 'authenticated' && !authStore.userName) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        const name = session?.user?.user_metadata?.name;
        if (name) authStore.setUserName(name);
      });
    }
  }, [authStore.status]);

  // Fire non-blocking Mobile 360 identity fetch after successful authentication
  useEffect(() => {
    if (
      authStore.status === 'authenticated' &&
      authStore.isNewUser &&
      authStore.consentForMobile360 &&
      !identityFiredRef.current
    ) {
      identityFiredRef.current = true;
      identityFetchMutation.mutate({
        consent_timestamp: new Date().toISOString(),
        name: authStore.userName || undefined,
      });
    }
  }, [authStore.status, authStore.isNewUser, authStore.consentForMobile360]);

  const sendCode = useCallback(
    (phoneNumber: string, channel?: 'sms' | 'whatsapp') => {
      sendOtpMutation.mutate({
        phone_number: phoneNumber,
        channel: channel ?? 'whatsapp',
      });
    },
    [sendOtpMutation]
  );

  const verifyCode = useCallback(
    (otp: string, name?: string) => {
      verifyOtpMutation.mutate({
        phone_number: authStore.phoneNumber,
        otp,
        name,
      });
    },
    [verifyOtpMutation, authStore.phoneNumber]
  );

  const resendCode = useCallback(
    (channel?: 'sms' | 'whatsapp') => {
      resendOtpMutation.mutate(channel ?? 'whatsapp');
    },
    [resendOtpMutation]
  );

  const signOut = useCallback(async () => {
    await apiSignOut();
    authStore.reset();
  }, [authStore]);

  return {
    // State
    status: authStore.status,
    phoneNumber: authStore.phoneNumber,
    userName: authStore.userName,
    userId: authStore.userId,
    isNewUser: authStore.isNewUser,
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
