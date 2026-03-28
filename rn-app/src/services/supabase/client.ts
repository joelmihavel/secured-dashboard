/**
 * Supabase Client Configuration
 *
 * Provides configured Supabase client for React Native app.
 * Uses expo-secure-store for encrypted session persistence.
 */

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { addBreadcrumb } from '@/src/config/sentry';
import { interceptEdgeFunction } from '@/src/review/reviewInterceptor';

// Environment configuration - fail fast if not set
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL is not set. ' +
    'Please add it to your .env file. See .env.example for reference'
  );
}

if (!SUPABASE_ANON_KEY) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_ANON_KEY is not set. ' +
    'Please add it to your .env file. See .env.example for reference'
  );
}

/**
 * Custom storage adapter using expo-secure-store with chunking.
 *
 * Expo Go limits SecureStore values to 2048 bytes. Supabase sessions
 * (JWT + refresh token + user metadata) easily exceed this. This adapter
 * splits large values across numbered chunks and reassembles on read,
 * so sessions persist correctly in both Expo Go and development builds.
 */
const CHUNK_SIZE = 1800; // leave headroom below the 2048-byte limit

const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const first = await SecureStore.getItemAsync(key);
      if (first === null) return null;

      // Check if value was chunked
      const countRaw = await SecureStore.getItemAsync(`${key}_chunks`);
      if (!countRaw) return first; // single-chunk value

      const count = parseInt(countRaw, 10);
      const parts: string[] = [first];
      for (let i = 1; i < count; i++) {
        const chunk = await SecureStore.getItemAsync(`${key}_${i}`);
        if (chunk === null) return null; // corrupted — treat as missing
        parts.push(chunk);
      }
      return parts.join('');
    } catch {
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      // Clean up any previous chunks first
      const oldCount = await SecureStore.getItemAsync(`${key}_chunks`);
      if (oldCount) {
        const n = parseInt(oldCount, 10);
        for (let i = 1; i < n; i++) {
          await SecureStore.deleteItemAsync(`${key}_${i}`);
        }
        await SecureStore.deleteItemAsync(`${key}_chunks`);
      }

      if (value.length <= CHUNK_SIZE) {
        await SecureStore.setItemAsync(key, value);
        return;
      }

      // Split into chunks
      const chunks: string[] = [];
      for (let i = 0; i < value.length; i += CHUNK_SIZE) {
        chunks.push(value.slice(i, i + CHUNK_SIZE));
      }

      await SecureStore.setItemAsync(key, chunks[0]);
      for (let i = 1; i < chunks.length; i++) {
        await SecureStore.setItemAsync(`${key}_${i}`, chunks[i]);
      }
      await SecureStore.setItemAsync(`${key}_chunks`, String(chunks.length));
    } catch (err) {
      // MUST NOT throw — the Supabase SDK calls setItem internally during
      // session persistence. If this throws, the SDK's _saveSession breaks,
      // leaving the internal session state corrupt (SIGNED_OUT fires, PostgREST
      // calls fail with 401, dashboard shows black screen).
      console.error('SecureStore setItem failed:', key, err);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      const countRaw = await SecureStore.getItemAsync(`${key}_chunks`);
      if (countRaw) {
        const n = parseInt(countRaw, 10);
        for (let i = 1; i < n; i++) {
          await SecureStore.deleteItemAsync(`${key}_${i}`);
        }
        await SecureStore.deleteItemAsync(`${key}_chunks`);
      }
      await SecureStore.deleteItemAsync(key);
    } catch (err) {
      // MUST NOT throw — the Supabase SDK calls removeItem during signOut.
      // Throwing here breaks the signOut flow and leaves stale session data.
      console.error('SecureStore removeItem failed:', key, err);
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
  realtime: {
    heartbeatIntervalMs: 15_000,
    reconnectAfterMs: (tries: number) =>
      Math.min(1000 * Math.pow(2, tries), 30_000),
    ...(__DEV__ && {
      logger: (kind: string, msg: string, data?: unknown) =>
        console.log(`[Realtime:${kind}]`, msg, data ?? ''),
    }),
  },
});

/**
 * Deduplicating wrapper around supabase.auth.getSession().
 *
 * Multiple callers (callEdgeFunction, useSessionMonitor, AuthProvider) can
 * call getSession() concurrently. While the SDK serializes internally via
 * pendingInLock, each call still queues up and extends lock-hold time.
 * This wrapper ensures only ONE getSession() is in flight at a time --
 * concurrent callers reuse the same promise.
 */
let _getSessionInFlight: Promise<{ data: { session: any }; error: any }> | null = null;

