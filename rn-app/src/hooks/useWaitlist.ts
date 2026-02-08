/**
 * Waitlist Hooks
 *
 * React Query hooks for waitlist operations.
 * Wraps waitlist API calls with caching and mutation handling.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import {
  getWaitlistStatus,
  applyReferralCode,
  validateReferralCode,
  getMockWaitlistStatus,
  WaitlistStatusData,
  WaitlistState,
} from '../services/api/waitlist';
import {
  useWaitlistStore,
  selectReferralCodeString,
  selectIsReferralComplete,
  selectCountdownText,
} from '../stores/waitlist';

// ==============================================
// QUERY KEYS
// ==============================================

export const waitlistKeys = {
  all: ['waitlist'] as const,
  status: () => [...waitlistKeys.all, 'status'] as const,
  referral: (code: string) => [...waitlistKeys.all, 'referral', code] as const,
};

// ==============================================
// POLLING INTERVAL
// ==============================================

const POLLING_INTERVAL = 30000; // 30 seconds

// ==============================================
// STATUS QUERY
// ==============================================

interface UseWaitlistStatusOptions {
  enabled?: boolean;
  useMock?: boolean;
  mockState?: WaitlistState;
}

/**
 * Hook to fetch and cache waitlist status
 * Automatically polls while status is pending
 */
export function useWaitlistStatus(options: UseWaitlistStatusOptions = {}) {
  const { enabled = true, useMock = false, mockState = 'pending' } = options;
  const store = useWaitlistStore();

  const query = useQuery({
    queryKey: waitlistKeys.status(),
    queryFn: async (): Promise<WaitlistStatusData> => {
      // Use mock data for development
      if (useMock || process.env.NODE_ENV === 'development') {
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 800));
        return getMockWaitlistStatus(mockState);
      }

      const result = await getWaitlistStatus();
      if (result.error) {
        throw result.error;
      }
      return result.data!;
    },
    enabled,
    refetchInterval: (query) => {
      // Only poll if status is pending
      const data = query.state.data;
      if (data?.state === 'pending' || data?.state === 'pending_long') {
        return POLLING_INTERVAL;
      }
      return false;
    },
    staleTime: 10000, // Consider data stale after 10 seconds
    retry: 2,
  });

  // Update store when data changes
  useEffect(() => {
    if (query.data) {
      const data = query.data;
      switch (data.state) {
        case 'pending':
          store.setViewState('pending');
          break;
        case 'pending_long':
          store.setViewState('pending_long');
          break;
        case 'approved':
          store.setViewState('approved');
          // Trigger confetti celebration
          store.setShowConfetti(true);
          setTimeout(() => store.setShowConfetti(false), 3000);
          break;
        case 'rejected':
          store.setViewState('rejected');
          // Start countdown timer
          if (data.nextApplicationCountdown > 0) {
            store.setCountdown(data.nextApplicationCountdown);
          }
          break;
      }
    }
  }, [query.data]);

  // Handle errors
  useEffect(() => {
    if (query.error) {
      const err = query.error as Error;
      const code = (err as unknown as { code?: string }).code || 'UNKNOWN';
      store.setError(code, err.message || 'Failed to load status');
    }
  }, [query.error]);

  return query;
}

// ==============================================
// APPLY REFERRAL MUTATION
// ==============================================

/**
 * Hook to apply a referral code
 */
export function useApplyReferral() {
  const queryClient = useQueryClient();
  const store = useWaitlistStore();

  return useMutation({
    mutationFn: async (code: string) => {
      const result = await applyReferralCode(code);
      if (result.error) {
        throw result.error;
      }
      return result.data!;
    },
    onMutate: () => {
      store.setApplyingReferral(true);
      store.setReferralError(null);
    },
    onSuccess: (data) => {
      store.setApplyingReferral(false);
      if (data.valid) {
        store.setReferralApplied(true);
        // Invalidate waitlist status to refetch with new priority
        queryClient.invalidateQueries({ queryKey: waitlistKeys.status() });
      } else {
        store.setReferralError(data.message);
      }
    },
    onError: (error: { code: string; message: string }) => {
      store.setApplyingReferral(false);
      store.setReferralError(error.message);
    },
  });
}

// ==============================================
// VALIDATE REFERRAL QUERY
// ==============================================

/**
 * Hook to validate a referral code (without applying)
 */
export function useValidateReferral(code: string) {
  return useQuery({
    queryKey: waitlistKeys.referral(code),
    queryFn: async () => {
      const result = await validateReferralCode(code);
      if (result.error) {
        throw result.error;
      }
      return result.data!;
    },
    enabled: code.length === 4,
    staleTime: 60000, // Cache validation for 1 minute
  });
}

// ==============================================
// COMBINED WAITLIST HOOK
// ==============================================

/**
 * Combined hook for waitlist operations
 * Provides all waitlist queries, mutations, and state in one hook
 */
export function useWaitlist(options: UseWaitlistStatusOptions = {}) {
  const store = useWaitlistStore();
  const queryClient = useQueryClient();

  // Status query
  const statusQuery = useWaitlistStatus(options);

  // Apply referral mutation
  const applyReferralMutation = useApplyReferral();

  // Countdown timer ref
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Start countdown when rejected
  useEffect(() => {
    if (store.viewState === 'rejected' && store.nextApplicationCountdown > 0) {
      countdownRef.current = setInterval(() => {
        store.decrementCountdown();
      }, 1000);

      return () => {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
        }
      };
    }
  }, [store.viewState, store.nextApplicationCountdown > 0]);

  // Actions
  const applyReferral = useCallback(() => {
    const code = selectReferralCodeString(store);
    if (code.length === 4) {
      applyReferralMutation.mutate(code);
    } else {
      store.setReferralError('Please enter a 4-character code');
    }
  }, [store, applyReferralMutation]);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: waitlistKeys.status() });
  }, [queryClient]);

  const setReferralCharacter = useCallback(
    (index: number, char: string) => {
      store.setReferralCharacter(index, char);
    },
    [store]
  );

  return {
    // Status data
    status: statusQuery.data,
    viewState: store.viewState,
    userName: store.userName,
    isLoading: statusQuery.isLoading,
    isRefetching: statusQuery.isRefetching,
    error: store.error,

    // Referral state
    referralCode: store.referralCode,
    isReferralComplete: selectIsReferralComplete(store),
    isApplyingReferral: store.isApplyingReferral,
    referralApplied: store.referralApplied,
    referralError: store.referralError,
    isReferralExpanded: store.isReferralExpanded,

    // UI state
    showConfetti: store.showConfetti,
    countdownText: selectCountdownText(store),

    // Actions
    applyReferral,
    refresh,
    setReferralCharacter,
    toggleReferralExpanded: store.toggleReferralExpanded,
    setReferralExpanded: store.setReferralExpanded,
    clearReferralCode: store.clearReferralCode,
    setUserName: store.setUserName,
    reset: store.reset,
  };
}
