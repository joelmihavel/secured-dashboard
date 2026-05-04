/**
 * Flent Secured v2 - Invite Landlord WhatsApp Edge Function
 *
 * Sends a WhatsApp invite to the landlord via Twilio approved template.
 * Accepts landlord_phone + country_code from request body, saves on tenancy,
 * and supports international numbers.
 *
 * Auth: Tenant JWT required.
 * Endpoint: POST /functions/v1/invite-landlord-whatsapp
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, createAuthenticatedClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { AppError, ValidationError, handleError } from "../_shared/errors.ts";
import { isValidPhone } from "../_shared/validation.ts";
import { AuditLogger, AuditActions } from "../_shared/audit.ts";
import { sendWhatsApp } from "../_shared/notifications.ts";
import { reserveWhatsAppSlot, releaseWhatsAppSlot } from "../_shared/notification-policy.ts";

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const supabaseAdmin = createServiceClient();
  let audit: AuditLogger | null = null;

  try {
    // Authenticate tenant
    const { userId: tenantUserId } = await createAuthenticatedClient(
      req.headers.get("Authorization")
    );

    audit = new AuditLogger(supabaseAdmin, {
      userId: tenantUserId,
      actorType: "user",
      functionName: "invite-landlord-whatsapp",
      requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
    });

    const body = await req.json();
    const { tenancy_id, landlord_phone: bodyPhone, country_code: bodyCountryCode } = body;

    if (!tenancy_id) {
      throw new ValidationError("tenancy_id is required", { tenancy_id: "Required" });
    }

    // Fetch tenancy and verify ownership
    const { data: tenancy, error: tenancyError } = await supabaseAdmin
      .from("tenancies")
      .select("id, user_id, landlord_phone, landlord_name, landlord_status, landlord_invite_count, landlord_otp_verified, country_code")
      .eq("id", tenancy_id)
      .single();

    if (tenancyError || !tenancy) {
      throw new AppError("Tenancy not found", "NOT_FOUND", 404);
    }

    if (tenancy.user_id !== tenantUserId) {
      throw new AppError("You are not authorized to invite for this tenancy", "FORBIDDEN", 403);
    }

    // Resolve phone: body > tenancy (error if neither)
    const resolvedPhone = bodyPhone?.replace(/\D/g, "") || tenancy.landlord_phone?.replace(/\D/g, "");
    if (!resolvedPhone) {
      throw new ValidationError("Landlord phone number is required", { landlord_phone: "Required" });
    }

    // Resolve country code: body > tenancy > default +91
    const resolvedCountryCode = bodyCountryCode || tenancy.country_code || "+91";

    // Validate with country-aware validator (supports 14+ countries)
    if (!isValidPhone(resolvedPhone, resolvedCountryCode)) {
      throw new ValidationError("Invalid landlord phone number for the selected country");
    }

    // Rate limit: max 3 WhatsApp messages per day per tenancy
    const MAX_INVITES_PER_DAY = 3;
    const isPhoneChanged = bodyPhone && bodyPhone.replace(/\D/g, "") !== tenancy.landlord_phone?.replace(/\D/g, "");

    if (!isPhoneChanged && tenancy.landlord_invite_count) {
      // Check how many invites were sent today
      const { count: todayCount } = await supabaseAdmin
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("entity_id", tenancy_id)
        .eq("action", "LANDLORD_INVITE_SENT")
        .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString());

      if ((todayCount ?? 0) >= MAX_INVITES_PER_DAY) {
        throw new AppError(
          `You can send a maximum of ${MAX_INVITES_PER_DAY} reminders per day. Please try again tomorrow.`,
          "RATE_LIMITED",
          429,
        );
      }
    }

    // If phone came from body, save it on tenancy before sending. When the
    // tenant SWITCHES to a different landlord (isPhoneChanged), wipe all
    // landlord-side state — the previous landlord's OTP/approval/M360 is
    // not valid for the new person and would corrupt the 3-gate cron.
    if (bodyPhone) {
      const phoneUpdate: Record<string, unknown> = {
        landlord_phone: resolvedPhone,
        country_code: resolvedCountryCode,
      };
      if (isPhoneChanged) {
        phoneUpdate.landlord_status = "invited";
        phoneUpdate.landlord_otp_verified = false;
        phoneUpdate.landlord_otp_hash = null;
        phoneUpdate.landlord_otp_expires_at = null;
        phoneUpdate.landlord_otp_attempts = 0;
        phoneUpdate.landlord_response = null;
        phoneUpdate.landlord_approved = false;
        phoneUpdate.landlord_approved_at = null;
        phoneUpdate.landlord_user_id = null;
      }
      const { error: phoneUpdateError } = await supabaseAdmin
        .from("tenancies")
        .update(phoneUpdate)
        .eq("id", tenancy.id);

      if (phoneUpdateError) {
        console.error("[invite-landlord-whatsapp] Failed to save phone on tenancy:", phoneUpdateError);
        // Non-fatal — continue with sending
      }
    }

    // Get tenant's full name for template variable
    const { data: tenantUser } = await supabaseAdmin
      .from("users")
      .select("full_name")
      .eq("id", tenantUserId)
      .single();

    const tenantFullName = tenantUser?.full_name ?? "Your tenant";

    // Cancel any in-flight retry rows for this tenancy. The tenant tapping
    // "Send" again should always supersede an outstanding retry — they're
    // either retrying a different number or wanted a fresh attempt now.
    // Rows currently in 'processing' are left alone (cron has already
    // committed the send; we'll dedupe on the next reconcile cycle).
    await supabaseAdmin
      .from("landlord_invite_retry_queue")
      .update({ status: "superseded", last_error_message: "tenant_resent" })
      .eq("tenancy_id", tenancy.id)
      .eq("status", "pending");

    // Get template SID from env
    const LANDLORD_INVITE_TEMPLATE_SID = Deno.env.get("TWILIO_LANDLORD_INVITE_TEMPLATE_SID");
    if (!LANDLORD_INVITE_TEMPLATE_SID) {
      throw new AppError(
        "WhatsApp template not configured. Please contact support.",
        "CONFIG_ERROR",
        500
      );
    }

    // Format E.164 for WhatsApp: e.g. +919876543210
    const e164Phone = `${resolvedCountryCode}${resolvedPhone}`;

    // Best-effort: if the landlord already has a Flent account we want to
    // honor their whatsapp_enabled / daily-cap. Otherwise we send without a
    // policy reservation (one-shot tenant-initiated invite).
    const { data: landlordUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("phone", e164Phone)
      .maybeSingle();
    const landlordUserId = (landlordUser as { id?: string } | null)?.id ?? null;

    let reservationSlotId = "";
    if (landlordUserId) {
      const reservation = await reserveWhatsAppSlot(
        supabaseAdmin,
        landlordUserId,
        "landlord_invite",
        { source: "invite-landlord-whatsapp", tenancy_id: tenancy.id },
      );
      if (!reservation.allowed) {
        throw new AppError(
          `Cannot send WhatsApp invite: ${reservation.reason}`,
          "POLICY_BLOCKED",
          429,
        );
      }
      reservationSlotId = reservation.slotId;
    }

    // Send WhatsApp via template — wrapped in try/finally so a thrown
    // sendWhatsApp (network error, runtime exception in twilioRequest, etc.)
    // still releases the reserved slot. Without this, a failure here would
    // leak a 'pending' row that counts toward the lifetime cap permanently.
    let result: { success: boolean; messageId?: string; error?: string } | null = null;
    let sendError: unknown = null;
    try {
      result = await sendWhatsApp({
        to: e164Phone,
        template: LANDLORD_INVITE_TEMPLATE_SID,
        templateParams: [tenantFullName],
      });
    } catch (err) {
      sendError = err;
    } finally {
      if (reservationSlotId) {
        await releaseWhatsAppSlot(
          supabaseAdmin,
          reservationSlotId,
          result?.success ? "sent" : "failed",
          result?.messageId,
          result?.success
            ? undefined
            : result?.error ??
              (sendError instanceof Error ? sendError.message : sendError ? String(sendError) : "send threw"),
        );
      }
    }

    if (sendError) throw sendError;

    if (!result?.success) {
      console.error("[invite-landlord-whatsapp] WhatsApp send failed:", result?.error);
      throw new AppError(
        "Failed to send WhatsApp invite. Please try again.",
        "WHATSAPP_SEND_FAILED",
        502
      );
    }

    // Update tenancy invite status. Note: landlord_status='invited' here
    // is OPTIMISTIC — Twilio's response is 'queued', not 'delivered'. The
    // reconcile-landlord-invite-deliveries cron polls Twilio per-minute for
    // the terminal status of last_landlord_invite_message_sid and will
    // transition this to 'invited_deferred' (retry queued) or
    // 'invited_undelivered' (terminal) if the message ultimately fails.
    //
    // Don't regress landlord_status if the landlord has already verified OTP —
    // a re-invite from the retry path or tenant action must not undo
    // 'otp_confirmed'/'human_review'/'verified', otherwise the row becomes
    // self-contradictory (status='invited' but otp_verified=true) and the
    // 3-gate cron's eligibleStatuses filter stops seeing it.
    const currentInviteCount = tenancy.landlord_invite_count ?? 0;
    const tenancyUpdate: Record<string, unknown> = {
      landlord_invite_sent_at: new Date().toISOString(),
      landlord_invite_count: currentInviteCount + 1,
      last_landlord_invite_message_sid: result.messageId ?? null,
      landlord_invite_status_checked: false,
    };
    // The in-memory `tenancy` was loaded BEFORE the phone-change reset above,
    // so `landlord_otp_verified` reflects pre-reset state. Treat a phone
    // change as if OTP was never verified (it wasn't, for the new landlord).
    const otpVerifiedForCurrentLandlord = tenancy.landlord_otp_verified && !isPhoneChanged;
    if (!otpVerifiedForCurrentLandlord) {
      tenancyUpdate.landlord_status = "invited";
    }
    const { error: updateError } = await supabaseAdmin
      .from("tenancies")
      .update(tenancyUpdate)
      .eq("id", tenancy.id);

    if (updateError) {
      console.error("[invite-landlord-whatsapp] Tenancy update error:", updateError);
      // Non-fatal — WhatsApp was already sent
    }

    // Mask phone for response
    const phoneMasked = `XXXXXX${resolvedPhone.slice(-4)}`;

    // Fire-and-forget audit
    const auditPromise = audit.logSuccess(
      AuditActions.LANDLORD_INVITE_SENT,
      "landlord",
      "tenancy",
      tenancy.id,
      {
        tenant_user_id: tenantUserId,
        landlord_phone_masked: phoneMasked,
        message_id: result.messageId,
        invite_count: currentInviteCount + 1,
        country_code: resolvedCountryCode,
      }
    );
    // @ts-ignore
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) { EdgeRuntime.waitUntil(auditPromise); }

    return jsonResponse({
      success: true,
      data: {
        message_id: result.messageId,
        landlord_phone_masked: phoneMasked,
        invite_count: currentInviteCount + 1,
      },
    });
  } catch (error) {
    if (audit) {
      await audit.logFailure(
        AuditActions.LANDLORD_INVITE_SENT,
        "landlord",
        error instanceof AppError ? error.code : "UNKNOWN_ERROR",
        error instanceof Error ? error.message : "Unknown error",
        "tenancy"
      );
    }

    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
