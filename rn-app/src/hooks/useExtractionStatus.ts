/**
 * Extraction Status Hook
 *
 * Robust background-aware tracking of agreement extraction status.
 * Combines three mechanisms for reliable status detection:
 *
 * 1. React Query polling (PRIMARY) — 3s interval during processing, 200 polls (10 min cap)
 * 2. Supabase Realtime (ACCELERATOR) — instant WebSocket updates, triggers refetchQueries
 * 3. AppState listener (FOREGROUND RECOVERY) — immediate refetch on app resume
 *
 * Plus mount-time discovery: finds active extractions in DB when the hook mounts
 * (handles app-kill-and-reopen scenario).
 *
 * Latency characteristics:
 * - Best case: ~200-500ms (Realtime WebSocket fires → refetchQueries → UI update)
 * - Worst case: 3s (polling fallback when WebSocket is dead)
 *
 * Design decisions:
 * - Polling is primary because Realtime WebSocket dies on iOS background
 * - Realtime triggers refetchQueries for immediate fetch (not invalidateQueries)
 * - Per-poll staleness: pending >2 min or processing >7 min without DB update → failed
 * - Follows useDashboard.ts synchronous channel pattern (NOT async useWaitlist.ts)
 */

import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase/client';
import { fetchExtractionStatus, type ExtractionStatusData } from '../services/api/agreement';
import { agreementKeys } from './useAgreement';
import { useUploadStore } from '../stores/upload';

// ==============================================
// CONSTANTS
// ==============================================

/** Max polling duration: 200 polls * 3s = 10 minutes */
const MAX_POLL_COUNT = 200;
/** Fast polling during active processing — 3s for near-realtime feedback */
const POLL_INTERVAL_FAST_MS = 3_000;
/** Slower polling once first data arrives or for non-critical states */
const POLL_INTERVAL_SLOW_MS = 10_000;

/** If extraction_status=processing and updated_at > 7 min old, treat as failed */
const PROCESSING_STALENESS_MS = 7 * 60 * 1000;

/** If extraction_status=pending for > 2 min, processDocument likely failed silently */
const PENDING_STALENESS_MS = 2 * 60 * 1000;

/** Skip records older than 5 min for mount discovery (except completed) */
const DISCOVERY_MAX_AGE_MS = 5 * 60 * 1000;

// ==============================================
// QUERY KEY
// ==============================================

const extractionStatusKey = (id: string | null) =>
  ['agreement', 'extraction-status', id] as const;

// ==============================================
// INTERNAL HOOKS
// ==============================================

/**
 * React Query polling query (PRIMARY mechanism).
 * Polls every 10s while extraction is pending/processing.
 * Stops on terminal states (completed, failed).
 * Includes per-poll staleness check for hung backend.
 */
function useExtractionStatusQuery(extractionId: string | null) {
  const pollCountRef = useRef(0);

  // Reset poll count when extractionId changes
  useEffect(() => {
    pollCountRef.current = 0;
  }, [extractionId]);

  return useQuery({
    queryKey: extractionStatusKey(extractionId),
    queryFn: async (): Promise<ExtractionStatusData | null> => {
      if (!extractionId) return null;

      pollCountRef.current += 1;

      // Poll cap exhaustion: after 200 polls (10 min), force-fail non-terminal states
      // so the UI doesn't stay stuck on "scanning" indefinitely.
      // (Staleness checks at 2 min/7 min cover most cases, this is the final safety net.)
      if (pollCountRef.current >= MAX_POLL_COUNT) {
        const lastData = await fetchExtractionStatus(extractionId);
        if (lastData && lastData.extractionStatus !== 'completed' && lastData.extractionStatus !== 'failed') {
          return {
            ...lastData,
            extractionStatus: 'failed',
            extractionError: 'Processing timed out. Please try uploading again.',
          };
        }
        return lastData;
      }

      const data = await fetchExtractionStatus(extractionId);

      if (!data) return null;

      // Per-poll staleness checks
      const updatedAge = Date.now() - new Date(data.updatedAt).getTime();

      // If stuck at 'pending' for > 2 min, processDocument never triggered
      if (data.extractionStatus === 'pending' && updatedAge > PENDING_STALENESS_MS) {
        return {
          ...data,
          extractionStatus: 'failed',
          extractionError: 'Document processing failed to start. Please try uploading again.',
        };
      }

      // If stuck at 'processing' for > 7 min, backend is hung
      if (data.extractionStatus === 'processing' && updatedAge > PROCESSING_STALENESS_MS) {
        return {
          ...data,
          extractionStatus: 'failed',
          extractionError: 'Processing timed out. Please try uploading again.',
        };
      }

      return data;
    },
    enabled: !!extractionId,
    refetchInterval: (query) => {
      const status = query.state.data?.extractionStatus;
      // Stop polling on terminal states or if we've hit the cap
      if (status === 'completed' || status === 'failed') return false;
      if (pollCountRef.current >= MAX_POLL_COUNT) return false;
      // Fast poll during processing (backend is actively working)
      if (status === 'processing') return POLL_INTERVAL_FAST_MS;
      // Pending = file uploaded but processing hasn't started yet — fast poll
      if (status === 'pending') return POLL_INTERVAL_FAST_MS;
      // No data yet (first poll) — fast poll to get initial status quickly
      if (!status) return POLL_INTERVAL_FAST_MS;
      return false;
    },
    staleTime: 2_000,
    retry: 2,
  });
}

