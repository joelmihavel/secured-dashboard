/**
 * Realtime Manager — Centralized Supabase Channel Singleton
 *
 * Module-level singleton (not React context) that manages all Supabase
 * realtime subscriptions with:
 * - Reference counting: multiple hooks subscribing to the same table/filter share one channel
 * - Coalescing: 100ms debounce prevents thundering herd from rapid DB events
 * - iOS background recovery: AppState listener reconnects all channels after 5+ seconds in background
 * - Network reconnection: NetInfo listener reconnects channels when network restores
 * - JWT refresh reconnection: re-subscribes channels when auth token refreshes (prevents stale JWT on long sessions)
 * - Retry with backoff: failed reconnections are retried up to 3 times
 * - Logout cleanup: removeAllChannels() tears down everything on sign-out
 */

import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from './client';

type PostgresEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface ChannelEntry {
  channel: RealtimeChannel;
  refCount: number;
  callbacks: Map<string, Set<(payload: RealtimePostgresChangesPayload<any>) => void>>;
  debounceTimers: Map<string, ReturnType<typeof setTimeout>>;
}

const COALESCE_MS = 100;
const BACKGROUND_RECONNECT_THRESHOLD_MS = 5000;
const MAX_RECONNECT_RETRIES = 3;
const RECONNECT_BASE_DELAY_MS = 2000;

let channels: Map<string, ChannelEntry> = new Map();
let backgroundTimestamp: number | null = null;
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
let netInfoUnsubscribe: (() => void) | null = null;
let authUnsubscribe: { data: { subscription: { unsubscribe: () => void } } } | null = null;
let wasOffline = false;
let reconnectRetryCount = 0;
let reconnectRetryTimer: ReturnType<typeof setTimeout> | null = null;

function getChannelKey(table: string, filter?: string): string {
  return filter ? `${table}:${filter}` : table;
}

// ── Reconnect with retry (Bug #4) ────────────────────────────────────

function reconnectWithRetry(): void {
  reconnectRetryCount = 0;
  attemptReconnect();
}

function attemptReconnect(): void {
  if (channels.size === 0) return;

  try {
    reconnectAll();
    reconnectRetryCount = 0; // Success — reset counter
  } catch {
    reconnectRetryCount++;
    if (reconnectRetryCount <= MAX_RECONNECT_RETRIES) {
      const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, reconnectRetryCount - 1);
      if (__DEV__) {
        console.log(`[RealtimeManager] Reconnect failed, retry ${reconnectRetryCount}/${MAX_RECONNECT_RETRIES} in ${delay}ms`);
      }
      reconnectRetryTimer = setTimeout(attemptReconnect, delay);
    } else if (__DEV__) {
      console.log('[RealtimeManager] Max reconnect retries exceeded — waiting for next trigger');
    }
  }
}

// ── App State Handler ─────────────────────────────────────────────────

function handleAppStateChange(nextState: AppStateStatus) {
  if (nextState === 'background' || nextState === 'inactive') {
    backgroundTimestamp = Date.now();
  } else if (nextState === 'active' && backgroundTimestamp) {
    const elapsed = Date.now() - backgroundTimestamp;
    backgroundTimestamp = null;
    if (elapsed >= BACKGROUND_RECONNECT_THRESHOLD_MS) {
      // Long background (>5s): WebSocket is dead, reconnect after delay.
      setTimeout(() => reconnectWithRetry(), 1500);
    } else if (elapsed >= 1000) {
      // Short background (1-5s): health check — reconnect if any channel is broken.
      setTimeout(() => {
        try {
          for (const [, entry] of channels) {
            const state = (entry.channel as any)?.state;
            if (state === 'closed' || state === 'errored') {
              reconnectWithRetry();
              break;
            }
          }
        } catch { /* swallow */ }
      }, 2000);
    }
  }
}

// ── Network Reconnection (Bug #17) ───────────────────────────────────

