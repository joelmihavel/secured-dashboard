/**
 * Setup Hooks
 * React Query hooks for bank verification, utility verification, and landlord invites
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  verifyBank,
  verifyUtility,
  getUtilityOperators,
  sendLandlordInvite,
  resendLandlordInvite,
  getSetupProgress,
  mockOperators,
  mockSetupSteps,
} from '@/src/services/api/setup';
import type {
  BankVerificationRequest,
  BankVerificationResponse,
  UtilityVerificationRequest,
  UtilityVerificationResponse,
  UtilityOperator,
  LandlordInviteRequest,
  LandlordInviteResponse,
  SetupProgress,
} from '@/src/types/setup';

// Query Keys
export const setupQueryKeys = {
  all: ['setup'] as const,
  progress: (tenancyId: string) => [...setupQueryKeys.all, 'progress', tenancyId] as const,
  operators: (state: string) => [...setupQueryKeys.all, 'operators', state] as const,
};

/**
 * Hook for bank account verification
 */
export function useVerifyBank() {
  const queryClient = useQueryClient();

  return useMutation<BankVerificationResponse, Error, BankVerificationRequest>({
    mutationFn: verifyBank,
    onSuccess: (data, variables) => {
      if (data.success) {
        // Invalidate setup progress to refresh the steps
        queryClient.invalidateQueries({
          queryKey: setupQueryKeys.progress(variables.tenancyId),
        });
      }
    },
  });
}

/**
 * Hook for fetching utility operators
 */
export function useUtilityOperators(state: string = 'Karnataka') {
  return useQuery<UtilityOperator[], Error>({
    queryKey: setupQueryKeys.operators(state),
    queryFn: () => getUtilityOperators(state),
    staleTime: 1000 * 60 * 60, // 1 hour
    // Use mock data in development
    placeholderData: mockOperators,
  });
}

/**
 * Hook for utility bill verification
 */
export function useVerifyUtility() {
  const queryClient = useQueryClient();

  return useMutation<UtilityVerificationResponse, Error, UtilityVerificationRequest>({
    mutationFn: verifyUtility,
    onSuccess: (data, variables) => {
      if (data.success) {
        // Invalidate setup progress to refresh the steps
        queryClient.invalidateQueries({
          queryKey: setupQueryKeys.progress(variables.tenancyId),
        });
      }
    },
  });
}

/**
 * Hook for sending landlord invite
 */
export function useSendLandlordInvite() {
  const queryClient = useQueryClient();

  return useMutation<LandlordInviteResponse, Error, LandlordInviteRequest>({
    mutationFn: sendLandlordInvite,
    onSuccess: (data, variables) => {
      if (data.success) {
        // Invalidate setup progress to refresh the steps
        queryClient.invalidateQueries({
          queryKey: setupQueryKeys.progress(variables.tenancyId),
        });
      }
    },
  });
}

/**
 * Hook for resending landlord invite
 */
export function useResendLandlordInvite() {
  return useMutation<LandlordInviteResponse, Error, string>({
    mutationFn: resendLandlordInvite,
  });
}

/**
 * Hook for fetching setup progress
 */
export function useSetupProgress(tenancyId: string) {
  return useQuery<SetupProgress, Error>({
    queryKey: setupQueryKeys.progress(tenancyId),
    queryFn: () => getSetupProgress(tenancyId),
    enabled: !!tenancyId,
    staleTime: 1000 * 30, // 30 seconds
    // Use mock data as placeholder
    placeholderData: {
      steps: mockSetupSteps,
      currentStepIndex: 0,
      landlordStatus: { type: 'none' },
      completedCount: 0,
      totalCount: 3,
    },
  });
}

/**
 * Validation helpers
 */
export function validateAccountNumber(accountNumber: string): boolean {
  return /^\d{9,18}$/.test(accountNumber);
}

export function validateIfscCode(ifsc: string): boolean {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase());
}

export function validatePhoneNumber(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10 || (cleaned.length === 12 && cleaned.startsWith('91'));
}

export function validateEmail(email: string): boolean {
  if (!email) return true; // Email is optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Format helpers
 */
export function formatAccountNumber(accountNumber: string): string {
  // Show last 4 digits only
  if (accountNumber.length >= 4) {
    return `XXXX ${accountNumber.slice(-4)}`;
  }
  return accountNumber;
}

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
