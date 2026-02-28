/**
 * React Query Provider
 *
 * Configures the QueryClient with appropriate settings for mobile app.
 */

import React from 'react';
import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from '@tanstack/react-query';
import { reportFatalError } from '@/src/services/errorReporting';
import { addBreadcrumb } from '@/src/config/sentry';

const mutationCache = new MutationCache({
  onError: (error, _variables, _context, mutation) => {
    if (mutation.meta?.suppressGlobalError) return;
    reportFatalError({
      source: 'mutation_error',
      title: 'Something went wrong',
      message: 'An operation failed unexpectedly.',
      technicalMessage: error instanceof Error ? error.message : String(error),
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
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
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
