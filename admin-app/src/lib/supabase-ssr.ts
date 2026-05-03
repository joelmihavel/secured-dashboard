/**
 * supabase-ssr.ts — server-side cookie-aware Supabase clients.
 *
 * Anon-key clients only — used to validate the user's session from cookies.
 * For service-role bypass-RLS reads, use supabase-server.ts instead.
 *
 * Two flavors:
 *   - createMiddlewareClient(request, response) — for src/middleware.ts.
 *     Reads cookies from NextRequest, writes refreshed cookies onto NextResponse.
 *   - createRouteClient() — for /api/* route handlers (and Server Components).
 *     Uses next/headers cookies() store.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies as nextCookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { getEnvConfig, type Environment } from "./env";

const ENV_COOKIE = "admin-env";

export function readEnvCookie(
  source: NextRequest | { get: (name: string) => { value: string } | undefined },
): Environment {
  const cookies = "cookies" in source ? source.cookies : source;
  const raw = cookies.get(ENV_COOKIE)?.value;
  return raw === "dev" ? "dev" : "main";
}

/**
 * Middleware client. Reads session cookies from the incoming request and
 * writes any refreshed Supabase cookies back onto the outgoing response.
 * The response object is mutated — return the SAME response after calling
 * supabase.auth.getUser(), or session refresh won't reach the browser.
 */
export function createMiddlewareClient(
  request: NextRequest,
  response: NextResponse,
  env?: Environment,
) {
  const targetEnv = env ?? readEnvCookie(request);
  const config = getEnvConfig(targetEnv);
  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set({ name, value, ...options });
        });
      },
    },
  });
}

/**
 * Route-handler / Server-Component client. Uses next/headers cookies().
 * Caller should `await` the underlying cookies() before invoking — Next 15
 * makes cookies() async.
 */
export async function createRouteClient(env?: Environment) {
  const cookieStore = await nextCookies();
  const targetEnv =
    env ?? (cookieStore.get(ENV_COOKIE)?.value === "dev" ? "dev" : "main");
  const config = getEnvConfig(targetEnv);
  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Server Components can't set cookies; safe to ignore — middleware
            // will refresh on the next request.
          }
        });
      },
    },
  });
}

export { ENV_COOKIE };
