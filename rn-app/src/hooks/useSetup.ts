/**
 * Setup Hooks
 *
 * React Query hooks for bank verification, utility verification, and landlord invites.
 * All hooks use the service layer which handles snake_case <-> camelCase mapping.
 *
 * API functions now return { data, error } instead of throwing, consistent with
 * the waitlist pattern.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  verifyBank,
  verifyPan,
  verifyUtility,
  getUtilityOperators,
  sendLandlordInvite,
  resendLandlordInvite,
  deriveSetupProgress,
  buildSetupSteps,
} from '@/src/services/api/setup';
import type {
  BankVerificationRequest,
  BankVerificationResponse,
  PanVerificationRequest,
  PanVerificationResponse,
  UtilityVerificationRequest,
  UtilityVerificationResponse,
  UtilityOperator,
  LandlordInviteRequest,
  LandlordInviteResponse,
  SetupProgress,
  SetupError,
} from '@/src/types/setup';
import { dashboardKeys, useDashboard } from './useDashboard';

// ==============================================
// QUERY KEYS
// ==============================================

export const setupQueryKeys = {
  all: ['setup'] as const,
  progress: (tenancyId: string) => [...setupQueryKeys.all, 'progress', tenancyId] as const,
  operators: () => [...setupQueryKeys.all, 'operators'] as const,
};

// ==============================================
// BANK VERIFICATION
// ==============================================

/**
 * Hook for bank account verification via Cashfree Penny Drop.
 *
 * Usage:
 *   const verifyBank = useVerifyBank();
 *   verifyBank.mutate(request, { onSuccess, onError });
 *
 * The mutation throws a SetupError on failure so React Query's onError works.
 */
