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
import { addBreadcrumb } from '@/src/config/sentry';

// ==============================================
// MODULE-LEVEL: AppState → focusManager
// ==============================================
// React Native has no window focus events — bridge AppState instead.
// This replaces per-hook useAppStateFocusManager() calls.

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (status) => {
    if (status === 'active') {
      // Delay focus notification until AFTER ResumeOverlay fades (500ms show + 250ms fade).
      // This prevents React Query refetches from triggering re-renders while native views
      // are still restoring — the root cause of PropertyDOM crashes on bg→fg.
      setTimeout(() => focusManager.setFocused(true), 1500);
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
    // Mutation errors are always user-triggered operations — log a breadcrumb
    // for diagnostics but NEVER navigate to the error screen. Individual
    // mutations handle their own errors inline via onError / onSuccess callbacks.
    const errorMsg = error instanceof Error ? error.message : String(error);
    addBreadcrumb(`Mutation error`, 'mutation', {
      error: errorMsg,
      suppressedGlobal: String(!!mutation.meta?.suppressGlobalError),
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
