/**
 * Flent Secured v2 - Notify Landlord Edge Function
 *
 * Safety net: ensures landlord verification is persisted and tenant is notified.
 * Called as a follow-up after landlord-confirm. Idempotent — safe to call
 * even if landlord-confirm already approved the tenancy.
 *
 * Auth: Landlord JWT required.
 * Keys: Client sends publishable key (apikey header) + JWT (Authorization).
 *       No secret keys exposed to client.
 * Endpoint: POST /functions/v1/notify-landlord
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, createAuthenticatedClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { AppError, handleError, NotFoundError } from "../_shared/errors.ts";
import { AuditLogger, AuditActions } from "../_shared/audit.ts";
import { notifyUser } from "../_shared/notifications.ts";
import { getSupabaseUrl } from "../_shared/supabase.ts";

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const supabaseAdmin = createServiceClient();
  let audit: AuditLogger | null = null;

  try {
    // Authenticate landlord
    const { userId: landlordUserId } = await createAuthenticatedClient(
      req.headers.get("Authorization")
    );

    audit = new AuditLogger(supabaseAdmin, {
      userId: landlordUserId,
      actorType: "user",
      functionName: "notify-landlord",
      requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
    });

    // Get landlord's phone from users table (canonical source)
    const { data: landlordUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, phone, full_name")
      .eq("id", landlordUserId)
      .single();

    if (userError || !landlordUser?.phone) {
      throw new AppError("Landlord profile not found", "USER_NOT_FOUND", 404);
    }

    // Extract last 10 digits for matching (handles +91 vs 91 vs raw format)
    const landlordPhone = landlordUser.phone.replace(/\D/g, "");
    const last10Digits = landlordPhone.slice(-10);

    // Find matching tenancy by landlord phone
    const { data: tenancy, error: tenancyError } = await supabaseAdmin
      .from("tenancies")
      .select("id, user_id, landlord_name, landlord_phone, landlord_approved")
      .like("landlord_phone", `%${last10Digits}`)
      .eq("landlord_approved", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tenancyError) {
      console.error("[notify-landlord] Tenancy lookup error:", tenancyError);
      throw new AppError("Failed to look up tenancy", "DB_ERROR", 500);
    }

    if (!tenancy) {
      // Idempotent: if already approved by landlord-confirm, return success
      const { data: approvedTenancy } = await supabaseAdmin
        .from("tenancies")
        .select("id, user_id")
        .like("landlord_phone", `%${last10Digits}`)
        .eq("landlord_approved", true)
        .order("landlord_approved_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (approvedTenancy) {
        return jsonResponse({
          success: true,
          data: {
            tenancy_id: approvedTenancy.id,
            already_confirmed: true,
            landlord_verified: true,
          },
        });
      }

      throw new NotFoundError("No tenancy found for this phone number");
    }

    // Update tenancy as verified (status is set to active on waitlist approval, not here)
    const { error: updateError } = await supabaseAdmin
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
      console.error("[notify-landlord] Tenancy update error:", updateError);
      throw new AppError("Failed to update tenancy verification", "DB_ERROR", 500);
    }

    // Get tenant name for response
    const { data: tenant } = await supabaseAdmin
      .from("users")
      .select("full_name")
      .eq("id", tenancy.user_id)
      .single();

    // Notify tenant in background
    const supabaseUrl = getSupabaseUrl();
    const serviceKey = (Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;

    const backgroundWork = (async () => {
      try {
        await notifyUser(supabaseUrl, serviceKey, {
          user_id: tenancy.user_id,
          notification_type: "landlord_confirmed" as any,
          template_vars: {
            landlord_name: landlordUser.full_name ?? tenancy.landlord_name ?? "Your landlord",
          },
          priority: "high",
          related_entity_type: "tenancy",
          related_entity_id: tenancy.id,
        });

        await audit!.logSuccess(
          AuditActions.LANDLORD_OTP_VERIFIED,
          "landlord",
          "tenancy",
          tenancy.id,
          {
            landlord_user_id: landlordUserId,
            tenant_user_id: tenancy.user_id,
            landlord_name: landlordUser.full_name,
          }
        );
      } catch (bgError) {
        console.error("[notify-landlord] Background work failed (non-fatal):", bgError);
      }
    })();

    // @ts-ignore
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(backgroundWork);
    }

    return jsonResponse({
      success: true,
      data: {
        tenancy_id: tenancy.id,
        tenant_name: tenant?.full_name ?? null,
        landlord_verified: true,
      },
    });
  } catch (error) {
    if (audit) {
      await audit.logFailure(
        AuditActions.LANDLORD_OTP_VERIFIED,
        "landlord",
        error instanceof AppError ? error.code : "UNKNOWN_ERROR",
        error instanceof Error ? error.message : "Unknown error",
        "tenancy"
      );
    }

    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
