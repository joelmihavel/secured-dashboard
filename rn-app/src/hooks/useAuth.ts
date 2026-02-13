/**
 * Auth Hooks
 *
 * React Query hooks for authentication operations.
 * Wraps auth API calls with caching and mutation handling.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { sendOtp, verifyOtp, resendOtp, signOut as apiSignOut, SendOtpRequest, VerifyOtpRequest } from '../services/api/auth';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../stores/auth';

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
    onSuccess: (data) => {
      if (data.success) {
        setOtpSent(data.data.verification_sid);
      } else {
        setError('SEND_FAILED', data.data.message);
      }
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
    onSuccess: async (data) => {
      if (data.success) {
        // Exchange token_hash for a proper Supabase session
        try {
          const { error: sessionError } = await supabase.auth.verifyOtp({
            token_hash: data.data.token_hash,
            type: 'magiclink',
          });

          if (sessionError) {
            setError('SESSION_ERROR', 'Verified but failed to establish session. Please try again.');
            return;
          }
        } catch {
          setError('SESSION_ERROR', 'Failed to establish session. Please try again.');
          return;
        }

        setAuthenticated(data.data.user_id, data.data.is_new_user);
        queryClient.invalidateQueries({ queryKey: authKeys.session() });
      } else {
        setError('VERIFY_FAILED', data.data.message);
      }
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
    onSuccess: (data) => {
      if (data.success) {
        setOtpSent(data.data.verification_sid);
      } else {
        setError('RESEND_FAILED', data.data.message);
      }
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
