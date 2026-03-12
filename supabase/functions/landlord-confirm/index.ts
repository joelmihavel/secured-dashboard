/**
 * Flent Secured v2 - Landlord Confirm Edge Function
 *
 * Landlord reviews and confirms/disputes tenancy details.
 * Called after landlord-auth-otp has verified the landlord's identity.
 *
 * Endpoints:
 *   GET  → Fetch tenancy details for landlord to review
 *   POST → Confirm or dispute tenancy
 *
 * Auth: Landlord JWT required (from landlord-auth-otp session).
 * Keys: Client sends publishable key (apikey header) + JWT (Authorization).
 *       No secret keys exposed to client. Function uses server-side
 *       SUPABASE_SERVICE_ROLE_KEY for privileged operations.
 * Endpoint: /functions/v1/landlord-confirm
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, createAuthenticatedClient, getSupabaseUrl } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse, getCorsHeaders } from "../_shared/cors.ts";
import { AppError, NotFoundError, ValidationError, handleError } from "../_shared/errors.ts";
import { AuditLogger, AuditActions } from "../_shared/audit.ts";
import { notifyUser, sendWhatsApp } from "../_shared/notifications.ts";

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);
  const withCors = (response: Response): Response => {
    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
    return new Response(response.body, { status: response.status, headers });
  };

  const supabase = createServiceClient();
  let audit: AuditLogger | null = null;

  try {
    // Authenticate landlord via JWT (issued by landlord-auth-otp)
    const { userId: landlordUserId } = await createAuthenticatedClient(
      req.headers.get("Authorization")
    );

    audit = new AuditLogger(supabase, {
      userId: landlordUserId,
      actorType: "user",
      functionName: "landlord-confirm",
      requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
    });

    // Get landlord's phone and name from their profile
    const { data: landlordUser, error: userError } = await supabase
      .from("users")
      .select("id, phone, full_name, role")
      .eq("id", landlordUserId)
      .single();

    if (userError || !landlordUser?.phone) {
      throw new AppError("Landlord profile not found", "USER_NOT_FOUND", 404);
    }

    const landlordDigits = landlordUser.phone.replace(/\D/g, "");
    const last10 = landlordDigits.slice(-10);

    if (req.method === "GET") {
      return withCors(await handleGetTenancy(supabase, last10, audit));
    }

    if (req.method === "POST") {
      const body = await req.json();

      if (body.action === "confirm") {
        return withCors(
          await handleConfirm(supabase, landlordUserId, landlordUser, last10, audit)
        );
      }

      if (body.action === "dispute") {
        return withCors(
          await handleDispute(supabase, landlordUserId, landlordUser, last10, body.reason, audit)
        );
      }

      throw new ValidationError("Invalid action. Use 'confirm' or 'dispute'.");
    }

    return withCors(errorResponse("Method not allowed", 405));
  } catch (error) {
    if (audit) {
      await audit.logFailure(
        "LANDLORD_CONFIRM_FAILED",
        "landlord",
        error instanceof AppError ? error.code : "UNKNOWN_ERROR",
        error instanceof Error ? error.message : "Unknown error",
        "tenancy"
      );
    }
    return withCors(handleError(error, req.headers.get("x-request-id") ?? undefined));
  }
});

// ==============================================
// GET TENANCY DETAILS
// ==============================================

async function handleGetTenancy(
  supabase: ReturnType<typeof createServiceClient>,
  last10: string,
  audit: AuditLogger
): Promise<Response> {
  const { data: tenancy, error } = await supabase
    .from("tenancies")
    .select(`
      id, status, monthly_rent_paise, rent_due_day,
      lease_start_date, lease_end_date,
      property_address, property_city, property_state, property_pincode,
      landlord_name, landlord_phone,
      landlord_approved, landlord_approved_at,
      user_id,
      users!tenancies_user_id_fkey (first_name, last_name)
    `)
    .like("landlord_phone", `%${last10}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AppError("Failed to look up tenancy", "DB_ERROR", 500);
  }

  if (!tenancy) {
    throw new NotFoundError("No tenancy found for your phone number");
  }

  if (tenancy.landlord_approved) {
    return jsonResponse({
      success: true,
      data: {
        already_confirmed: true,
        confirmed_at: tenancy.landlord_approved_at,
        tenancy_id: tenancy.id,
      },
    });
  }

  const user = (tenancy as any).users as { first_name: string; last_name: string } | null;

  await audit.logSuccess("LANDLORD_VIEWED_TENANCY", "landlord", "tenancy", tenancy.id);

  return jsonResponse({
    success: true,
    data: {
      tenancy_id: tenancy.id,
      tenant: {
        name: user ? `${user.first_name} ${user.last_name ?? ""}`.trim() : "Unknown",
      },
      property: {
        address: tenancy.property_address,
        city: tenancy.property_city,
        state: tenancy.property_state,
        pincode: tenancy.property_pincode,
      },
      rent: {
        monthly_amount: tenancy.monthly_rent_paise / 100,
        due_day: tenancy.rent_due_day,
      },
      lease: {
        start_date: tenancy.lease_start_date,
        end_date: tenancy.lease_end_date,
      },
      landlord: {
        name: tenancy.landlord_name,
      },
    },
  });
}

// ==============================================
// CONFIRM HANDLER
// ==============================================

async function handleConfirm(
  supabase: ReturnType<typeof createServiceClient>,
  landlordUserId: string,
  landlordUser: { phone: string; full_name: string | null },
  last10: string,
  audit: AuditLogger
): Promise<Response> {
  // Find pending tenancy
  const { data: tenancy, error } = await supabase
    .from("tenancies")
    .select("id, user_id, landlord_name, landlord_phone, landlord_approved")
    .like("landlord_phone", `%${last10}`)
    .eq("landlord_approved", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AppError("Failed to look up tenancy", "DB_ERROR", 500);
  }

  if (!tenancy) {
    // Idempotent: check if already confirmed
    const { data: approved } = await supabase
      .from("tenancies")
      .select("id")
      .like("landlord_phone", `%${last10}`)
      .eq("landlord_approved", true)
      .order("landlord_approved_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (approved) {
      return jsonResponse({
        success: true,
        data: { tenancy_id: approved.id, already_confirmed: true },
      });
    }

    throw new NotFoundError("No pending tenancy found for your phone number");
  }

  // Confirm tenancy (status is set to active on waitlist approval, not here)
  const { error: updateError } = await supabase
    .from("tenancies")
    .update({
      landlord_approved: true,
      landlord_approved_at: new Date().toISOString(),
      landlord_response: "approved",
      landlord_status: "verified",
      landlord_user_id: landlordUserId,
      landlord_otp_verified: true,
    })
    .eq("id", tenancy.id);

  if (updateError) {
    console.error("[landlord-confirm] Tenancy confirmation failed:", updateError);
    throw new AppError("Failed to confirm tenancy", "DB_ERROR", 500);
  }

  // Get tenant name
  const { data: tenant } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", tenancy.user_id)
    .single();

  // Send notifications (non-blocking)
  const supabaseUrl = getSupabaseUrl();
  const serviceKey = (Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;
  const landlordE164 = landlordUser.phone.startsWith("+")
    ? landlordUser.phone
    : `+${landlordUser.phone.replace(/\D/g, "")}`;

  Promise.all([
    // Push notification to tenant
    notifyUser(supabaseUrl, serviceKey, {
      user_id: tenancy.user_id,
      notification_type: "landlord_confirmed" as any,
      template_vars: {
        landlord_name: landlordUser.full_name ?? tenancy.landlord_name ?? "Your landlord",
      },
      priority: "high",
      related_entity_type: "tenancy",
      related_entity_id: tenancy.id,
    }),
    // WhatsApp thank-you to landlord
    sendWhatsApp({
      to: landlordE164,
      template: "HXcbf7e476ac60af8a9cc548028ef914ea",
    }),
  ]).catch((err) => console.error("[landlord-confirm] Notification error:", err));

  await audit.logSuccess(AuditActions.LANDLORD_APPROVED, "landlord", "tenancy", tenancy.id, {
    landlord_user_id: landlordUserId,
    tenant_user_id: tenancy.user_id,
  });

  console.log(`[landlord-confirm] Tenancy ${tenancy.id} confirmed by landlord ${landlordUserId}`);

  return jsonResponse({
    success: true,
    data: {
      tenancy_id: tenancy.id,
      tenant_name: tenant?.full_name ?? null,
      confirmed: true,
    },
  });
}

// ==============================================
// DISPUTE HANDLER
// ==============================================

async function handleDispute(
  supabase: ReturnType<typeof createServiceClient>,
  landlordUserId: string,
  landlordUser: { phone: string; full_name: string | null },
  last10: string,
  reason: string | undefined,
  audit: AuditLogger
): Promise<Response> {
  if (!reason) {
    throw new ValidationError("Dispute reason is required");
  }

  const { data: tenancy, error } = await supabase
    .from("tenancies")
    .select("id, user_id, landlord_name, landlord_email")
    .like("landlord_phone", `%${last10}`)
    .eq("landlord_approved", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !tenancy) {
    throw new NotFoundError("No pending tenancy found");
  }

  const { error: updateError } = await supabase
    .from("tenancies")
    .update({
      landlord_response: "disputed",
      landlord_dispute_reason: reason,
      landlord_disputed_at: new Date().toISOString(),
      landlord_user_id: landlordUserId,
    })
    .eq("id", tenancy.id);

  if (updateError) {
    console.error("[landlord-confirm] Dispute update failed:", updateError);
  }

  // Notify tenant
  const supabaseUrl = getSupabaseUrl();
  const serviceKey = (Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;

  notifyUser(supabaseUrl, serviceKey, {
    user_id: tenancy.user_id,
    notification_type: "landlord_rejected" as any,
    template_vars: {
      landlord_name: landlordUser.full_name ?? tenancy.landlord_name ?? "Your landlord",
    },
    priority: "high",
    related_entity_type: "tenancy",
    related_entity_id: tenancy.id,
  }).catch((e) => console.error("[landlord-confirm] Dispute notification error:", e));

  // Audit trail
  await supabase.from("audit_logs").insert({
    user_id: tenancy.user_id,
    actor_type: "user",
    action: "TENANCY_DISPUTED",
    action_category: "landlord",
    entity_type: "tenancy",
    entity_id: tenancy.id,
    details: {
      dispute_reason: reason,
      landlord_name: landlordUser.full_name,
      landlord_user_id: landlordUserId,
      requires_review: true,
    },
  });

  await audit.logSuccess(AuditActions.LANDLORD_DISPUTED, "landlord", "tenancy", tenancy.id, {
    dispute_reason: reason,
  });

  return jsonResponse({
    success: true,
    data: {
      tenancy_id: tenancy.id,
      disputed: true,
      message: "Dispute recorded. Our team will review and contact both parties.",
    },
  });
}
