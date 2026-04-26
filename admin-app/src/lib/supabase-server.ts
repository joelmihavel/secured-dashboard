/**
 * supabase-server.ts — server-only Supabase client factory for admin-app.
 *
 * RULE: This module MUST only be imported by server-side code (route
 * handlers, Server Components, Server Actions). Importing from a
 * "use client" boundary will fail at build because env-server.ts
 * (transitively imported here) has no NEXT_PUBLIC_ prefix on its
 * service-role env var reads — Next.js refuses to bundle them into
 * client JavaScript.
 *
 * Used by /api/admin/[op] route handler (and any future server-side
 * code path that needs to bypass RLS for admin operations).
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getServerEnvConfig } from "./env-server";
import type { Environment } from "./env";

/**
 * Cache of per-environment service-role clients. Created lazily on first
 * use; safe to keep as module-level state because route handlers run
 * server-side and the clients are stateless beyond their auth header.
 */
const clientCache: Partial<Record<Environment, SupabaseClient>> = {};

/**
 * Returns a service-role-bearing Supabase client for the given environment.
 * NEVER call this from client code.
 */
export function getServerSupabaseClient(env: Environment): SupabaseClient {
  if (!clientCache[env]) {
    const config = getServerEnvConfig(env);
    clientCache[env] = createClient(config.url, config.serviceKey, {
      auth: {
        // Server clients don't have a session; disable session persistence.
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return clientCache[env]!;
}
