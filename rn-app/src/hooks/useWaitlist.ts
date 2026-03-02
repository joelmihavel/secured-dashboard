/**
 * Waitlist Hooks
 *
 * React Query hooks for waitlist operations.
 * Wraps waitlist API calls with caching and mutation handling.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getWaitlistStatus,
  joinWaitlist,
  getMyReferralCode,
  applyReferralCode,
  validateReferralCode,
  claimInviteCode,
  WaitlistStatusData,
  WaitlistState,
  type WaitlistErrorCode,
} from '../services/api/waitlist';
import {
  useWaitlistStore,
  selectReferralCodeString,
  selectIsReferralComplete,
  selectCountdownText,
} from '../stores/waitlist';
import { useAuthStore } from '../stores/auth';
import { supabase } from '../services/supabase/client';
import { useRealtimeQuery } from './useRealtimeQuery';

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

  // Realtime subscription via centralized manager — no async race condition.
  // userId is read synchronously from Zustand store.
  const userId = useAuthStore((s) => s.userId);

  useRealtimeQuery({
    table: 'waitlist_entries',
    event: '*',
    filter: userId ? `user_id=eq.${userId}` : undefined,
    queryKeys: [waitlistKeys.status()],
    enabled: enabled && !useMock && !!userId,
    refetch: true,
  });

  // Include mockState in the query key so React Query refetches when the
  // dev mock state changes (e.g., switching from pending → accepted).
  const queryKey = useMock
    ? [...waitlistKeys.status(), 'mock', mockState]
    : waitlistKeys.status();

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<WaitlistStatusData> => {
      const result = await getWaitlistStatus();
      if (result.error) {
        throw result.error;
      }
      return result.data!;
    },
    enabled,
    refetchInterval: (query) => {
      // Poll at different rates depending on state.
      // Realtime handles instant updates; polling is a fallback for
      // connection drops (common on mobile).
      const data = query.state.data;
      if (data?.state === 'pending' || data?.state === 'pending_long') {
        return POLLING_INTERVAL; // 30s — actively waiting
      }
      // Keep polling for approved/rejected so admin changes reflect
      // even if the realtime WebSocket silently disconnects.
      return POLLING_INTERVAL * 2; // 60s
    },
    staleTime: 10000,
    refetchOnWindowFocus: 'always',
    retry: 2,
  });

  // Update store when data changes
  useEffect(() => {
    if (query.data) {
      const data = query.data;
      // Clear any prior error state (e.g., from a failed initial fetch that
      // succeeded on retry). Without this, the error viewState is sticky.
      store.clearError();
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

  // Handle errors — only show full-screen error for initial load failure.
  // If we already have data (successful prior fetch), transient polling errors
  // should NOT wipe the active UI. The user can still interact normally.
  useEffect(() => {
    if (query.error && !query.data) {
      const err = query.error as Error;
      const code = (err as unknown as { code?: string }).code || 'UNKNOWN';
      store.setError(code, err.message || 'Failed to load status');
    }
  }, [query.error, query.data]);

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
      try {
        return await joinWaitlist();
      } catch (e) {
        return {
          data: null,
          error: {
            code: 'UNKNOWN_ERROR' as WaitlistErrorCode,
            message: e instanceof Error ? e.message : 'Something went wrong',
          },
        };
      }
    },
    meta: { suppressGlobalError: true },
    onSuccess: (result) => {
      if (!result.error) {
        queryClient.invalidateQueries({ queryKey: waitlistKeys.status() });
      }
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
      try {
        return await applyReferralCode(code);
      } catch (e) {
        return {
          data: null,
          error: {
            code: 'UNKNOWN_ERROR' as WaitlistErrorCode,
            message: e instanceof Error ? e.message : 'Something went wrong',
          },
        };
      }
    },
    meta: { suppressGlobalError: true },
    onMutate: () => {
      store.setApplyingReferral(true);
      store.setReferralError(null);
    },
    onSuccess: (result) => {
      store.setApplyingReferral(false);
      if (result.error) {
        store.setReferralError(result.error.message);
      } else if (result.data?.valid) {
        store.setReferralApplied(true);
        queryClient.invalidateQueries({ queryKey: waitlistKeys.status() });
      } else {
        store.setReferralError(result.data?.message ?? 'Invalid referral code');
      }
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
// CLAIM INVITE CODE MUTATION
// ==============================================

/**
 * Hook to claim an admin-generated invite code.
 * Validates format (2 letters + 2 digits) and claims atomically via backend.
 */
export function useClaimInviteCode() {
  const queryClient = useQueryClient();
  const store = useWaitlistStore();

  return useMutation({
    mutationFn: async (code: string) => {
      try {
        return await claimInviteCode(code);
      } catch (e) {
        // Absolute safety net — NEVER throw from this mutation
        return {
          success: false as const,
          data: null,
          error: {
            code: 'UNKNOWN_ERROR' as WaitlistErrorCode,
            message: e instanceof Error ? e.message : 'Something went wrong',
          },
        };
      }
    },
    meta: { suppressGlobalError: true },
    onMutate: () => {
      store.setApplyingReferral(true);
      store.setReferralError(null);
    },
    onSuccess: (result) => {
      store.setApplyingReferral(false);
      if (result.error) {
        store.setReferralError(result.error.message);
      } else {
        store.setReferralApplied(true);
        queryClient.invalidateQueries({ queryKey: waitlistKeys.status() });
      }
    },
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

  // Hydrate name from Supabase session when auth store is empty.
  // This covers returning users where the Zustand store starts fresh
  // but the name was saved to user_metadata during sign-up.
  const [sessionName, setSessionName] = useState('');
  useEffect(() => {
    if (!authUserName) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        const name = session?.user?.user_metadata?.name;
        if (name) {
          setSessionName(name);
          // Also sync back to auth store so other screens pick it up
          useAuthStore.getState().setUserName(name);
        }
      }).catch(() => {});
    }
  }, [authUserName]);

  // Status query
  const statusQuery = useWaitlistStatus(options);

  // Join waitlist mutation
  const joinWaitlistMutation = useJoinWaitlist();

  // My referral code query (skip when using mock data — no auth session available)
  const myReferralCodeQuery = useMyReferralCode(options.enabled !== false && !options.useMock);

  // Apply referral mutation
  const applyReferralMutation = useApplyReferral();

  // Claim invite code mutation
  const claimInviteCodeMutation = useClaimInviteCode();

  // Countdown timer ref
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Claim invite code using the 4-char input
  const claimInviteCode = useCallback(() => {
    const code = selectReferralCodeString(store);
    if (code.length === 4) {
      claimInviteCodeMutation.mutate(code);
    } else {
      store.setReferralError('Please enter a valid 4-character invite code');
    }
  }, [store, claimInviteCodeMutation]);

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
    userName: authUserName || sessionName || store.userName,
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
    claimInviteCode,
    isClaimingInviteCode: claimInviteCodeMutation.isPending,
    inviteCodeClaimed: statusQuery.data?.hasInviteCode ?? false,
    refresh,
    setReferralCharacter,
    toggleReferralExpanded: store.toggleReferralExpanded,
    setReferralExpanded: store.setReferralExpanded,
    clearReferralCode: store.clearReferralCode,
    setUserName: store.setUserName,
    reset: store.reset,
  };
}