export function useVerifyBank() {
  const queryClient = useQueryClient();

  return useMutation<BankVerificationResponse, SetupError, BankVerificationRequest>({
    mutationFn: async (request) => {
      const { data, error } = await verifyBank(request);
      if (error) throw error;
      if (!data) throw { code: 'UNKNOWN_ERROR', message: 'No response data' } as SetupError;
      return data;
    },
    onSuccess: (_data, variables) => {
      // Invalidate dashboard to refresh verification status
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}

// ==============================================
// PAN VERIFICATION
// ==============================================

/**
 * Hook for PAN card verification via Cashfree PAN API.
 *
 * Usage:
 *   const verifyPanMutation = useVerifyPan();
 *   verifyPanMutation.mutate(request, { onSuccess, onError });
 */
export function useVerifyPan() {
  const queryClient = useQueryClient();

  return useMutation<PanVerificationResponse, SetupError, PanVerificationRequest>({
    mutationFn: async (request) => {
      const { data, error } = await verifyPan(request);
      if (error) throw error;
      if (!data) throw { code: 'UNKNOWN_ERROR', message: 'No response data' } as SetupError;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}

// ==============================================
// UTILITY OPERATORS
// ==============================================

/**
 * Hook for fetching electricity operators from the verify-utility endpoint.
 *
 * Calls: GET /functions/v1/verify-utility?action=operators
 * Falls back to mock Karnataka operators in dev mode.
 */
export function useUtilityOperators() {
  return useQuery<UtilityOperator[], SetupError>({
    queryKey: setupQueryKeys.operators(),
    queryFn: async () => {
      const { data, error } = await getUtilityOperators();
      if (error) {
        throw error;
      }
      return data ?? [];
    },
    staleTime: 1000 * 60 * 60, // 1 hour - operators rarely change
  });
}

// ==============================================
// UTILITY VERIFICATION
// ==============================================

/**
 * Hook for utility bill verification via API Club + Gemini matching.
 *
 * Usage:
 *   const verifyUtility = useVerifyUtility();
 *   verifyUtility.mutate(request, { onSuccess, onError });
 */
export function useVerifyUtility() {
  const queryClient = useQueryClient();

  return useMutation<UtilityVerificationResponse, SetupError, UtilityVerificationRequest>({
    mutationFn: async (request) => {
      const { data, error } = await verifyUtility(request);
      if (error) throw error;
      if (!data) throw { code: 'UNKNOWN_ERROR', message: 'No response data' } as SetupError;
      return data;
    },
    onSuccess: (_data, _variables) => {
      // Invalidate dashboard to refresh verification status
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}

// ==============================================
// LANDLORD INVITE
// ==============================================

/**
 * Hook for sending landlord invitation email.
 *
 * Usage:
 *   const invite = useSendLandlordInvite();
 *   invite.mutate(request, { onSuccess, onError });
 *
 * Note: The edge function sends email, not SMS. The request accepts
 * landlordName and landlordEmail (not phone/channel).
 */
export function useSendLandlordInvite() {
  const queryClient = useQueryClient();

  return useMutation<LandlordInviteResponse, SetupError, LandlordInviteRequest>({
    mutationFn: async (request) => {
      const { data, error } = await sendLandlordInvite(request);
      if (error) throw error;
      if (!data) throw { code: 'UNKNOWN_ERROR', message: 'No response data' } as SetupError;
      return data;
    },
    onSuccess: (_data, _variables) => {
      // Invalidate dashboard to refresh verification status
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}

/**
 * Hook for resending landlord invitation.
 * Reuses the same send-landlord-invite edge function with resend=true.
 */
export function useResendLandlordInvite() {
  const queryClient = useQueryClient();

  return useMutation<LandlordInviteResponse, SetupError, string>({
    mutationFn: async (tenancyId) => {
      const { data, error } = await resendLandlordInvite(tenancyId);
      if (error) throw error;
      if (!data) throw { code: 'UNKNOWN_ERROR', message: 'No response data' } as SetupError;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}

// ==============================================
// SETUP PROGRESS (derived from dashboard data)
// ==============================================

/**
 * Hook for fetching setup progress.
 *
 * Setup progress is derived from the dashboard query (tenancy.verification_status),
 * NOT from a separate edge function. This avoids an unnecessary API call.
 *
 * @param _tenancyId - Retained for API compatibility; progress is derived from dashboard data.
 */
export function useSetupProgress(_tenancyId: string) {
  const { tenancy, isLoading, error } = useDashboard();

  const progress: SetupProgress = useMemo(() => {
    if (!tenancy) {
      return {
        steps: buildSetupSteps(false, false, false),
        currentStepIndex: 0,
        landlordStatus: { type: 'none' as const },
        completedCount: 0,
        totalCount: 3,
      };
    }
    return deriveSetupProgress(tenancy.verification_status);
  }, [tenancy]);

  return {
    data: progress,
    isLoading,
    error,
    // Mimic useQuery shape for consumers
    isSuccess: !isLoading && !error,
    isPending: isLoading,
  };
}

// ==============================================
// VALIDATION HELPERS
// ==============================================

/**
 * Validates account number: 9-18 digits.
 * Matches edge function validation: minLength: 9, maxLength: 18.
 */
export function validateAccountNumber(accountNumber: string): boolean {
  return /^\d{9,18}$/.test(accountNumber);
}

/**
 * Validates IFSC code format: 4 uppercase letters, 0, then 6 alphanumeric characters.
 * Matches edge function isValidIfsc validation from _shared/validation.ts.
 */
export function validateIfscCode(ifsc: string): boolean {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase());
}

/**
 * Validates phone number based on country code.
 * Falls back to 10 digits or 12 digits starting with 91 for India.
 */
const COUNTRY_DIGIT_LENGTH: Record<string, number> = {
  '+91': 10, '+1': 10, '+44': 10, '+971': 9, '+61': 9,
  '+65': 8, '+60': 10, '+49': 11, '+33': 9, '+966': 9,
  '+974': 8, '+968': 8, '+977': 10, '+94': 9,
};

export function validatePhoneNumber(phone: string, countryCode = '+91'): boolean {
  const cleaned = phone.replace(/\D/g, '');
  const expected = COUNTRY_DIGIT_LENGTH[countryCode];
  if (expected) return cleaned.length === expected;
  // Fallback: 7-15 digits
  return cleaned.length >= 7 && cleaned.length <= 15;
}

/**
 * Validates email format. Empty string is valid (email is optional for landlord invite).
 * Matches edge function isValidEmail from send-landlord-invite.
 */
export function validateEmail(email: string): boolean {
  if (!email) return true; // Email is optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validates consumer number: 5-30 characters (alphanumeric).
 * Matches edge function validation: minLength: 5, maxLength: 30.
 */
export function validateConsumerNumber(consumerNumber: string): boolean {
  const trimmed = consumerNumber.trim();
  return trimmed.length >= 5 && trimmed.length <= 30;
}

// ==============================================
// FORMAT HELPERS
// ==============================================

/**
 * Masks account number showing only last 4 digits.
 * e.g., "1234567890" -> "XXXX 7890"
 */
export function formatAccountNumber(accountNumber: string): string {
  if (accountNumber.length >= 4) {
    return `XXXX ${accountNumber.slice(-4)}`;
  }
  return accountNumber;
}

/**
 * Formats a 10-digit phone number with country code.
 * e.g., "9876543210" -> "+91 98765 43210"
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    const digits = cleaned.slice(2);
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return phone;
}

// Re-export deriveSetupProgress for use by dashboard-aware components
export { deriveSetupProgress };
