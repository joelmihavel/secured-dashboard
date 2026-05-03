/**
 * env.ts — single source of truth for browser-safe env vars in admin-app.
 *
 * Reads NEXT_PUBLIC_* env vars ONCE at module load. Exports a typed config
 * plus a per-environment lookup for the dev/main switcher.
 *
 * RULE: every other file in admin-app/src/ + admin-app/app/ MUST import
 * from here. Do NOT call process.env.X anywhere else. Enforced by
 * scripts/check-env-isolation.sh in CI.
 *
 * Phase A (2026-04-26): service-role keys were removed from this module.
 * Browser-side code can no longer obtain a service-role Supabase client.
 * Privileged operations (DB reads bypassing RLS, admin edge fn calls)
 * route through /api/admin which lives on the server side and uses
 * env-server.ts + supabase-server.ts.
 */

export type Environment = "dev" | "main";

interface SupabaseEnvConfig {
  url: string;
  anonKey: string;
}

/**
 * The two Supabase projects the admin app can target (switchable at runtime).
 *
 * Anon-key resolution: per-env names (NEXT_PUBLIC_SUPABASE_DEV_ANON_KEY /
 * NEXT_PUBLIC_SUPABASE_MAIN_ANON_KEY) take precedence. If absent, falls back
 * to the shared NEXT_PUBLIC_SUPABASE_ANON_KEY (treated as the main project's
 * key — matches the legacy single-env .env.local pattern). When deploying
 * to Vercel with the dev/main switcher actually pointing at different
 * projects, set the per-env names.
 */
const ENVIRONMENTS: Record<Environment, SupabaseEnvConfig> = {
  dev: {
    url: "https://zqlowjveyqiagnbmfwsb.supabase.co",
    anonKey:
      process.env.NEXT_PUBLIC_SUPABASE_DEV_ANON_KEY ??
      "",
  },
  main: {
    url: "https://uowjtrzmszuaiokqxgir.supabase.co",
    anonKey:
      process.env.NEXT_PUBLIC_SUPABASE_MAIN_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      "",
  },
} as const;

/** Returns the Supabase config for the given environment. Anon-key only. */
export function getEnvConfig(env: Environment): SupabaseEnvConfig {
  return ENVIRONMENTS[env];
}

// adminApiKey removed (Phase B, 2026-05-01) — admin_key now injected
// server-side by /api/admin/route.ts using the server-only ADMIN_KEY env.
