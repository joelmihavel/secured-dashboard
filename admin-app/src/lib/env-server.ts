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

/**
 * Admin-waitlist edge function shared key. Server-only — must NEVER carry a
 * NEXT_PUBLIC_ prefix. Server proxy at /api/admin injects this into edge fn
 * call bodies; the browser never sees it.
 *
 * Value must equal the `ADMIN_API_KEY` env var on the prod admin-waitlist
 * edge function — mismatch = every approve returns 401.
 */
export function getAdminKey(): string {
  const key = process.env.ADMIN_KEY;
  if (!key) {
    throw new Error(
      "[env-server] ADMIN_KEY is not set. Cannot call admin-waitlist edge fn. " +
        "Set ADMIN_KEY in Vercel project env vars (matches the edge fn's ADMIN_API_KEY).",
    );
  }
  return key;
}

/**
 * Comma-separated list of email addresses allowed to access the admin panel.
 * Used by middleware + /api/admin to gate every request. Adding an admin =
 * update this env var on Vercel + redeploy.
 *
 * Returns [] if unset — caller should treat that as "no one allowed in".
 * Middleware logs a warning once instead of throwing so /login stays
 * reachable; without ADMIN_EMAILS the server simply rejects every request.
 */
export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

let warnedMissingAdminEmails = false;
function warnIfMissing() {
  if (warnedMissingAdminEmails) return;
  if (!process.env.ADMIN_EMAILS) {
    warnedMissingAdminEmails = true;
    console.warn(
      "[env-server] ADMIN_EMAILS is not set. Every admin request will be denied. " +
        "Set ADMIN_EMAILS=admin1@example.com,admin2@example.com in env.",
    );
  }
}

/** True when the email is on the admin allow-list. Case-insensitive. */
export function isAdminEmail(email: string | null | undefined): boolean {
  warnIfMissing();
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}
