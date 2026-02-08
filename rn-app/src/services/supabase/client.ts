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

/**
 * Make an authenticated call to a Supabase edge function
 */
export async function callEdgeFunction<T = unknown>(
  functionName: string,
  body: object,
  requireAuth = false
): Promise<{ data: T | null; error: string | null }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-request-id': `rn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    };

    // Add auth token if required and available
    if (requireAuth) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return { data: null, error: 'Not authenticated' };
      }
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const response = await fetch(`${getFunctionsUrl()}/${functionName}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        data: null,
        error: data.error?.message ?? data.message ?? `HTTP ${response.status}`,
      };
    }

    return { data: data as T, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

export type { Session, User } from '@supabase/supabase-js';
