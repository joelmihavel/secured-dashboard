/**
 * Realtime Manager — Centralized Supabase Channel Singleton
 *
 * Module-level singleton (not React context) that manages all Supabase
 * realtime subscriptions with:
 * - Reference counting: multiple hooks subscribing to the same table/filter share one channel
 * - Coalescing: 100ms debounce prevents thundering herd from rapid DB events
 * - iOS background recovery: AppState listener reconnects all channels after 5+ seconds in background
 * - Logout cleanup: removeAllChannels() tears down everything on sign-out
 */

import { AppState, AppStateStatus } from 'react-native';
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

let channels: Map<string, ChannelEntry> = new Map();
let backgroundTimestamp: number | null = null;
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

function getChannelKey(table: string, filter?: string): string {
  return filter ? `${table}:${filter}` : table;
}

function handleAppStateChange(nextState: AppStateStatus) {
  if (nextState === 'background' || nextState === 'inactive') {
    backgroundTimestamp = Date.now();
  } else if (nextState === 'active' && backgroundTimestamp) {
    const elapsed = Date.now() - backgroundTimestamp;
    backgroundTimestamp = null;
    if (elapsed >= BACKGROUND_RECONNECT_THRESHOLD_MS) {
      reconnectAll();
    }
  }
}

function ensureAppStateListener() {
  if (!appStateSubscription) {
    appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
  }
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
  ensureAppStateListener();

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

        // Coalesced dispatch — debounce per callback to prevent thundering herd
        for (const [cbId, cbSet] of currentEntry.callbacks) {
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
    supabase.removeChannel(entry.channel);
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
  }

  if (__DEV__) {
    console.log(`[RealtimeManager] Reconnected ${channels.size} channels`);
  }
}

/**
 * Remove all channels (call on sign-out).
 */
export function removeAllChannels(): void {
  for (const entry of channels.values()) {
    for (const timer of entry.debounceTimers.values()) {
      clearTimeout(timer);
    }
    supabase.removeChannel(entry.channel);
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
 * Full teardown — removes channels and AppState listener.
 */
export function destroy(): void {
  removeAllChannels();
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
}
