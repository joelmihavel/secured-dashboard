/**
 * Auth Hooks
 *
 * React Query hooks for authentication operations.
 * Wraps auth API calls with caching and mutation handling.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { sendOtp, verifyOtp, resendOtp, signOut as apiSignOut, SendOtpRequest, VerifyOtpRequest } from '../services/api/auth';
import { useAuthStore } from '../stores/auth';

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
    onError: (error: { code: string; message: string }) => {
      setError(error.code, error.message);
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
      if (data.success) {
        setAuthenticated(data.data.user_id, data.data.is_new_user);
        // Invalidate any cached user data to refetch
        queryClient.invalidateQueries({ queryKey: authKeys.session() });
      } else {
        setError('VERIFY_FAILED', data.data.message);
      }
    },
    onError: (error: { code: string; message: string }) => {
      setError(error.code, error.message);
    },
  });
}

// ==============================================
// RESEND OTP MUTATION
// ==============================================

export function useResendOtp() {
  const { phoneNumber, setOtpSent, setError, clearError } = useAuthStore();

  return useMutation({
    mutationFn: async (channel: 'sms' | 'whatsapp' = 'sms') => {
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
    onError: (error: { code: string; message: string }) => {
      setError(error.code, error.message);
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
        channel: channel ?? 'sms',
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
      resendOtpMutation.mutate(channel ?? 'sms');
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