/**
 * Supabase Realtime channel (ACCELERATOR).
 * Follows useDashboard.ts SYNCHRONOUS pattern.
 * Immediately refetches the query on DB change for instant UI update.
 */
function useExtractionRealtime(extractionId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!extractionId) return;

    const channel = supabase
      .channel(`extraction:${extractionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'extracted_rental_info',
          filter: `id=eq.${extractionId}`,
        },
        () => {
          // Use refetchQueries for immediate fetch (not just invalidate + wait for next poll)
          queryClient.refetchQueries({
            queryKey: extractionStatusKey(extractionId),
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [extractionId, queryClient]);
}

/** Minimum time between AppState-triggered refetches (prevents rapid bg/fg cycling spam) */
const APP_STATE_DEBOUNCE_MS = 3_000;

/**
 * AppState foreground recovery.
 * When app returns from background, invalidate the query
 * so React Query refetches current status.
 * BUG 1 FIX: 3-second debounce prevents rapid bg/fg cycling from spamming refetches.
 */
function useExtractionAppStateRecovery(extractionId: string | null) {
  const queryClient = useQueryClient();
  const appStateRef = useRef(AppState.currentState);
  const lastRecoveryRef = useRef(0);

  useEffect(() => {
    if (!extractionId) return;

    const sub = AppState.addEventListener('change', (next) => {
      const wasBg = appStateRef.current.match(/inactive|background/);
      appStateRef.current = next;
      if (wasBg && next === 'active') {
        const now = Date.now();
        if (now - lastRecoveryRef.current < APP_STATE_DEBOUNCE_MS) return;
        lastRecoveryRef.current = now;
        queryClient.invalidateQueries({
          queryKey: extractionStatusKey(extractionId),
        });
      }
    });

    return () => sub.remove();
  }, [extractionId, queryClient]);
}

/**
 * Mount-time discovery: find user's latest active extraction in DB.
 * Handles the app-kill-and-reopen scenario where the store has
 * extractionId but query cache is cold.
 *
 * Also handles the case where store lost extractionId but DB has
 * an active extraction (e.g., store corrupted or cleared).
 */
function useMountDiscovery(enabled: boolean) {
  const hasRun = useRef(false);

  useEffect(() => {
    if (!enabled || hasRun.current) return;
    hasRun.current = true;

    const store = useUploadStore.getState();

    // If store has extractionId, verify it still exists in DB before resuming.
    // The record may have been deleted (user re-created, admin cleanup, etc.)
    // or belong to a different user (RLS blocks access).
    if (store.extractionId) {
      if (
        store.uploadPhase === 'requesting_url' ||
        store.uploadPhase === 'uploading_file'
      ) {
        // Client-side phases that didn't complete — file was never fully
        // uploaded. Reset and let the user see the incomplete upload error.
        store.reset();
        return;
      }

      if (
        store.uploadPhase === 'processing' ||
        store.uploadPhase === 'server_processing' ||
        store.uploadPhase === 'completed'
      ) {
        // Server-side phases — verify the record still exists before resuming
        (async () => {
          try {
            const status = await fetchExtractionStatus(store.extractionId!);
            const currentStore = useUploadStore.getState();

            if (!status || status.userVerified) {
              // Record doesn't exist, belongs to another user, or was already
              // reviewed — reset so the user sees a fresh upload screen.
              currentStore.reset();
              return;
            }

            // Don't restore completed extractions flagged for manual review.
            // These are awaiting admin review — the journey router will route
            // to waitlist. Restoring them causes a "Join Waitlist" button to
            // appear on the upload screen without the user having uploaded.
            if (
              status.extractionStatus === 'completed' &&
              (status.needsManualReview || !status.isCitySupported)
            ) {
              currentStore.reset();
              return;
            }

            // Record exists and is active — resume tracking
            if (currentStore.uploadPhase !== 'completed') {
              currentStore.setPhase('server_processing');
            }
          } catch {
            // Network error — keep store as-is, the query will retry
          }
        })();
      }
      return;
    }

    // No extractionId in store — check DB for active extraction.
    // Only resume 'processing' and 'completed' records.
    // 'pending' means the file was never uploaded — don't resume those.
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        const { data } = await supabase
          .from('extracted_rental_info')
          .select('id, extraction_status, updated_at, user_verified, needs_manual_review, is_city_supported')
          .eq('user_id', session.user.id)
          .in('extraction_status', ['processing', 'completed'])
          .eq('user_verified', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!data) return;

        const row = data as unknown as Record<string, unknown>;
        const status = row.extraction_status as string;
        const updatedAt = row.updated_at as string;
        const ageMs = Date.now() - new Date(updatedAt).getTime();

        // Skip stale processing records (completed records are always resumable)
        if (status === 'processing' && ageMs > DISCOVERY_MAX_AGE_MS) return;

        // Don't restore completed extractions flagged for manual review.
        // These are awaiting admin action — the journey router routes to waitlist.
        if (
          status === 'completed' &&
          ((row.needs_manual_review as boolean) || !(row.is_city_supported as boolean))
        ) {
          return;
        }

        // Found active extraction — set in store so query picks it up
        const currentStore = useUploadStore.getState();
        currentStore.setExtractionId(row.id as string);
        currentStore.setPhase('server_processing');
      } catch {
        // Silent fail — user can upload normally
      }
    })();
  }, [enabled]);
}

// ==============================================
// PUBLIC HOOK
// ==============================================

export interface UseExtractionStatusOptions {
  /** Gate on store hydration — pass hasHydrated from useUploadStore */
  enabled: boolean;
}

export interface UseExtractionStatusReturn {
  /** Current extraction status data from DB */
  data: ExtractionStatusData | null;
  /** Whether the initial query is loading */
  isLoading: boolean;
  /** Current extraction ID being tracked */
  extractionId: string | null;
  /** Whether there's an active (non-terminal) extraction */
  hasActiveExtraction: boolean;
  /** Reset tracking — clears extractionId from store and query cache */
  reset: () => void;
}

/**
 * Combined extraction status hook.
 *
 * Orchestrates polling, Realtime, AppState recovery, and mount discovery
 * into a single clean interface for the upload screen.
 */
export function useExtractionStatus(
  options: UseExtractionStatusOptions
): UseExtractionStatusReturn {
  const { enabled } = options;
  const extractionId = useUploadStore((s) => s.extractionId);
  const queryClient = useQueryClient();

  // Internal hooks
  const query = useExtractionStatusQuery(enabled ? extractionId : null);
  useExtractionRealtime(enabled ? extractionId : null);
  useExtractionAppStateRecovery(enabled ? extractionId : null);
  useMountDiscovery(enabled);

  const reset = useCallback(() => {
    const eid = useUploadStore.getState().extractionId;
    useUploadStore.getState().reset();
    if (eid) {
      queryClient.removeQueries({ queryKey: extractionStatusKey(eid) });
      // Also invalidate the full extraction data cache
      queryClient.removeQueries({ queryKey: agreementKeys.extraction(eid) });
    }
  }, [queryClient]);

  const status = query.data?.extractionStatus;
  // BUG 4 FIX: A completed-but-unverified extraction is still "active" —
  // prevent users from starting a new upload while one awaits review.
  const hasActiveExtraction =
    status === 'pending' ||
    status === 'processing' ||
    (status === 'completed' && !query.data?.userVerified);

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    extractionId,
    hasActiveExtraction,
    reset,
  };
}
