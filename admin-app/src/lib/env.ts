/**
 * env.ts — single source of truth for environment configuration in admin-app.
 *
 * Reads every NEXT_PUBLIC_* + server-side env var ONCE at module load.
 * Exports a typed config object plus a per-environment lookup for the
 * dev/main switcher this admin app uses.
 *
 * RULE: every other file in admin-app/src/ + admin-app/app/ MUST import
 * from here. Do NOT call process.env.X anywhere else. Enforced by
 * scripts/check-env-isolation.sh in CI.
 *
 * SECURITY NOTE (Phase A follow-up):
 *   The env vars `NEXT_PUBLIC_SUPABASE_*_SERVICE_KEY` ship the
 *   Supabase service-role keys to the BROWSER bundle. This is a known
 *   issue called out in the implementation plan as Phase A: any admin
 *   user with DevTools (or a transitive npm-dep XSS) can extract the
 *   service-role key and use it to bypass RLS on the prod fintech DB.
 *
 *   Phase A (TBD) will:
 *     1. Move every DB read to a Next route handler (admin-app/src/app/api/admin/...)
 *     2. Drop the NEXT_PUBLIC_ prefix from service-key env vars
 *     3. Create admin-app/src/lib/supabase-server.ts that holds the
 *        server-only service-role client
 *     4. Rotate the service-role key (it's been browser-exposed for
 *        the admin app's lifetime — treat as compromised)
 *
 *   Until Phase A ships, this module continues to expose the keys
 *   the same way the existing supabase.ts does. We're not making
 *   the situation worse, but we're flagging it loudly here.
 */

export type Environment = "dev" | "main";

interface SupabaseEnvConfig {
  url: string;
  anonKey: string;
  /** Service-role key. WARNING: currently shipped to browser via NEXT_PUBLIC_ prefix. See Phase A. */
  serviceKey: string;
}

/** The two Supabase projects the admin app can target (switchable at runtime). */
const ENVIRONMENTS: Record<Environment, SupabaseEnvConfig> = {
  dev: {
    url: "https://zqlowjveyqiagnbmfwsb.supabase.co",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_DEV_ANON_KEY ?? "",
    serviceKey: process.env.NEXT_PUBLIC_SUPABASE_DEV_SERVICE_KEY ?? "",
  },
  main: {
    url: "https://uowjtrzmszuaiokqxgir.supabase.co",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_MAIN_ANON_KEY ?? "",
    serviceKey: process.env.NEXT_PUBLIC_SUPABASE_MAIN_SERVICE_KEY ?? "",
  },
} as const;

/** Returns the Supabase config for the given environment. */
export function getEnvConfig(env: Environment): SupabaseEnvConfig {
  return ENVIRONMENTS[env];
}

/**
 * Admin-app's own auth key (separate from Supabase's service-role —
 * gates write actions in admin edge functions like admin-waitlist).
 */
export const adminApiKey: string = process.env.NEXT_PUBLIC_ADMIN_KEY ?? "";