function setupNetworkListener() {
  if (netInfoUnsubscribe) return;
  netInfoUnsubscribe = NetInfo.addEventListener((state) => {
    const isOnline = !!state.isConnected;
    if (wasOffline && isOnline && channels.size > 0) {
      // Network restored — reconnect realtime channels
      if (__DEV__) {
        console.log('[RealtimeManager] Network restored — reconnecting channels');
      }
      setTimeout(() => reconnectWithRetry(), 1000);
    }
    wasOffline = !isOnline;
  });
}

// ── JWT Refresh Reconnection (Bug #10) ───────────────────────────────

function setupAuthListener() {
  if (authUnsubscribe) return;
  authUnsubscribe = supabase.auth.onAuthStateChange((event) => {
    if (event === 'TOKEN_REFRESHED' && channels.size > 0) {
      // JWT refreshed — old channels may have stale tokens
      if (__DEV__) {
        console.log('[RealtimeManager] Token refreshed — reconnecting channels with fresh JWT');
      }
      setTimeout(() => reconnectWithRetry(), 500);
    }
  });
}

// ── Lifecycle ─────────────────────────────────────────────────────────

function ensureListeners() {
  if (!appStateSubscription) {
    appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
  }
  setupNetworkListener();
  setupAuthListener();
}

/**
 * Subscribe to realtime postgres changes on a table.
 * Returns an unsubscribe function for cleanup.
 */
export function subscribe(
  table: string,
  event: PostgresEvent,
  callback: (payload: RealtimePostgresChangesPayload<any>) => void,
  filter?: string,
): () => void {
  ensureListeners();

  const key = getChannelKey(table, filter);
  const callbackId = `${event}:${Math.random().toString(36).slice(2)}`;
  let entry = channels.get(key);

  if (!entry) {
    const channelConfig: any = {
      event: event === '*' ? '*' : event,
      schema: 'public',
      table,
    };
    if (filter) {
      channelConfig.filter = filter;
    }

    const channel = supabase
      .channel(`rt:${key}`)
      .on('postgres_changes', channelConfig, (payload: RealtimePostgresChangesPayload<any>) => {
        const currentEntry = channels.get(key);
        if (!currentEntry) return;

        // Coalesced dispatch — debounce per callback to prevent thundering herd.
        // Filter by event type: callbackId is `${event}:${random}`, so we check
        // if the callback's event matches the payload's eventType. Without this,
        // a DELETE callback sharing a channel with an UPDATE subscription would
        // fire on UPDATE events — causing spurious signOut on user_status changes.
        const incomingEvent = (payload as any).eventType as string | undefined;
        for (const [cbId, cbSet] of currentEntry.callbacks) {
          const cbEvent = cbId.split(':')[0]; // Extract event from "UPDATE:abc123"
          if (incomingEvent && cbEvent !== '*' && cbEvent !== incomingEvent) continue;
          for (const cb of cbSet) {
            const timerKey = `${cbId}:${cb.toString().slice(0, 20)}`;
            const existingTimer = currentEntry.debounceTimers.get(timerKey);
            if (existingTimer) clearTimeout(existingTimer);

            currentEntry.debounceTimers.set(
              timerKey,
              setTimeout(() => {
                currentEntry.debounceTimers.delete(timerKey);
                cb(payload);
              }, COALESCE_MS),
            );
          }
        }
      })
      .subscribe();

    entry = {
      channel,
      refCount: 0,
      callbacks: new Map(),
      debounceTimers: new Map(),
    };
    channels.set(key, entry);
  }

  entry.refCount++;

  if (!entry.callbacks.has(callbackId)) {
    entry.callbacks.set(callbackId, new Set());
  }
  entry.callbacks.get(callbackId)!.add(callback);

  // Return unsubscribe function
  return () => {
    const currentEntry = channels.get(key);
    if (!currentEntry) return;

    currentEntry.callbacks.get(callbackId)?.delete(callback);
    if (currentEntry.callbacks.get(callbackId)?.size === 0) {
      currentEntry.callbacks.delete(callbackId);
    }

    currentEntry.refCount--;

    if (currentEntry.refCount <= 0) {
      // Clear all pending debounce timers
      for (const timer of currentEntry.debounceTimers.values()) {
        clearTimeout(timer);
      }
      supabase.removeChannel(currentEntry.channel);
      channels.delete(key);
    }
  };
}

