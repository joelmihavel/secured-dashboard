/**
 * Supabase client factory for Cloud Run extraction service.
 * Uses service role key for full database access.
 *
 * Ported from: Deno createClient() calls in process-document/index.ts
 * Change: Uses npm @supabase/supabase-js instead of Deno npm: specifier.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';

let _serviceClient: SupabaseClient | null = null;

/**
 * Create a Supabase client with service role key.
 * Caches the client instance for reuse across requests.
 */
export function createServiceClient(): SupabaseClient {
  if (_serviceClient) return _serviceClient;

  _serviceClient = createClient(config.supabase.url, config.supabase.serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _serviceClient;
}

/**
 * Get the Supabase URL.
 */
export function getSupabaseUrl(): string {
  return config.supabase.url;
}

/**
 * Get the service role key.
 */
export function getServiceKey(): string {
  return config.supabase.serviceKey;
}
