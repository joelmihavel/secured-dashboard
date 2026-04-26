/**
 * supabase.ts — browser-side Supabase client + server-proxy helpers.
 *
 * Phase A (2026-04-26):
 *   - The Supabase client created here uses ONLY the anon key. It's safe
 *     to ship to the browser and used for auth flows (sign in, get session,
 *     sign out) and any RLS-protected reads.
 *   - Privileged DB reads + admin edge function calls (which used to use
 *     a service-role-bearing browser client) now route through /api/admin
 *     — the server-side proxy. The browser sends the user's auth bearer
 *     token; the server validates it and performs the op with its
 *     server-only service-role client.
 *
 * Component-facing API stays the same:
 *   - fetchView(viewName, options) — same signature as before
 *   - callEdgeFunction(name, body) — same signature as before
 *
 * Internally these now POST to /api/admin instead of calling Supabase
 * directly. No component changes required.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getEnvConfig, type Environment } from "./env";

export type { Environment };

let currentEnv: Environment = "main";
let client: SupabaseClient | null = null;

/**
 * Returns an anon-key Supabase client for the current environment.
 * Used for auth flows + RLS-protected reads. Cannot bypass RLS.
 */
export function getSupabaseClient(env?: Environment): SupabaseClient {
  const targetEnv = env || currentEnv;
  if (!client || targetEnv !== currentEnv) {
    currentEnv = targetEnv;
    const config = getEnvConfig(targetEnv);
    client = createClient(config.url, config.anonKey);
  }
  return client;
}

export function switchEnvironment(env: Environment): SupabaseClient {
  client = null;
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
 * Server-side handler validates the token and runs the op with the
 * service-role client. Returns the response data (or throws on error).
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