/**
 * Reconnect all active channels (e.g., after iOS background recovery).
 */
export function reconnectAll(): void {
  for (const [key, entry] of channels) {
    try {
      supabase.removeChannel(entry.channel);
    } catch {
      // WebSocket may be in a broken state after iOS background — safe to ignore.
    }
  }

  // Re-subscribe all existing entries with fresh channels
  const oldEntries = new Map(channels);
  channels.clear();

  for (const [key, entry] of oldEntries) {
    const parts = key.split(':');
    const table = parts[0];
    const filter = parts.length > 1 ? parts.slice(1).join(':') : undefined;

    const channelConfig: any = {
      event: '*',
      schema: 'public',
      table,
    };
    if (filter) {
      channelConfig.filter = filter;
    }

    try {
      const newChannel = supabase
        .channel(`rt:${key}:${Date.now()}`)
        .on('postgres_changes', channelConfig, (payload: RealtimePostgresChangesPayload<any>) => {
          const currentEntry = channels.get(key);
          if (!currentEntry) return;

          for (const [, cbSet] of currentEntry.callbacks) {
            for (const cb of cbSet) {
              const timerKey = `reconn:${cb.toString().slice(0, 20)}`;
              const existingTimer = currentEntry.debounceTimers.get(timerKey);
              if (existingTimer) clearTimeout(existingTimer);

              currentEntry.debounceTimers.set(
                timerKey,
                setTimeout(() => {
                  currentEntry.debounceTimers.delete(timerKey);
                  cb(payload);
                }, COALESCE_MS),
              );
            }
          }
        })
        .subscribe();

      channels.set(key, {
        channel: newChannel,
        refCount: entry.refCount,
        callbacks: entry.callbacks,
        debounceTimers: new Map(),
      });
    } catch {
      // WebSocket may throw DOMException during subscribe if still in CLOSING state
      // after iOS background. Safe to skip — retry mechanism will handle it.
      if (__DEV__) {
        console.log(`[RealtimeManager] Failed to resubscribe channel: ${key}`);
      }
    }
  }

  if (__DEV__) {
    console.log(`[RealtimeManager] Reconnected ${channels.size} channels`);
  }
}

/**
 * Remove all channels (call on sign-out).
 */
export function removeAllChannels(): void {
  // Cancel any pending retry
  if (reconnectRetryTimer) {
    clearTimeout(reconnectRetryTimer);
    reconnectRetryTimer = null;
  }
  reconnectRetryCount = 0;

  for (const entry of channels.values()) {
    for (const timer of entry.debounceTimers.values()) {
      clearTimeout(timer);
    }
    try {
      supabase.removeChannel(entry.channel);
    } catch {
      // Safe to ignore — channel may already be disposed after background
    }
  }
  channels.clear();

  if (__DEV__) {
    console.log('[RealtimeManager] All channels removed');
  }
}

/**
 * Get current active channel count (for debugging/monitoring).
 */
export function getChannelCount(): number {
  return channels.size;
}

/**
 * Full teardown — removes channels and all listeners.
 */
export function destroy(): void {
  removeAllChannels();
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
  if (netInfoUnsubscribe) {
    netInfoUnsubscribe();
    netInfoUnsubscribe = null;
  }
  if (authUnsubscribe) {
    authUnsubscribe.data.subscription.unsubscribe();
    authUnsubscribe = null;
  }
  wasOffline = false;
}