export async function getSessionSafe() {
  if (_getSessionInFlight) return _getSessionInFlight;
  _getSessionInFlight = supabase.auth.getSession().finally(() => {
    _getSessionInFlight = null;
  });
  return _getSessionInFlight;
}

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
  timeoutMs: number = EDGE_FUNCTION_TIMEOUT_MS,
  externalSignal?: AbortSignal
): Promise<{ data: T | null; error: string | null; errorBody?: Record<string, unknown> }> {
  // Abort if caller already cancelled before we start
  if (externalSignal?.aborted) {
    return { data: null, error: 'Aborted' };
  }

  // AbortController for timeout enforcement
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Link external signal to our internal controller
  if (externalSignal) {
    const onAbort = () => controller.abort();
    externalSignal.addEventListener('abort', onAbort, { once: true });
  }
  const startTime = Date.now();

  try {
    // Review mode: intercept before any network call
    const reviewResult = interceptEdgeFunction(functionName, body);
    if (reviewResult) return reviewResult as { data: T; error: null };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY!,
      'x-request-id': `rn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      'x-region': 'ap-south-1', // Pin to Mumbai — co-locate with DB for lowest latency
    };

    // Add auth token if required and available.
    // IMPORTANT: Never call refreshSession() here — it races with the SDK's
    // built-in autoRefreshToken timer and causes refresh token rotation conflicts
    // (the old token gets invalidated, the second caller gets SIGNED_OUT).
    // Instead, trust getSession() which returns the SDK's managed session.
    // If the token is expired, the SDK will have already refreshed it (or will
    // on the next tick). If the request gets a 401, the retry block below
    // will handle it with a single controlled refresh.
    if (requireAuth) {
      const { data: { session } } = await getSessionSafe();
      if (!session?.access_token) {
        return { data: null, error: 'Not authenticated' };
      }
      headers['Authorization'] = `Bearer ${session.access_token}`;
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

    addBreadcrumb(`API call: ${method} ${functionName}`, 'api', { method, requireAuth });

    let response = await fetch(url, fetchOptions);

    // Safe JSON parse — edge functions may return non-JSON on crash/502/timeout
    const safeJson = async (res: Response): Promise<Record<string, unknown>> => {
      try {
        return await res.json();
      } catch {
        // response.json() throws DOMException/SyntaxError on non-JSON bodies
        const text = await res.text().catch(() => '');
        return { error: true, message: `Server error (HTTP ${res.status})`, _raw: text.slice(0, 200) };
      }
    };

    let data = await safeJson(response);

    // Retry once on 401: wait briefly for the SDK's auto-refresh to complete,
    // then re-read the session. This avoids calling refreshSession() manually
    // which races with the SDK's autoRefreshToken and causes SIGNED_OUT events
    // when refresh token rotation is enabled.
    if (response.status === 401 && requireAuth) {
      // Give the SDK's auto-refresh a moment to complete (it fires on token expiry)
      await new Promise(resolve => setTimeout(resolve, 1500));
      const { data: { session: retrySession } } = await getSessionSafe();
      if (retrySession?.access_token) {
        headers['Authorization'] = `Bearer ${retrySession.access_token}`;
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), timeoutMs);
        try {
          response = await fetch(url, { ...fetchOptions, signal: retryController.signal });
          data = await safeJson(response);
        } finally {
          clearTimeout(retryTimeoutId);
        }
      }
    }

    if (!response.ok) {
      // Parse error from backend structured error responses
      // Backend may return: { error: true, message: "...", code: "...", fields?: Record<string, string> }
      const errorMessage = String(data.message ?? (typeof data.error === 'string' ? data.error : (data.error as Record<string, unknown>)?.message) ?? `HTTP ${response.status}`);
      addBreadcrumb(`API error: ${functionName} ${response.status}`, 'api', {
        status: response.status,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      });
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
      addBreadcrumb(`API timeout: ${functionName}`, 'api', {
        duration_ms: Date.now() - startTime,
        timeout_ms: timeoutMs,
      });
      return {
        data: null,
        error: `Request timed out after ${Math.round(timeoutMs / 1000)}s`,
      };
    }
    const rawMessage = error instanceof Error ? error.message : 'Unknown';
    const isDomException = error instanceof DOMException;
    addBreadcrumb(`API network error: ${functionName}`, 'api', {
      error: rawMessage,
      errorName: isDomException ? (error as DOMException).name : undefined,
      duration_ms: Date.now() - startTime,
    });
    // Surface a user-friendly message instead of raw DOMException/TypeError
    const userMessage =
      rawMessage.toLowerCase().includes('network') ? 'Network error. Please check your connection' :
      rawMessage.toLowerCase().includes('abort') ? 'Request was cancelled. Please try again' :
      isDomException ? `Something went wrong. Please try again (${(error as DOMException).name})` :
      rawMessage;
    return {
      data: null,
      error: userMessage,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export type { Session, User } from '@supabase/supabase-js';
