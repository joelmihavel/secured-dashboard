/**
 * Network Status Hook (ST-105)
 *
 * Provides real-time network connectivity detection using React Native's
 * built-in NetInfo-compatible approach via expo. Queues failed mutations
 * for automatic retry when connectivity is restored.
 *
 * Usage:
 *   const { isConnected, isInternetReachable, networkType } = useNetworkStatus();
 *
 *   // Queue a mutation for retry
 *   queueMutation('update-profile', async () => updateProfile({ fullName: 'John' }));
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
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
// CONNECTIVITY CHECK
// ==============================================

let lastKnownStatus: NetworkStatus = {
  isConnected: true,
  isInternetReachable: true,
  networkType: 'unknown',
};

/**
 * Probe connectivity by fetching a small resource.
 * Uses a lightweight endpoint that returns quickly.
 */
async function checkConnectivity(): Promise<NetworkStatus> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // Use a lightweight connectivity check
    const response = await fetch('https://clients3.google.com/generate_204', {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return {
      isConnected: true,
      isInternetReachable: response.status === 204 || response.ok,
      networkType: 'unknown', // Will be refined below
    };
  } catch {
    return {
      isConnected: false,
      isInternetReachable: false,
      networkType: 'none',
    };
  }
}

// ==============================================
// HOOK
// ==============================================

/**
 * Hook to monitor network connectivity status.
 *
 * Polls connectivity on app foreground and periodically.
 * Processes queued mutations when connectivity is restored.
 *
 * @param pollIntervalMs - How often to check connectivity (default: 15s)
 * @returns Current network status
 */
export function useNetworkStatus(pollIntervalMs = 15_000): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(lastKnownStatus);
  const previouslyConnected = useRef(lastKnownStatus.isConnected);

  const updateStatus = useCallback(async () => {
    const newStatus = await checkConnectivity();
    lastKnownStatus = newStatus;
    setStatus(newStatus);

    // If we just came back online, process the queue
    if (newStatus.isConnected && !previouslyConnected.current) {
      addBreadcrumb('Network restored, processing queue', 'network', {
        queueLength: mutationQueue.length,
      });
      processQueue();
    }

    previouslyConnected.current = newStatus.isConnected;
  }, []);

  // Check on mount
  useEffect(() => {
    updateStatus();
  }, [updateStatus]);

  // Check when app comes to foreground
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        updateStatus();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, [updateStatus]);

  // Periodic polling
  useEffect(() => {
    const interval = setInterval(updateStatus, pollIntervalMs);
    return () => clearInterval(interval);
  }, [updateStatus, pollIntervalMs]);

  return status;
}

/**
 * Get the last known network status synchronously (no hook).
 * Useful for service-layer checks.
 */
export function getNetworkStatus(): NetworkStatus {
  return lastKnownStatus;
}
