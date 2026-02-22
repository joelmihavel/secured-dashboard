/**
 * Network Status Hook (ST-105)
 *
 * Provides real-time network connectivity detection using @react-native-community/netinfo.
 * Instant OS-level network events replace the old 15s polling approach.
 * Queues failed mutations for automatic retry when connectivity is restored.
 *
 * Usage:
 *   const { isConnected, isInternetReachable, networkType } = useNetworkStatus();
 *
 *   // Queue a mutation for retry
 *   queueMutation('update-profile', async () => updateProfile({ fullName: 'John' }));
 */

import { useState, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { addBreadcrumb } from '../config/sentry';

// ==============================================
// TYPES
// ==============================================

export interface NetworkStatus {
  /** Whether the device has any network connection */
  isConnected: boolean;
  /** Whether the internet is actually reachable (may be connected to WiFi without internet) */
  isInternetReachable: boolean;
  /** Network type: wifi, cellular, none, unknown */
  networkType: 'wifi' | 'cellular' | 'none' | 'unknown';
}

export interface QueuedMutation {
  id: string;
  label: string;
  execute: () => Promise<unknown>;
  timestamp: number;
  retryCount: number;
}

// ==============================================
// MUTATION QUEUE (module-level singleton)
// ==============================================

const MAX_RETRIES = 3;
const QUEUE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

let mutationQueue: QueuedMutation[] = [];
let isProcessingQueue = false;

/**
 * Queue a mutation for retry when connectivity is restored.
 * If online, executes immediately.
 */
export function queueMutation(
  label: string,
  execute: () => Promise<unknown>,
  executeImmediatelyIfOnline = true
): void {
  const mutation: QueuedMutation = {
    id: `${label}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    label,
    execute,
    timestamp: Date.now(),
    retryCount: 0,
  };

  if (executeImmediatelyIfOnline && lastKnownStatus.isConnected) {
    // Try immediately
    execute().catch(() => {
      mutationQueue.push(mutation);
      addBreadcrumb('Mutation queued after immediate failure', 'network', { label });
    });
    return;
  }

  mutationQueue.push(mutation);
  addBreadcrumb('Mutation queued (offline)', 'network', { label });
}

/**
 * Process all queued mutations sequentially.
 */
async function processQueue(): Promise<void> {
  if (isProcessingQueue || mutationQueue.length === 0) return;

  isProcessingQueue = true;
  const now = Date.now();

  // Remove expired mutations
  mutationQueue = mutationQueue.filter((m) => now - m.timestamp < QUEUE_EXPIRY_MS);

  const toProcess = [...mutationQueue];
  mutationQueue = [];

  for (const mutation of toProcess) {
    try {
      await mutation.execute();
      addBreadcrumb('Queued mutation succeeded', 'network', { label: mutation.label });
    } catch {
      mutation.retryCount += 1;
      if (mutation.retryCount < MAX_RETRIES) {
        mutationQueue.push(mutation);
        addBreadcrumb('Queued mutation failed, will retry', 'network', {
          label: mutation.label,
          retryCount: mutation.retryCount,
        });
      } else {
        addBreadcrumb('Queued mutation permanently failed', 'network', {
          label: mutation.label,
          retryCount: mutation.retryCount,
        });
      }
    }
  }

  isProcessingQueue = false;
}

/**
 * Get the current queue length.
 */
export function getQueueLength(): number {
  return mutationQueue.length;
}

/**
 * Clear the mutation queue.
 */
export function clearMutationQueue(): void {
  mutationQueue = [];
}

// ==============================================
// NETINFO MAPPING
// ==============================================

let lastKnownStatus: NetworkStatus = {
  isConnected: true,
  isInternetReachable: true,
  networkType: 'unknown',
};

/**
 * Map NetInfo state to our NetworkStatus interface.
 */
function mapNetInfoState(state: NetInfoState): NetworkStatus {
  return {
    isConnected: state.isConnected ?? false,
    isInternetReachable: state.isInternetReachable ?? false,
    networkType:
      state.type === 'wifi'
        ? 'wifi'
        : state.type === 'cellular'
          ? 'cellular'
          : state.isConnected
            ? 'unknown'
            : 'none',
  };
}

// ==============================================
// HOOK
// ==============================================

/**
 * Hook to monitor network connectivity status.
 *
 * Uses @react-native-community/netinfo for instant OS-level network events
 * instead of polling. Processes queued mutations when connectivity is restored.
 *
 * @returns Current network status
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(lastKnownStatus);
  const previouslyConnected = useRef(lastKnownStatus.isConnected);

  // Subscribe to OS-level network changes (instant, no polling)
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const newStatus = mapNetInfoState(state);
      lastKnownStatus = newStatus;
      setStatus(newStatus);

      // Process mutation queue when coming back online
      if (newStatus.isConnected && !previouslyConnected.current) {
        addBreadcrumb('Network restored (NetInfo event)', 'network', {
          queueLength: mutationQueue.length,
          type: state.type,
        });
        processQueue();
      }
      previouslyConnected.current = newStatus.isConnected;
    });

    return unsubscribe;
  }, []);

  // Belt-and-suspenders: also check on foreground resume
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        NetInfo.fetch().then((state) => {
          const newStatus = mapNetInfoState(state);
          lastKnownStatus = newStatus;
          setStatus(newStatus);
        });
      }
    });
    return () => sub.remove();
  }, []);

  return status;
}

/**
 * Get the last known network status synchronously (no hook).
 * Useful for service-layer checks.
 */
export function getNetworkStatus(): NetworkStatus {
  return lastKnownStatus;
}
