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

interface UpdateExtractionRequest extends AdminRequestBase {
  op: "update-extraction";
  extractionId: string;
  fields: {
    monthly_rent_paise?: number;
    security_deposit_paise?: number;
    maintenance_paise?: number;
    rent_due_day?: number;
    property_address?: string;
    property_city?: string;
    property_state?: string;
    property_pincode?: string;
    property_bhk_type?: string;
    lease_start_date?: string;
    lease_end_date?: string;
    landlord_name?: string;
    landlord_phone?: string;
    rooms_in_agreement?: number;
  };
}

interface UpdateUserRequest extends AdminRequestBase {
  op: "update-user";
  userId: string;
  fields: {
    user_status?: string;
    name?: string;
    role?: string;
    cashback_balance_paise?: number;
  };
}

interface UpdatePaymentRequest extends AdminRequestBase {
  op: "update-payment";
  paymentId: string;
  fields: {
    settlement_status?: string;
    status?: string;
    settled_at?: string | null;
  };
}

interface UpdateTenancyRequest extends AdminRequestBase {
  op: "update-tenancy";
  tenancyId: string;
  fields: {
    bank_verified?: boolean;
    utility_verified?: boolean;
    tenancy_status?: string;
    landlord_approved?: boolean;
    cashback_balance_paise?: number;
  };
}

