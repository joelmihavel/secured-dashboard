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
 * Custom storage adapter using expo-secure-store with atomic chunking.
 *
 * Expo Go limits SecureStore values to 2048 bytes. Supabase sessions
 * (JWT + refresh token + user metadata) easily exceed this. This adapter
 * splits large values across numbered chunks and reassembles on read.
 *
 * ATOMICITY: Uses a generation-based write strategy to prevent corruption
 * if the app is killed mid-write. New data is written to generation N+1 keys,
 * then a single pointer key (`_gen`) is flipped. If the app crashes before
 * the flip, the old generation remains valid. Old generation is cleaned up
 * lazily on the next write.
 */
const CHUNK_SIZE = 1800; // leave headroom below the 2048-byte limit

/** Supabase SDK session storage key. Must match SDK's internal STORAGE_KEY.
 *  Exported for use by resetAll.ts and installDetection.ts to avoid hardcoding. */
export const SUPABASE_SESSION_STORAGE_KEY = 'supabase.auth.token';

/** Read the active generation number (0 if none set) */
async function readGen(key: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(`${key}_gen`).catch(() => null);
  return raw ? parseInt(raw, 10) : 0;
}

/** Read chunks for a specific generation */
async function readChunksForGen(key: string, gen: number): Promise<string | null> {
  const prefix = gen === 0 ? key : `${key}_g${gen}`;
  const first = await SecureStore.getItemAsync(prefix);
  if (first === null) return null;

  const countRaw = await SecureStore.getItemAsync(`${prefix}_chunks`);
  if (!countRaw) return first; // single-chunk value

  const count = parseInt(countRaw, 10);
  const parts: string[] = [first];
  for (let i = 1; i < count; i++) {
    const chunk = await SecureStore.getItemAsync(`${prefix}_${i}`);
    if (chunk === null) return null; // corrupted chunk — treat as missing
    parts.push(chunk);
  }
  return parts.join('');
}

/** Delete all chunks for a specific generation */
async function deleteGen(key: string, gen: number): Promise<void> {
  const prefix = gen === 0 ? key : `${key}_g${gen}`;
  const countRaw = await SecureStore.getItemAsync(`${prefix}_chunks`).catch(() => null);
  if (countRaw) {
    const n = parseInt(countRaw, 10);
    for (let i = 1; i < n; i++) {
      await SecureStore.deleteItemAsync(`${prefix}_${i}`).catch(() => {});
    }
    await SecureStore.deleteItemAsync(`${prefix}_chunks`).catch(() => {});
  }
  await SecureStore.deleteItemAsync(prefix).catch(() => {});
}

const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const gen = await readGen(key);

      // Try current generation first
      if (gen > 0) {
        const value = await readChunksForGen(key, gen);
        if (value !== null) return value;
      }

      // Fall back to gen 0 (legacy or first write before gen system)
      return await readChunksForGen(key, 0);
    } catch {
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      const currentGen = await readGen(key);
      const newGen = currentGen + 1;
      const prefix = `${key}_g${newGen}`;

      // 1. Write new generation chunks (no existing data at this prefix)
      if (value.length <= CHUNK_SIZE) {
        await SecureStore.setItemAsync(prefix, value);
      } else {
        const chunks: string[] = [];
        for (let i = 0; i < value.length; i += CHUNK_SIZE) {
          chunks.push(value.slice(i, i + CHUNK_SIZE));
        }
        await SecureStore.setItemAsync(prefix, chunks[0]);
        for (let i = 1; i < chunks.length; i++) {
          await SecureStore.setItemAsync(`${prefix}_${i}`, chunks[i]);
        }
        await SecureStore.setItemAsync(`${prefix}_chunks`, String(chunks.length));
      }

      // 2. ATOMIC POINTER SWAP — this single write commits the new generation.
      //    If the app crashes before this line, the old generation is still active.
      //    If it crashes after, the new generation is active and old is stale.
      await SecureStore.setItemAsync(`${key}_gen`, String(newGen));

      // 3. Lazy cleanup: delete old generation (non-fatal if app crashes here)
      if (currentGen > 0) {
        deleteGen(key, currentGen).catch(() => {});
      }
      // Also clean up gen 0 (legacy data from before gen system)
      if (currentGen === 0) {
        deleteGen(key, 0).catch(() => {});
      }
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
      const gen = await readGen(key);
      // Delete current generation
      if (gen > 0) await deleteGen(key, gen);
      // Delete legacy gen 0
      await deleteGen(key, 0);
      // Delete the gen pointer itself
      await SecureStore.deleteItemAsync(`${key}_gen`).catch(() => {});
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
      const oldToken = headers['Authorization'];
      // Give the SDK's auto-refresh a moment to complete (it fires on token expiry)
      await new Promise(resolve => setTimeout(resolve, 1500));
      const { data: { session: retrySession } } = await getSessionSafe();
      // Only retry if we got a DIFFERENT token (refresh actually succeeded).
      // Retrying with the same expired token wastes a round-trip.
      if (retrySession?.access_token && `Bearer ${retrySession.access_token}` !== oldToken) {
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
