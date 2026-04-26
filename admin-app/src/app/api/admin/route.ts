/**
 * /api/admin — server-side proxy for privileged Supabase reads + edge fn calls.
 *
 * Phase A (2026-04-26): replaces direct browser-side service-role usage.
 * Browser sends the request to this route handler; the handler validates
 * the caller's auth session, then performs the requested op using the
 * server-only service-role Supabase client. The service-role key NEVER
 * leaves the Vercel server.
 *
 * Operations supported:
 *   { op: "fetch-view",         viewName, options? }    → SELECT from a view
 *   { op: "call-edge-function", functionName, body? }   → invoke an edge fn
 *
 * Auth contract:
 *   - Caller must be a signed-in admin (email+password Supabase auth)
 *   - Browser sends `Authorization: Bearer <access-token>` (from supabase.auth.getSession())
 *   - Server validates the token via Supabase's anon client (auth.getUser(jwt))
 *   - If invalid → 401. If valid → proceed.
 *
 * Environment routing:
 *   - Request body includes `env: "dev" | "main"` to pick which Supabase project
 *   - Server picks the matching service-role client from supabase-server.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import { getEnvConfig, type Environment } from "@/lib/env";

interface AdminRequestBase {
  env: Environment;
}

interface FetchViewRequest extends AdminRequestBase {
  op: "fetch-view";
  viewName: string;
  options?: {
    select?: string;
    limit?: number;
    offset?: number;
    order?: { column: string; ascending?: boolean };
    filters?: Array<{ column: string; operator: string; value: unknown }>;
  };
}

interface CallEdgeFunctionRequest extends AdminRequestBase {
  op: "call-edge-function";
  functionName: string;
  body?: Record<string, unknown>;
}

type AdminRequest = FetchViewRequest | CallEdgeFunctionRequest;

/**
 * Validate the caller's Supabase access token. Returns user email on success
 * or null on any failure (expired, malformed, signed by wrong project, etc).
 *
 * Uses the ANON key client (which is fine — getUser(jwt) is a public auth
 * verification endpoint). We don't need the service-role key for token
 * validation; we use it only AFTER the token is validated.
 */
async function validateAuthToken(req: NextRequest, env: Environment): Promise<string | null> {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const jwt = authHeader.slice("Bearer ".length).trim();
  if (!jwt) return null;

  const config = getEnvConfig(env);
  if (!config.url || !config.anonKey) return null;

  // Throwaway anon-key client just to validate the JWT.
  const anon = createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.auth.getUser(jwt);
  if (error || !data.user) return null;
  return data.user.email ?? null;
}

export async function POST(req: NextRequest) {
  let payload: AdminRequest;
  try {
    payload = (await req.json()) as AdminRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload.env || (payload.env !== "dev" && payload.env !== "main")) {
    return NextResponse.json({ error: "Missing or invalid `env` field" }, { status: 400 });
  }

  const callerEmail = await validateAuthToken(req, payload.env);
  if (!callerEmail) {
    return NextResponse.json(
      { error: "Unauthorized — invalid or expired session" },
      { status: 401 },
    );
  }

  const supabase = getServerSupabaseClient(payload.env);

  // Dispatch on the operation type
  if (payload.op === "fetch-view") {
    const { viewName, options } = payload;
    if (!viewName || typeof viewName !== "string") {
      return NextResponse.json({ error: "Missing `viewName`" }, { status: 400 });
    }
    let query = supabase.from(viewName).select(options?.select ?? "*");
    if (options?.filters) {
      for (const f of options.filters) {
        // The Supabase JS client's filter method dispatches by operator name.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        query = (query as any).filter(f.column, f.operator, f.value);
      }
    }
    if (options?.order) {
      query = query.order(options.order.column, { ascending: options.order.ascending ?? true });
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset != null) {
      query = query.range(options.offset, options.offset + (options.limit ?? 50) - 1);
    }
    const { data, error } = await query;
    if (error) {
      console.error(`[/api/admin fetch-view ${viewName}] error:`, error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
  }

  if (payload.op === "call-edge-function") {
    const { functionName, body } = payload;
    if (!functionName || typeof functionName !== "string") {
      return NextResponse.json({ error: "Missing `functionName`" }, { status: 400 });
    }
    const { data, error } = await supabase.functions.invoke(functionName, { body });
    if (error) {
      console.error(`[/api/admin call-edge-function ${functionName}] error:`, error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: "Unknown op" }, { status: 400 });
}
