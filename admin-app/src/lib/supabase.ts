/**
 * supabase.ts — browser-side Supabase client + server-proxy helpers.
 *
 * Phase A (2026-04-26): Privileged DB reads + admin edge function calls
 *   route through /api/admin (server-side proxy). This module only ever
 *   uses anon keys, safe to ship to the browser.
 *
 * Phase B (2026-05-01): Migrated to @supabase/ssr's createBrowserClient
 *   so the auth session is written to cookies (not localStorage). This
 *   lets src/middleware.ts read the session on every request and gate
 *   protected routes server-side.
 *
 * Public API (unchanged):
 *   - getSupabaseClient(env?)       browser anon-key client
 *   - switchEnvironment(env)        flip dev/main; persists via admin-env cookie
 *   - getCurrentEnvironment()       current env (dev | main)
 *   - getEnvironmentConfig(env?)    url + anon key for env
 *   - fetchView(viewName, options)  proxied through /api/admin
 *   - callEdgeFunction(name, body)  proxied through /api/admin
 */

import { createBrowserClient } from "@supabase/ssr";
import { SupabaseClient } from "@supabase/supabase-js";
import { getEnvConfig, type Environment } from "./env";

export type { Environment };

const ENV_COOKIE = "admin-env";
const ENV_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function readEnvCookie(): Environment {
  if (typeof document === "undefined") return "main";
  const match = document.cookie.match(/(?:^|;\s*)admin-env=(dev|main)\b/);
  return match?.[1] === "dev" ? "dev" : "main";
}

function writeEnvCookie(env: Environment) {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${ENV_COOKIE}=${env}; path=/; max-age=${ENV_COOKIE_MAX_AGE}; samesite=lax${secure}`;
}

let currentEnv: Environment = readEnvCookie();
let client: SupabaseClient | null = null;

export function getSupabaseClient(env?: Environment): SupabaseClient {
  const targetEnv = env || currentEnv;
  if (!client || targetEnv !== currentEnv) {
    currentEnv = targetEnv;
    const config = getEnvConfig(targetEnv);
    client = createBrowserClient(config.url, config.anonKey);
  }
  return client;
}

export function switchEnvironment(env: Environment): SupabaseClient {
  client = null;
  writeEnvCookie(env);
  return getSupabaseClient(env);
}

export function getCurrentEnvironment(): Environment {
  return currentEnv;
}

export function getEnvironmentConfig(env?: Environment) {
  return getEnvConfig(env || currentEnv);
}

/**
 * Forwards a privileged op to /api/admin with the caller's auth token.
 * Server-side handler validates the token, checks the email allow-list,
 * and runs the op with a service-role client.
 */
async function callAdminApi<T>(payload: Record<string, unknown>): Promise<T> {
  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Not signed in — no session token to call /api/admin");
  }

  const res = await fetch("/api/admin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ ...payload, env: currentEnv }),
  });

  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      detail = JSON.parse(text).error ?? text;
    } catch {
      /* not JSON; keep raw text */
    }
    throw new Error(`/api/admin returned ${res.status}: ${detail}`);
  }

  const json = (await res.json()) as { data: T };
  return json.data;
}

export async function fetchView<T = Record<string, unknown>>(
  viewName: string,
  options?: {
    select?: string;
    limit?: number;
    offset?: number;
    order?: { column: string; ascending?: boolean };
    filters?: Array<{ column: string; operator: string; value: unknown }>;
  },
): Promise<T[]> {
  return await callAdminApi<T[]>({
    op: "fetch-view",
    viewName,
    options,
  });
}

export async function callEdgeFunction<T = unknown>(
  functionName: string,
  body?: Record<string, unknown>,
): Promise<T> {
  return await callAdminApi<T>({
    op: "call-edge-function",
    functionName,
    body,
  });
}

export interface LandlordReviewQueueItem {
  tenancy_id: string;
  tenant_name: string | null;
  tenant_phone: string | null;
  landlord_name: string | null;
  landlord_phone: string | null;
  landlord_names: string[] | null;
  created_at: string;
  gates: {
    m360: { passed: boolean; value: string | null };
    bank: {
      passed: boolean;
      value: string | null;
      verified: boolean;
      name_matched: boolean;
    };
    stamp: { passed: boolean; value: string | null };
  };
}

export async function fetchLandlordReviewQueue(): Promise<LandlordReviewQueueItem[]> {
  return await callAdminApi<LandlordReviewQueueItem[]>({
    op: "fetch-landlord-review-queue",
  });
}

export async function updateTenancyLandlord(
  tenancyId: string,
  action: "promote" | "decline",
  reason?: string,
): Promise<{ id: string; landlord_status: string; landlord_approved: boolean }> {
  return await callAdminApi({
    op: "update-tenancy-landlord",
    tenancyId,
    action,
    reason,
  });
}