type AdminRequest =
  | FetchViewRequest
  | CallEdgeFunctionRequest
  | FetchLandlordReviewQueueRequest
  | UpdateTenancyLandlordRequest
  | UpdateExtractionRequest
  | UpdateUserRequest
  | UpdatePaymentRequest
  | UpdateTenancyRequest;

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

  const bypassAuth = process.env.BYPASS_AUTH === "true";
  let callerEmail: string | null = null;

  if (!bypassAuth) {
    callerEmail = await validateAuthToken(req, env);
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
  } else {
    callerEmail = "local@admin.dev";
  }

  const supabase = getServerSupabaseClient(env);

  const readOnly = process.env.READ_ONLY === "true";

  if (readOnly && payload.op !== "fetch-view" && payload.op !== "fetch-landlord-review-queue") {
    return NextResponse.json(
      { error: "This deployment is read-only" },
      { status: 403 },
    );
  }

  if (payload.op === "fetch-view") {
    const { viewName, options } = payload;
    if (!viewName || typeof viewName !== "string") {
      return NextResponse.json({ error: "Missing `viewName`" }, { status: 400 });
    }

    const PAGE_SIZE = 1000;
    const allRows: Record<string, unknown>[] = [];
    let offset = options?.offset ?? 0;
    const requestedLimit = options?.limit;

    // Paginate through PostgREST's 1000-row cap to fetch all rows
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const batchSize = requestedLimit
        ? Math.min(PAGE_SIZE, requestedLimit - allRows.length)
        : PAGE_SIZE;

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
      query = query.range(offset, offset + batchSize - 1);

      const { data, error } = await query;
      if (error) {
        console.error(`[/api/admin fetch-view ${viewName}] error:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      allRows.push(...((data as unknown as Record<string, unknown>[]) ?? []));
      offset += batchSize;

      if (!data || data.length < batchSize) break;
      if (requestedLimit && allRows.length >= requestedLimit) break;
    }

    return NextResponse.json({ data: allRows });
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
        "data:",
        data,
      );
      let detail = error.message;
      if (data && typeof data === "object") {
        const d = data as Record<string, unknown>;
        detail = (d.message as string) ?? (d.error as string) ?? detail;
        if (d.results) detail = JSON.stringify(d.results);
      } else if (typeof data === "string") {
        detail = data;
      }
      return NextResponse.json({ error: detail }, { status: 500 });
    }
    if (data && typeof data === "object" && "success" in data && !(data as Record<string, unknown>).success) {
      const d = data as Record<string, unknown>;
      let msg = (d.message as string) ?? "Edge function returned an error";
      if (d.results) msg += " — " + JSON.stringify(d.results);
      return NextResponse.json({ error: msg }, { status: 422 });
    }
    return NextResponse.json({ data });
  }

  if (payload.op === "fetch-landlord-review-queue") {
    interface TenancyRow {
      id: string;
      user_id: string;
      landlord_phone: string | null;
      country_code: string | null;
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
        "id, user_id, landlord_phone, country_code, landlord_name, landlord_names, " +
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
          landlord_country_code: t.country_code,
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
      .select("id, user_id, landlord_status, landlord_approved")
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

    // Best-effort tenant notification. Both branches are fire-and-forget;
    // a failure here doesn't undo the admin's UPDATE.
    if (action === "promote") {
      supabase.functions
        .invoke("notify-user", {
          body: {
            user_id: updated.user_id,
            notification_type: "landlord_verified",
            related_entity_type: "tenancy",
            related_entity_id: updated.id,
            priority: "high",
          },
        })
        .catch((e: unknown) =>
          console.error("[/api/admin promote] notify-user failed:", e),
        );
    } else {
      // Atomic claim before notify so the cron + admin-decline race can't
      // double-fire. notify-user is invoked only if this row owns the claim.
      const { data: claimed, error: claimErr } = await supabase
        .from("tenancies")
        .update({ landlord_verification_failed_notified_at: new Date().toISOString() })
        .eq("id", updated.id)
        .is("landlord_verification_failed_notified_at", null)
        .select("id")
        .maybeSingle();

      if (claimErr) {
        console.error("[/api/admin decline] failure-notify claim err:", claimErr);
      } else if (claimed) {
        supabase.functions
          .invoke("notify-user", {
            body: {
              user_id: updated.user_id,
              notification_type: "landlord_verification_failed",
              related_entity_type: "tenancy",
              related_entity_id: updated.id,
              priority: "high",
            },
          })
          .catch((e: unknown) =>
            console.error("[/api/admin decline] notify-user failed:", e),
          );
      }
      // If not claimed, the cron already notified — silently skip.
    }

    return NextResponse.json({ data: updated });
  }

  if (payload.op === "update-extraction") {
    const { extractionId, fields } = payload;

    if (!extractionId || typeof extractionId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid `extractionId`" },
        { status: 400 },
      );
    }

    if (!fields || typeof fields !== "object" || Object.keys(fields).length === 0) {
      return NextResponse.json(
        { error: "Missing or empty `fields` object" },
        { status: 400 },
      );
    }

    const ALLOWED_FIELDS = new Set([
      "monthly_rent_paise",
      "security_deposit_paise",
      "maintenance_paise",
      "rent_due_day",
      "property_address",
      "property_city",
      "property_state",
      "property_pincode",
      "property_bhk_type",
      "lease_start_date",
      "lease_end_date",
      "landlord_name",
      "landlord_phone",
      "rooms_in_agreement",
    ]);

    const unknownKeys = Object.keys(fields).filter((k) => !ALLOWED_FIELDS.has(k));
    if (unknownKeys.length > 0) {
      return NextResponse.json(
        { error: `Unknown field(s): ${unknownKeys.join(", ")}` },
        { status: 400 },
      );
    }

    const PAISE_FIELDS = ["monthly_rent_paise", "security_deposit_paise", "maintenance_paise"];
    for (const pf of PAISE_FIELDS) {
      const val = fields[pf as keyof typeof fields];
      if (val !== undefined) {
        if (typeof val !== "number" || !Number.isInteger(val) || val <= 0) {
          return NextResponse.json(
            { error: `\`${pf}\` must be a positive integer` },
            { status: 400 },
          );
        }
      }
    }

    if (fields.rent_due_day !== undefined) {
      const d = fields.rent_due_day;
      if (typeof d !== "number" || !Number.isInteger(d) || d < 1 || d > 28) {
        return NextResponse.json(
          { error: "`rent_due_day` must be an integer between 1 and 28" },
          { status: 400 },
        );
      }
    }

    if (fields.property_pincode !== undefined) {
      if (typeof fields.property_pincode !== "string" || !/^\d{6}$/.test(fields.property_pincode)) {
        return NextResponse.json(
          { error: "`property_pincode` must be a 6-digit string" },
          { status: 400 },
        );
      }
    }

    if (fields.rooms_in_agreement !== undefined) {
      const r = fields.rooms_in_agreement;
      if (typeof r !== "number" || !Number.isInteger(r) || r <= 0) {
        return NextResponse.json(
          { error: "`rooms_in_agreement` must be a positive integer" },
          { status: 400 },
        );
      }
    }

    // Build a clean update payload from only the whitelisted keys
    const updatePayload: Record<string, unknown> = {};
    for (const key of Object.keys(fields)) {
      if (ALLOWED_FIELDS.has(key)) {
        updatePayload[key] = fields[key as keyof typeof fields];
      }
    }

    const { data: updatedExtraction, error: extErr } = await supabase
      .from("extracted_rental_info")
      .update(updatePayload)
      .eq("id", extractionId)
      .select("id, updated_at")
      .maybeSingle();

    if (extErr) {
      console.error("[/api/admin update-extraction] err:", extErr);
      return NextResponse.json({ error: extErr.message }, { status: 500 });
    }
    if (!updatedExtraction) {
      return NextResponse.json(
        { error: "Extraction record not found" },
        { status: 404 },
      );
    }

    // Best-effort audit log
    try {
      await supabase.from("audit_logs").insert({
        actor_type: "admin",
        action: "ADMIN_EXTRACTION_UPDATE",
        action_category: "extraction",
        entity_type: "extracted_rental_info",
        entity_id: extractionId,
        details: { actor_email: callerEmail, fields: updatePayload },
        status: "success",
      });
    } catch (auditErr) {
      console.warn("[/api/admin update-extraction] audit insert failed:", auditErr);
    }

    return NextResponse.json({ data: updatedExtraction });
  }

  if (payload.op === "update-user") {
    const { userId, fields } = payload;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid `userId`" },
        { status: 400 },
      );
    }

    if (!fields || typeof fields !== "object" || Object.keys(fields).length === 0) {
      return NextResponse.json(
        { error: "Missing or empty `fields` object" },
        { status: 400 },
      );
    }

    const VALID_USER_STATUSES = ["approved", "rejected", "pending", "waitlisted", "active", "agreement_confirmed"];
    if (fields.user_status !== undefined && !VALID_USER_STATUSES.includes(fields.user_status)) {
      return NextResponse.json(
        { error: `\`user_status\` must be one of: ${VALID_USER_STATUSES.join(", ")}` },
        { status: 400 },
      );
    }

    if (fields.cashback_balance_paise !== undefined) {
      const v = fields.cashback_balance_paise;
      if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
        return NextResponse.json(
          { error: "`cashback_balance_paise` must be a non-negative integer" },
          { status: 400 },
        );
      }
    }

    // Update auth user metadata (name + role in one call if both present)
    if (fields.name || fields.role) {
      const metadata: Record<string, unknown> = {};
      if (fields.name) metadata.full_name = fields.name;
      if (fields.role) metadata.role = fields.role;
      const { error: authErr } = await supabase.auth.admin.updateUserById(userId, {
        user_metadata: metadata,
      });
      if (authErr) {
        console.error("[/api/admin update-user] auth update err:", authErr);
        return NextResponse.json({ error: authErr.message }, { status: 500 });
      }
    }

    // Update waitlist entry status
    if (fields.user_status) {
      const { error: wErr } = await supabase
        .from("waitlist_entries")
        .update({ admin_review: fields.user_status })
        .eq("user_id", userId);
      if (wErr) {
        console.error("[/api/admin update-user] waitlist update err:", wErr);
        return NextResponse.json({ error: wErr.message }, { status: 500 });
      }
    }

    // Update cashback balance on tenancies
    if (fields.cashback_balance_paise !== undefined) {
      const { error: tErr } = await supabase
        .from("tenancies")
        .update({ cashback_balance_paise: fields.cashback_balance_paise })
        .eq("user_id", userId);
      if (tErr) {
        console.error("[/api/admin update-user] tenancy cashback update err:", tErr);
        return NextResponse.json({ error: tErr.message }, { status: 500 });
      }
    }

    // Best-effort audit log
    try {
      await supabase.from("audit_logs").insert({
        actor_type: "admin",
        action: "ADMIN_USER_UPDATE",
        action_category: "user",
        entity_type: "user",
        entity_id: userId,
        details: { actor_email: callerEmail, fields },
        status: "success",
      });
    } catch (auditErr) {
      console.warn("[/api/admin update-user] audit insert failed:", auditErr);
    }

    return NextResponse.json({ data: { userId, updated: fields } });
  }

  if (payload.op === "update-payment") {
    const { paymentId, fields } = payload;

    if (!paymentId || typeof paymentId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid `paymentId`" },
        { status: 400 },
      );
    }

    if (!fields || typeof fields !== "object" || Object.keys(fields).length === 0) {
      return NextResponse.json(
        { error: "Missing or empty `fields` object" },
        { status: 400 },
      );
    }

    const VALID_SETTLEMENT_STATUSES = ["pending", "processing", "settled", "failed"];
    if (fields.settlement_status !== undefined && !VALID_SETTLEMENT_STATUSES.includes(fields.settlement_status)) {
      return NextResponse.json(
        { error: `\`settlement_status\` must be one of: ${VALID_SETTLEMENT_STATUSES.join(", ")}` },
        { status: 400 },
      );
    }

    const VALID_PAYMENT_STATUSES = ["initiated", "processing", "success", "failed", "refunded"];
    if (fields.status !== undefined && !VALID_PAYMENT_STATUSES.includes(fields.status)) {
      return NextResponse.json(
        { error: `\`status\` must be one of: ${VALID_PAYMENT_STATUSES.join(", ")}` },
        { status: 400 },
      );
    }

    // Auto-set settled_at when marking as settled
    const updatePayload: Record<string, unknown> = {};
    if (fields.settlement_status !== undefined) updatePayload.settlement_status = fields.settlement_status;
    if (fields.status !== undefined) updatePayload.status = fields.status;
    if (fields.settled_at !== undefined) {
      updatePayload.settled_at = fields.settled_at;
    } else if (fields.settlement_status === "settled") {
      updatePayload.settled_at = new Date().toISOString();
    }

    const { data: updatedPayment, error: pErr } = await supabase
      .from("payments")
      .update(updatePayload)
      .eq("id", paymentId)
      .select("id, status, settlement_status, settled_at")
      .maybeSingle();

    if (pErr) {
      console.error("[/api/admin update-payment] err:", pErr);
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }
    if (!updatedPayment) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 },
      );
    }

    // Best-effort audit log
    try {
      await supabase.from("audit_logs").insert({
        actor_type: "admin",
        action: "ADMIN_PAYMENT_UPDATE",
        action_category: "payment",
        entity_type: "payment",
        entity_id: paymentId,
        details: { actor_email: callerEmail, fields: updatePayload },
        status: "success",
      });
    } catch (auditErr) {
      console.warn("[/api/admin update-payment] audit insert failed:", auditErr);
    }

    return NextResponse.json({ data: updatedPayment });
  }

  if (payload.op === "update-tenancy") {
    const { tenancyId, fields } = payload;

    if (!tenancyId || typeof tenancyId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid `tenancyId`" },
        { status: 400 },
      );
    }

    if (!fields || typeof fields !== "object" || Object.keys(fields).length === 0) {
      return NextResponse.json(
        { error: "Missing or empty `fields` object" },
        { status: 400 },
      );
    }

    const VALID_TENANCY_STATUSES = ["pending", "active", "paused", "terminated"];
    if (fields.tenancy_status !== undefined && !VALID_TENANCY_STATUSES.includes(fields.tenancy_status)) {
      return NextResponse.json(
        { error: `\`tenancy_status\` must be one of: ${VALID_TENANCY_STATUSES.join(", ")}` },
        { status: 400 },
      );
    }

    if (fields.cashback_balance_paise !== undefined) {
      const v = fields.cashback_balance_paise;
      if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
        return NextResponse.json(
          { error: "`cashback_balance_paise` must be a non-negative integer" },
          { status: 400 },
        );
      }
    }

    // Build update payload from provided fields only
    const updatePayload: Record<string, unknown> = {};
    if (fields.bank_verified !== undefined) updatePayload.bank_verified = fields.bank_verified;
    if (fields.utility_verified !== undefined) updatePayload.utility_verified = fields.utility_verified;
    if (fields.tenancy_status !== undefined) updatePayload.tenancy_status = fields.tenancy_status;
    if (fields.landlord_approved !== undefined) updatePayload.landlord_approved = fields.landlord_approved;
    if (fields.cashback_balance_paise !== undefined) updatePayload.cashback_balance_paise = fields.cashback_balance_paise;

    const { data: updatedTenancy, error: tErr } = await supabase
      .from("tenancies")
      .update(updatePayload)
      .eq("id", tenancyId)
      .select("id, bank_verified, utility_verified, tenancy_status, landlord_approved")
      .maybeSingle();

    if (tErr) {
      console.error("[/api/admin update-tenancy] err:", tErr);
      return NextResponse.json({ error: tErr.message }, { status: 500 });
    }
    if (!updatedTenancy) {
      return NextResponse.json(
        { error: "Tenancy not found" },
        { status: 404 },
      );
    }

    // Best-effort audit log
    try {
      await supabase.from("audit_logs").insert({
        actor_type: "admin",
        action: "ADMIN_TENANCY_UPDATE",
        action_category: "tenancy",
        entity_type: "tenancy",
        entity_id: tenancyId,
        details: { actor_email: callerEmail, fields: updatePayload },
        status: "success",
      });
    } catch (auditErr) {
      console.warn("[/api/admin update-tenancy] audit insert failed:", auditErr);
    }

    return NextResponse.json({ data: updatedTenancy });
  }

  return NextResponse.json({ error: "Unknown op" }, { status: 400 });
}
