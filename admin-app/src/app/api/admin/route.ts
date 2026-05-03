/**
 * /api/admin — server-side proxy for privileged Supabase reads + edge fn calls.
 *
 * Phase A (2026-04-26): replaces direct browser-side service-role usage.
 * Phase B (2026-05-01): adds email allow-list check + server-side admin_key
 *   injection so NEXT_PUBLIC_ADMIN_KEY no longer ships in the browser bundle.
 *
 * Operations supported:
 *   { op: "fetch-view",         viewName, options? }    → SELECT from a view
 *   { op: "call-edge-function", functionName, body? }   → invoke an edge fn
 *
 * Auth contract:
 *   - Caller must be a signed-in admin (email+password Supabase auth).
 *   - Browser sends `Authorization: Bearer <access-token>` (from supabase.auth.getSession()).
 *   - Server validates the token via Supabase's anon client (auth.getUser(jwt)).
 *   - Email must appear in ADMIN_EMAILS env var (server-only allow-list).
 *   - If invalid → 401. If valid but not admin → 403. Else proceed.
 *
 * Environment routing:
 *   - Body's `env` field (preferred). Falls back to `x-admin-env` header,
 *     then `admin-env` cookie, then "main".
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import { getAdminEmails, getAdminKey, isAdminEmail } from "@/lib/env-server";
import { getEnvConfig, type Environment } from "@/lib/env";

interface AdminRequestBase {
  env?: Environment;
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

interface FetchLandlordReviewQueueRequest extends AdminRequestBase {
  op: "fetch-landlord-review-queue";
}

interface UpdateTenancyLandlordRequest extends AdminRequestBase {
  op: "update-tenancy-landlord";
  tenancyId: string;
  action: "promote" | "decline";
  reason?: string;
}

type AdminRequest =
  | FetchViewRequest
  | CallEdgeFunctionRequest
  | FetchLandlordReviewQueueRequest
  | UpdateTenancyLandlordRequest;

function resolveEnv(req: NextRequest, body: AdminRequest): Environment | null {
  if (body.env === "dev" || body.env === "main") return body.env;
  const header = req.headers.get("x-admin-env");
  if (header === "dev" || header === "main") return header;
  const cookie = req.cookies.get("admin-env")?.value;
  if (cookie === "dev" || cookie === "main") return cookie;
  return "main";
}

async function validateAuthToken(
  req: NextRequest,
  env: Environment,
): Promise<string | null> {
  const authHeader =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const jwt = authHeader.slice("Bearer ".length).trim();
  if (!jwt) return null;

  const config = getEnvConfig(env);
  if (!config.url || !config.anonKey) return null;

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

  const env = resolveEnv(req, payload);
  if (!env) {
    return NextResponse.json(
      { error: "Missing or invalid env (body.env, x-admin-env header, or admin-env cookie)" },
      { status: 400 },
    );
  }

  const callerEmail = await validateAuthToken(req, env);
  if (!callerEmail) {
    return NextResponse.json(
      { error: "Unauthorized — invalid or expired session" },
      { status: 401 },
    );
  }

  if (!isAdminEmail(callerEmail)) {
    const allow = getAdminEmails();
    console.warn(
      `[/api/admin] denied non-admin caller "${callerEmail}". Allow-list size: ${allow.length}.`,
    );
    return NextResponse.json(
      { error: "Forbidden — email not in admin allow-list" },
      { status: 403 },
    );
  }

  const supabase = getServerSupabaseClient(env);

  if (payload.op === "fetch-view") {
    const { viewName, options } = payload;
    if (!viewName || typeof viewName !== "string") {
      return NextResponse.json({ error: "Missing `viewName`" }, { status: 400 });
    }
    let query = supabase.from(viewName).select(options?.select ?? "*");
    if (options?.filters) {
      for (const f of options.filters) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        query = (query as any).filter(f.column, f.operator, f.value);
      }
    }
    if (options?.order) {
      query = query.order(options.order.column, {
        ascending: options.order.ascending ?? true,
      });
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset != null) {
      query = query.range(
        options.offset,
        options.offset + (options.limit ?? 50) - 1,
      );
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
      return NextResponse.json(
        { error: "Missing `functionName`" },
        { status: 400 },
      );
    }

    let finalBody = body ?? {};
    if (functionName === "admin-waitlist") {
      try {
        finalBody = { ...finalBody, admin_key: getAdminKey() };
      } catch (err) {
        console.error("[/api/admin] admin_key missing:", err);
        return NextResponse.json(
          { error: "Server misconfigured — ADMIN_KEY is not set" },
          { status: 500 },
        );
      }
    }

    const { data, error } = await supabase.functions.invoke(functionName, {
      body: finalBody,
    });
    if (error) {
      console.error(
        `[/api/admin call-edge-function ${functionName}] error:`,
        error,
      );
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
  }

  if (payload.op === "fetch-landlord-review-queue") {
    interface TenancyRow {
      id: string;
      user_id: string;
      landlord_phone: string | null;
      landlord_name: string | null;
      landlord_names: string[] | null;
      landlord_status: string;
      bank_verified: boolean | null;
      extracted_rental_info_id: string | null;
      created_at: string;
    }

    // List tenancies sitting at landlord_status='human_review' along with the
    // computed gate breakdown so admins can see WHY they landed in the queue.
    const { data: tenancies, error: tErr } = await supabase
      .from("tenancies")
      .select(
        "id, user_id, landlord_phone, landlord_name, landlord_names, " +
          "landlord_status, bank_verified, extracted_rental_info_id, created_at",
      )
      .eq("landlord_status", "human_review")
      .order("created_at", { ascending: false })
      .returns<TenancyRow[]>();
    if (tErr) {
      console.error("[/api/admin fetch-landlord-review-queue] tenancies err:", tErr);
      return NextResponse.json({ error: tErr.message }, { status: 500 });
    }

    // Hydrate gate breakdown for each tenancy
    const enriched = await Promise.all(
      (tenancies ?? []).map(async (t: TenancyRow) => {
        // M360 lookup (last-10-digits match on consent_phone)
        let m360Name: string | null = null;
        if (t.landlord_phone) {
          const last10 = t.landlord_phone.replace(/\D/g, "").slice(-10);
          if (last10.length === 10) {
            const { data: iv } = await supabase
              .from("identity_verifications")
              .select("m360_full_name")
              .like("verification_id", "FLENT_LANDLORD_%")
              .eq("status", "SUCCESS")
              .like("consent_phone", `%${last10}`)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            m360Name = iv?.m360_full_name ?? null;
          }
        }

        // Landlord bank
        const { data: ba } = await supabase
          .from("bank_accounts")
          .select("verified_account_holder_name, verified, agreement_name_matched")
          .eq("user_id", t.user_id)
          .eq("party_type", "landlord")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Stamp verification
        let stampStatus: string | null = null;
        if (t.extracted_rental_info_id) {
          const { data: ext } = await supabase
            .from("extracted_rental_info")
            .select("stamp_verification_status")
            .eq("id", t.extracted_rental_info_id)
            .maybeSingle();
          stampStatus = ext?.stamp_verification_status ?? null;
        }

        // Tenant identity
        const { data: u } = await supabase.auth.admin.getUserById(t.user_id);
        const tenantName =
          (u?.user?.user_metadata as Record<string, unknown> | null)?.full_name ??
          null;

        return {
          tenancy_id: t.id,
          tenant_name: tenantName,
          tenant_phone: u?.user?.phone ?? null,
          landlord_name: t.landlord_name,
          landlord_phone: t.landlord_phone,
          landlord_names: t.landlord_names,
          created_at: t.created_at,
          gates: {
            m360: { passed: !!m360Name, value: m360Name },
            bank: {
              passed: !!ba?.verified && !!ba?.agreement_name_matched,
              value: ba?.verified_account_holder_name ?? null,
              verified: ba?.verified ?? false,
              name_matched: ba?.agreement_name_matched ?? false,
            },
            stamp: { passed: stampStatus === "verified", value: stampStatus },
          },
        };
      }),
    );

    return NextResponse.json({ data: enriched });
  }

  if (payload.op === "update-tenancy-landlord") {
    const { tenancyId, action, reason } = payload;
    if (!tenancyId || (action !== "promote" && action !== "decline")) {
      return NextResponse.json(
        { error: "Missing/invalid tenancyId or action (promote|decline)" },
        { status: 400 },
      );
    }

    const update =
      action === "promote"
        ? {
            landlord_status: "verified",
            landlord_approved: true,
            landlord_approved_at: new Date().toISOString(),
            landlord_otp_verified: true,
          }
        : {
            landlord_status: "declined",
            landlord_approved: false,
          };

    const { data: updated, error: uErr } = await supabase
      .from("tenancies")
      .update(update)
      .eq("id", tenancyId)
      .eq("landlord_status", "human_review")
      .select("id, landlord_status, landlord_approved")
      .maybeSingle();

    if (uErr) {
      console.error("[/api/admin update-tenancy-landlord] err:", uErr);
      return NextResponse.json({ error: uErr.message }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json(
        {
          error:
            "Tenancy not found or not in 'human_review' state — refresh the queue and retry",
        },
        { status: 404 },
      );
    }

    // Best-effort audit — schema requires actor_type, action, action_category.
    try {
      await supabase.from("audit_logs").insert({
        actor_type: "admin",
        action: action === "promote"
          ? "ADMIN_LANDLORD_PROMOTE"
          : "ADMIN_LANDLORD_DECLINE",
        action_category: "landlord",
        entity_type: "tenancy",
        entity_id: tenancyId,
        details: { actor_email: callerEmail, action, reason: reason ?? null },
        status: "success",
      });
    } catch (auditErr) {
      console.warn("[/api/admin update-tenancy-landlord] audit insert failed:", auditErr);
    }

    return NextResponse.json({ data: updated });
  }

  return NextResponse.json({ error: "Unknown op" }, { status: 400 });
}
