/**
 * env-server.ts — server-only env config for admin-app.
 *
 * RULE: This module MUST only be imported by server-side code:
 *   - Route handlers under admin-app/src/app/api/**
 *   - Server Components (top-level page.tsx files NOT marked "use client")
 *   - Server Actions
 *
 * Importing this from any "use client" boundary will fail at build time —
 * Next.js refuses to bundle env vars without NEXT_PUBLIC_ prefix into
 * client JavaScript. That refusal is the whole point: it's the language-
 * level guarantee that the service-role keys never reach a browser.
 *
 * If you need a Supabase client in a browser component, use
 * admin-app/src/lib/supabase.ts (anon-only). For privileged DB reads
 * or edge function calls from the browser, hit the API route handler
 * at /api/admin/[op] which lives on the server side and uses this module.
 *
 * Phase A — service-role removal — landed 2026-04-26.
 */

import type { Environment } from "./env";

interface SupabaseServerEnvConfig {
  url: string;
  /**
   * Service-role key. SERVER-ONLY. Never exposed to browser.
   * Bypasses RLS. Treat as the most sensitive secret in the project.
   */
  serviceKey: string;
}

/**
 * Server-side env resolution. Per-env names preferred; fallback to single-
 * project shared name (SUPABASE_SERVICE_ROLE_KEY → main) so existing
 * .env.local files don't need to be reshaped to enable the switcher.
 */
const SERVER_ENVIRONMENTS: Record<Environment, SupabaseServerEnvConfig> = {
  dev: {
    url: process.env.SUPABASE_DEV_URL ?? "https://zqlowjveyqiagnbmfwsb.supabase.co",
    serviceKey: process.env.SUPABASE_DEV_SERVICE_ROLE_KEY ?? "",
  },
  main: {
    url: process.env.SUPABASE_URL ?? "https://uowjtrzmszuaiokqxgir.supabase.co",
    serviceKey:
      process.env.SUPABASE_MAIN_SERVICE_ROLE_KEY ??
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      "",
  },
} as const;

/** Returns the server-side Supabase config for the given environment. */
export function getServerEnvConfig(env: Environment): SupabaseServerEnvConfig {
  const config = SERVER_ENVIRONMENTS[env];
  if (!config.serviceKey) {
    throw new Error(
      `[env-server] SUPABASE_${env === "main" ? "" : "DEV_"}SERVICE_ROLE_KEY is not set. ` +
        `Cannot create server-side Supabase client for environment "${env}".`,
    );
  }
  return config;
}
