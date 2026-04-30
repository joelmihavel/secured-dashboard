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
import { useAuthStore } from '../stores/auth';

// ==============================================
// CONSTANTS
// ==============================================

/** Max polling duration: 300 polls * 3s = 15 minutes (covers 300s DocAI + 300s Gemini + margin) */
const MAX_POLL_COUNT = 300;
/** Fast polling during active processing — 3s for near-realtime feedback */
const POLL_INTERVAL_FAST_MS = 3_000;
/** Slower polling once first data arrives or for non-critical states */
const POLL_INTERVAL_SLOW_MS = 10_000;

/** If extraction_status=processing and updated_at > 12 min old, treat as failed.
 *  Backend has 300s Document AI + 300s Gemini = 10 min max. 12 min adds safety margin. */
const PROCESSING_STALENESS_MS = 12 * 60 * 1000;

/** If extraction_status=pending for > 3 min, processDocument likely failed silently.
 *  Increased from 2 min to account for slow networks triggering processDocument. */
const PENDING_STALENESS_MS = 3 * 60 * 1000;

/** Skip records older than 15 min for mount discovery (except completed) */
const DISCOVERY_MAX_AGE_MS = 15 * 60 * 1000;

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
 * Uses centralized realtimeManager (subscribe/unsubscribe) instead of raw
 * supabase.channel() to benefit from iOS background recovery and coalescing.
 * Raw channels throw DOMException when WebSocket is in CLOSING state on resume.
 */
function useExtractionRealtime(extractionId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!extractionId) return;

    const { subscribe: rtSubscribe } = require('../services/supabase/realtimeManager');
    const unsubscribe = rtSubscribe(
      'extracted_rental_info',
      'UPDATE',
      () => {
        queryClient.refetchQueries({
          queryKey: extractionStatusKey(extractionId),
        });
      },
      `id=eq.${extractionId}`,
    );

    return unsubscribe;
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
        // Delay refetch until AFTER ResumeOverlay fades (500ms + 250ms fade).
        // This ensures the refetch-triggered re-render happens when native views
        // are fully stable — preventing PropertyDOM errors.
        setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey: extractionStatusKey(extractionId),
          });
        }, 1500);
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
    if (store.extractionId) {
      if (
        store.uploadPhase === 'requesting_url' ||
        store.uploadPhase === 'uploading_file'
      ) {
        // Client-side phases that didn't complete — file was never fully
        // uploaded. Reset so the upload screen drops its 'uploading' UI
        // state (the storePhase='idle' useEffect picks this up and shows
        // the "Upload Interrupted" alert). Without this, a user who
        // backgrounded mid-upload and cold-restarts within 10 min sees a
        // stuck progress bar with no upload actually running.
        store.reset();
        return;
      }

      if (
        store.uploadPhase === 'processing' ||
        store.uploadPhase === 'server_processing' ||
        store.uploadPhase === 'completed' ||
        store.uploadPhase === 'failed'
      ) {
        // Server-side phases — verify the record still exists before resuming
        (async () => {
          try {
            const status = await fetchExtractionStatus(store.extractionId!);
            const currentStore = useUploadStore.getState();

            // Store was reset while we were fetching (forceNew / re-upload)
            if (currentStore.dismissedExtractionId === store.extractionId) return;

            if (!status) {
              // Record genuinely missing (RLS, admin cleanup, etc.). Reset
              // so the upload screen renders the idle state instead of
              // tracking a phantom extraction that will never complete.
              currentStore.reset();
              return;
            }
            // NOTE: We deliberately do NOT reset on userVerified=true.
            // The cloud-run extraction-service auto-sets user_verified=true on
            // every successful extraction (see finalize.ts:149-152). Resetting
            // the store on that signal stranded users on /upload after cold
            // restart. Keep the store intact and let the waitlisted +
            // !bankStepCompleted branch in app/index.tsx route them forward.

            // BUG FIX: If the stored extraction is in a terminal error state
            // (invalid_document or failed), check the DB for a NEWER extraction
            // that supersedes it. This handles the re-upload scenario where:
            // 1. User uploaded doc A → invalid_document
            // 2. User re-uploaded doc B → succeeded (completed/user_review)
            // 3. App was killed/restarted with store still pointing to A
            // Without this check, useMountDiscovery resumes tracking A and
            // the status effect shows the old error, ignoring B entirely.
            const isTerminalError =
              status.extractionStatus === 'failed' ||
              status.extractionStatus === 'extraction_failed' ||
              status.contractStatus === 'invalid_document';

            if (isTerminalError) {
              const userId = useAuthStore.getState().userId;
              if (userId) {
                const { data: newerRow } = await supabase
                  .from('extracted_rental_info')
                  .select('id, extraction_status, updated_at, user_verified')
                  .eq('user_id', userId)
                  .in('extraction_status', ['processing', 'completed'])
                  .eq('user_verified', false)
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();

                if (newerRow) {
                  const newerRowId = (newerRow as unknown as Record<string, unknown>).id as string;
                  // Only switch if the newer row is genuinely different from the stored one
                  if (newerRowId !== store.extractionId) {
                    // Set extractionId + phase atomically to avoid phase-transition
                    // validation issues (e.g., server_processing → server_processing
                    // is rejected by isValidPhaseTransition).
                    useUploadStore.setState({
                      extractionId: newerRowId,
                      uploadPhase: 'server_processing',
                      lastUpdatedAt: Date.now(),
                      errorCode: null,
                      errorMessage: null,
                    });
                    return;
                  }
                }
              }
              // No newer extraction found — resume tracking the failed one
              // so the status effect can show the appropriate error UI.
            }

            // Record exists and is active — resume tracking
            // (manual_review / unsupported city no longer blocks user — admin handles in background)
            if (currentStore.uploadPhase !== 'completed') {
              // Use setState for 'failed' phase since setPhase rejects
              // transitions from 'failed' (not in PHASE_ORDER).
              if (currentStore.uploadPhase === 'failed') {
                useUploadStore.setState({
                  uploadPhase: 'server_processing',
                  lastUpdatedAt: Date.now(),
                  errorCode: null,
                  errorMessage: null,
                });
              } else {
                currentStore.setPhase('server_processing');
              }
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
    // Read userId from auth store (synchronous) instead of calling
    // supabase.auth.getSession() which triggers _callRefreshToken() and
    // races with autoRefreshToken causing spurious SIGNED_OUT events.
    (async () => {
      try {
        const userId = useAuthStore.getState().userId;
        if (!userId) return;

        const { data } = await supabase
          .from('extracted_rental_info')
          .select('id, extraction_status, updated_at, user_verified, needs_manual_review, is_city_supported')
          .eq('user_id', userId)
          .in('extraction_status', ['processing', 'completed'])
          .eq('user_verified', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!data) return;

        const row = data as unknown as Record<string, unknown>;
        const rowId = row.id as string;
        const status = row.extraction_status as string;
        const updatedAt = row.updated_at as string;
        const ageMs = Date.now() - new Date(updatedAt).getTime();

        // Skip extraction the user explicitly abandoned via "Re-upload"
        const dismissed = useUploadStore.getState().dismissedExtractionId;
        if (dismissed && rowId === dismissed) return;

        // Skip stale processing records (completed records are always resumable)
        if (status === 'processing' && ageMs > DISCOVERY_MAX_AGE_MS) return;

        // Found active extraction — set in store so query picks it up
        // (manual_review / unsupported city no longer blocks — admin handles in background)
        const currentStore = useUploadStore.getState();
        currentStore.setExtractionId(rowId);
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
