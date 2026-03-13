/**
 * React Query Provider
 *
 * Configures the QueryClient with appropriate settings for mobile app.
 * Wires AppState → focusManager and NetInfo → onlineManager at module level
 * so refetchOnWindowFocus and offline-aware queries work on React Native.
 */

import React from 'react';
import {
  QueryClient,
  QueryClientProvider,
  MutationCache,
  QueryCache,
  focusManager,
  onlineManager,
} from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { reportFatalError } from '@/src/services/errorReporting';
import { addBreadcrumb } from '@/src/config/sentry';

// ==============================================
// MODULE-LEVEL: AppState → focusManager
// ==============================================
// React Native has no window focus events — bridge AppState instead.
// This replaces per-hook useAppStateFocusManager() calls.

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (status) => {
    if (status === 'active') {
      // Brief delay for native views to stabilize before triggering refetches.
      // WebSocket reconnection is non-blocking and React Query refetches run in parallel.
      setTimeout(() => focusManager.setFocused(true), 500);
    } else {
      focusManager.setFocused(false);
    }
  });
}

// ==============================================
// MODULE-LEVEL: NetInfo → onlineManager
// ==============================================
// Pauses queries when offline, auto-refetches when back online.

onlineManager.setEventListener((setOnline) => {
  const unsubscribe = NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected);
  });
  return unsubscribe;
});

// ==============================================
// CACHES
// ==============================================

const mutationCache = new MutationCache({
  onError: (error, _variables, _context, mutation) => {
    if (mutation.meta?.suppressGlobalError) return;

    // Extract a meaningful error message from various error shapes.
    // Mutations often throw plain objects like { code: 'X', message: 'Y' }
    // — String(obj) gives '[object Object]' which is useless for matching.
    const errorMsg =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : error && typeof error === 'object' && 'message' in error
            ? String((error as { message: unknown }).message)
            : String(error);

    const errorCode =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code: unknown }).code)
        : '';

    // Don't fire global error for known expected-error patterns
    // that should be handled inline by the UI (e.g. invalid invite code, auth errors)
    const EXPECTED_PATTERNS = [
      'invite code', 'referral code', 'INVALID_CODE', 'INVALID_INVITE_CODE',
      'INVALID_REFERRAL', 'ALREADY_APPLIED', 'ALREADY_CLAIMED',
      // Auth errors — handled inline by upload.tsx and other screens
      'NOT_AUTHENTICATED', 'not authenticated', 'unauthorized',
      'Please sign in', 'session expired', 'AUTH_ERROR',
    ];
    const combined = `${errorCode} ${errorMsg}`.toLowerCase();
    if (EXPECTED_PATTERNS.some((p) => combined.includes(p.toLowerCase()))) {
      return;
    }

    reportFatalError({
      source: 'mutation_error',
      title: 'Something went wrong',
      message: 'An operation failed unexpectedly.',
      technicalMessage: errorMsg,
      originalError: error,
    });
  },
});

const queryCache = new QueryCache({
  onError: (error, query) => {
    addBreadcrumb(`Query error: ${String(query.queryKey)}`, 'query', {
      error: error instanceof Error ? error.message : String(error),
      queryKey: String(query.queryKey),
    });
  },
});

// Create a client with mobile-optimized settings
// In __DEV__: always-fresh cache, fail-fast retries for rapid iteration
const queryClient = new QueryClient({
  queryCache,
  mutationCache,
  defaultOptions: {
    queries: {
      staleTime: __DEV__ ? 0 : 1000 * 60 * 5,          // Always fresh in dev
      gcTime: __DEV__ ? 0 : 1000 * 60 * 30,             // No cache in dev
      retry: __DEV__ ? 0 : 2,                           // Fail-fast in dev
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      refetchOnWindowFocus: true,                        // Now works via focusManager
      refetchOnReconnect: !__DEV__,
    },
    mutations: {
      retry: __DEV__ ? 0 : 1,
    },
  },
});

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

export { queryClient };
