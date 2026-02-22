/**
 * Supabase Client Configuration
 *
 * Provides configured Supabase client for React Native app.
 * Uses expo-secure-store for encrypted session persistence.
 */

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// Environment configuration - fail fast if not set
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL is not set. ' +
    'Please add it to your .env file. See .env.example for reference.'
  );
}

if (!SUPABASE_ANON_KEY) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_ANON_KEY is not set. ' +
    'Please add it to your .env file. See .env.example for reference.'
  );
}

/**
 * Custom storage adapter using expo-secure-store
 * Provides encrypted persistence for auth tokens
 */
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      console.error('SecureStore setItem failed:', key);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      console.error('SecureStore removeItem failed:', key);
    }
  },
};

/**
 * Configured Supabase client for the mobile app
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'x-client-info': 'flent-secured-rn',
    },
  },
});

/**
 * Get the Supabase functions URL for edge function calls
 */
export const getFunctionsUrl = () => {
  return `${SUPABASE_URL}/functions/v1`;
};

/** Default timeout for edge function calls (15 seconds) */
const EDGE_FUNCTION_TIMEOUT_MS = 15_000;

/**
 * Make an authenticated call to a Supabase edge function
 *
 * @param functionName - Edge function name (e.g., 'get-waitlist-status')
 * @param body - Request body (POST) or query params object (GET)
 * @param requireAuth - Whether to include auth token
 * @param method - HTTP method (defaults to 'POST')
 * @param timeoutMs - Request timeout in milliseconds (defaults to 15s)
 */
export async function callEdgeFunction<T = unknown>(
  functionName: string,
  body: Record<string, unknown> | object = {},
  requireAuth = false,
  method: 'GET' | 'POST' = 'POST',
  timeoutMs: number = EDGE_FUNCTION_TIMEOUT_MS
): Promise<{ data: T | null; error: string | null; errorBody?: Record<string, unknown> }> {
  // AbortController for timeout enforcement
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY!,
      'x-request-id': `rn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    };

    // Add auth token if required and available
    if (requireAuth) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return { data: null, error: 'Not authenticated' };
      }

      // Check if token is expired or about to expire (within 60s buffer)
      const expiresAt = session.expires_at; // Unix timestamp in seconds
      const now = Math.floor(Date.now() / 1000);
      if (expiresAt && expiresAt - now < 60) {
        const { data: { session: refreshed }, error: refreshErr } =
          await supabase.auth.refreshSession();
        if (refreshErr || !refreshed?.access_token) {
          return { data: null, error: 'Not authenticated' };
        }
        headers['Authorization'] = `Bearer ${refreshed.access_token}`;
      } else {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: controller.signal,
    };

    // Build URL -- for GET, append query params; for POST, set JSON body
    let url = `${getFunctionsUrl()}/${functionName}`;

    if (method === 'GET') {
      // Convert body object to query parameters (skip null/undefined values)
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(body)) {
        if (value != null && value !== '') {
          params.append(key, String(value));
        }
      }
      const qs = params.toString();
      if (qs) {
        url += `?${qs}`;
      }
    } else {
      fetchOptions.body = JSON.stringify(body);
    }

    let response = await fetch(url, fetchOptions);
    let data = await response.json();

    // Retry once on 401 with a refreshed token (handles stale JWT edge cases)
    if (response.status === 401 && requireAuth) {
      const { data: { session: retrySession }, error: retryErr } =
        await supabase.auth.refreshSession();
      if (!retryErr && retrySession?.access_token) {
        headers['Authorization'] = `Bearer ${retrySession.access_token}`;
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), timeoutMs);
        try {
          response = await fetch(url, { ...fetchOptions, signal: retryController.signal });
          data = await response.json();
        } finally {
          clearTimeout(retryTimeoutId);
        }
      }
    }

    if (!response.ok) {
      // Parse error from backend structured error responses
      // Backend may return: { error: true, message: "...", code: "...", fields?: Record<string, string> }
      const errorMessage = data.message ?? data.error?.message ?? `HTTP ${response.status}`;
      return {
        data: null,
        error: errorMessage,
        errorBody: data as Record<string, unknown> | undefined,
      };
    }

    return { data: data as T, error: null };
  } catch (error) {
    // Distinguish abort/timeout from other network errors
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        data: null,
        error: `Request timed out after ${Math.round(timeoutMs / 1000)}s`,
      };
    }
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Network error',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export type { Session, User } from '@supabase/supabase-js';
