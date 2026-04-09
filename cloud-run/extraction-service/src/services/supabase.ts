/**
 * Supabase client factory for Cloud Run extraction service.
 * Uses service role key for full database access.
 *
 * Ported from: Deno createClient() calls in process-document/index.ts
 * Change: Uses npm @supabase/supabase-js instead of Deno npm: specifier.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _serviceClient: SupabaseClient | null = null;

/**
 * Create a Supabase client with service role key.
 * Caches the client instance for reuse across requests.
 */
export function createServiceClient(): SupabaseClient {
  if (_serviceClient) return _serviceClient;

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL environment variable is not set');
  }
  if (!serviceKey) {
    throw new Error('SB_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
  }

  _serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _serviceClient;
}

/**
 * Get the Supabase URL from environment.
 */
export function getSupabaseUrl(): string {
  return process.env.SUPABASE_URL || process.env.SB_URL || '';
}

/**
 * Get the service role key from environment.
 */
export function getServiceKey(): string {
  return process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}
