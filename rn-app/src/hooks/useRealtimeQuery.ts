/**
 * useRealtimeQuery — Composable Hook Bridging RealtimeManager → React Query
 *
 * Subscribes to Supabase postgres_changes via the centralized RealtimeManager
 * and invalidates specified React Query keys on events.
 *
 * Usage:
 *   useRealtimeQuery({
 *     table: 'payments',
 *     event: 'UPDATE',
 *     filter: `user_id=eq.${userId}`,
 *     queryKeys: [dashboardKeys.all, paymentKeys.history()],
 *   });
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { subscribe } from '../services/supabase/realtimeManager';

type PostgresEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseRealtimeQueryOptions {
  /** Postgres table to subscribe to */
  table: string;
  /** Event type to listen for */
  event: PostgresEvent;
  /** Optional Supabase realtime filter (e.g., `user_id=eq.abc123`) */
  filter?: string;
  /** React Query keys to invalidate when an event fires */
  queryKeys: readonly (readonly unknown[])[];
  /** Whether the subscription is active (default: true) */
  enabled?: boolean;
  /** If true, immediately refetch instead of lazy invalidation (default: false) */
  refetch?: boolean;
  /** Optional callback for custom logic on each event */
  onEvent?: (payload: RealtimePostgresChangesPayload<any>) => void;
}

export function useRealtimeQuery({
  table,
  event,
  filter,
  queryKeys,
  enabled = true,
  refetch = false,
  onEvent,
}: UseRealtimeQueryOptions): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = subscribe(
      table,
      event,
      (payload) => {
        // Invalidate or refetch all specified query keys
        for (const key of queryKeys) {
          if (refetch) {
            queryClient.refetchQueries({ queryKey: key as unknown[] });
          } else {
            queryClient.invalidateQueries({ queryKey: key as unknown[] });
          }
        }

        // Fire custom callback if provided
        onEvent?.(payload);
      },
      filter,
    );

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, event, filter, enabled]);
}
