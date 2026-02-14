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
  joinWaitlist,
  getMyReferralCode,
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
import { useAuthStore } from '../stores/auth';
import { supabase } from '../services/supabase/client';

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
 * Subscribes to realtime updates and falls back to polling
 */
export function useWaitlistStatus(options: UseWaitlistStatusOptions = {}) {
  const { enabled = true, useMock = false, mockState = 'pending' } = options;
  const store = useWaitlistStore();
  const queryClient = useQueryClient();

  // Realtime subscription — instantly refetch when admin approves/rejects
  useEffect(() => {
    if (!enabled || useMock) return;

    let userId: string | null = null;

    const setupRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id ?? null;
      if (!userId) return;

      const channel = supabase
        .channel(`waitlist:${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'waitlist_entries',
            filter: `user_id=eq.${userId}`,
          },
          () => {
            // Immediately refetch status on any change to user's waitlist entry
            queryClient.invalidateQueries({ queryKey: waitlistKeys.status() });
          }
        )
        .subscribe();

      // Store cleanup reference
      return channel;
    };

    let channelRef: ReturnType<typeof supabase.channel> | undefined;
    setupRealtime().then((ch) => { channelRef = ch; });

    return () => {
      if (channelRef) {
        supabase.removeChannel(channelRef);
      }
    };
  }, [enabled, useMock, queryClient]);

  const query = useQuery({
    queryKey: waitlistKeys.status(),
    queryFn: async (): Promise<WaitlistStatusData> => {
      // Use mock data only when explicitly requested
      if (useMock) {
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
      // Only poll if status is pending (realtime handles instant updates,
      // polling is a fallback for connection drops)
      const data = query.state.data;
      if (data?.state === 'pending' || data?.state === 'pending_long') {
        return POLLING_INTERVAL;
      }
      return false;
    },
    staleTime: 10000,
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
// JOIN WAITLIST MUTATION
// ==============================================

/**
 * Hook to join the waitlist (idempotent)
 * Typically called after auth, but the DB trigger also auto-creates the entry.
 */
export function useJoinWaitlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await joinWaitlist();
      if (result.error) {
        throw result.error;
      }
      return result.data!;
    },
    onSuccess: () => {
      // Refresh waitlist status after joining
      queryClient.invalidateQueries({ queryKey: waitlistKeys.status() });
    },
  });
}

// ==============================================
// GET MY REFERRAL CODE QUERY
// ==============================================

/**
 * Hook to get/generate the user's own referral code for sharing
 */
export function useMyReferralCode(enabled = true) {
  return useQuery({
    queryKey: [...waitlistKeys.all, 'my-referral-code'] as const,
    queryFn: async () => {
      const result = await getMyReferralCode();
      if (result.error) {
        throw result.error;
      }
      return result.data!;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
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
    enabled: code.length >= 4 && code.length <= 10,
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
  const authUserName = useAuthStore((s) => s.userName);

  // Status query
  const statusQuery = useWaitlistStatus(options);

  // Join waitlist mutation
  const joinWaitlistMutation = useJoinWaitlist();

  // My referral code query
  const myReferralCodeQuery = useMyReferralCode(options.enabled !== false);

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
    if (code.length >= 4 && code.length <= 10) {
      applyReferralMutation.mutate(code);
    } else {
      store.setReferralError('Please enter a valid referral code (4-10 characters)');
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

  // Join waitlist action
  const joinWaitlistAction = useCallback(() => {
    joinWaitlistMutation.mutate();
  }, [joinWaitlistMutation]);

  return {
    // Status data
    status: statusQuery.data,
    viewState: store.viewState,
    userName: authUserName || store.userName,
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

    // My referral code (for sharing)
    myReferralCode: myReferralCodeQuery.data,
    isLoadingMyCode: myReferralCodeQuery.isLoading,

    // UI state
    showConfetti: store.showConfetti,
    countdownText: selectCountdownText(store),

    // Actions
    joinWaitlist: joinWaitlistAction,
    isJoiningWaitlist: joinWaitlistMutation.isPending,
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
