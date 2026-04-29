/**
 * Flent Secured v2 - WhatsApp Broadcast Edge Function
 *
 * Sends WhatsApp broadcast campaigns to user segments.
 * Features dual auth (service role + admin key), dry-run, rate limiting.
 *
 * Endpoint: POST /functions/v1/whatsapp-broadcast
 * Auth: Service role + ADMIN_API_KEY (dual auth)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, verifyServiceRole } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { AppError, ValidationError, handleError } from "../_shared/errors.ts";
import { AuditLogger } from "../_shared/audit.ts";
import { sendWhatsApp } from "../_shared/notifications.ts";
import { sanitizePhone, formatPhoneWithCountryCode } from "../_shared/validation.ts";
import { isWhatsAppBroadcastEnabled } from "../_shared/feature-flags.ts";
import {
  reserveWhatsAppSlot,
  releaseWhatsAppSlot,
  logSendOutcome,
} from "../_shared/notification-policy.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const ADMIN_API_KEY = Deno.env.get("ADMIN_API_KEY");

// ==============================================
// TYPES
// ==============================================

interface BroadcastRequest {
  admin_key: string;
  campaign_name: string;
  content_sid: string;
  content_variables?: Record<string, string>;
  audience: "all" | "no_agreement" | "approved";
  dry_run?: boolean;
  max_recipients?: number;
}

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const supabase = createServiceClient();
  const audit = new AuditLogger(supabase, {
    actorType: "admin",
    functionName: "whatsapp-broadcast",
    requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
  });

  try {
    // Dual auth: service role + admin key
    const authHeader = req.headers.get("Authorization");
    verifyServiceRole(authHeader);

    const body: BroadcastRequest = await req.json();

    // Validate admin key
    if (!ADMIN_API_KEY || body.admin_key !== ADMIN_API_KEY) {
      throw new AppError("Invalid admin key", "UNAUTHORIZED", 403);
    }

    // Validate required fields
    if (!body.campaign_name || !body.content_sid || !body.audience) {
      throw new ValidationError("campaign_name, content_sid, and audience are required");
    }

    const validAudiences = ["all", "no_agreement", "approved"];
    if (!validAudiences.includes(body.audience)) {
      throw new ValidationError(`audience must be one of: ${validAudiences.join(", ")}`);
    }

    const maxRecipients = body.max_recipients ?? 5000;
    const isDryRun = body.dry_run ?? false;

    // Kill-switch — checks both `whatsapp_send` and `whatsapp_broadcast`.
    // Dry runs are still gated so a disabled environment never even queries
    // the audience (avoids leaking row counts during a kill).
    if (!(await isWhatsAppBroadcastEnabled())) {
      return jsonResponse(
        { success: false, error: "wa_broadcast_kill_switch", skipped: true },
        503,
      );
    }

    // Build audience query
    let query = supabase
      .from("users")
      .select("id, phone")
      .not("phone", "is", null)
      .neq("phone", "");

    if (body.audience === "no_agreement") {
      query = query.eq("user_status", "signed_up");
    } else if (body.audience === "approved") {
      query = query.in("user_status", ["approved", "active"]);
    }
    // "all" = no additional filter

    const { data: users, error: queryError } = await query.limit(maxRecipients);

    if (queryError) {
      throw new AppError(
        `Failed to query users: ${queryError.message}`,
        "QUERY_FAILED",
        500
      );
    }

    const recipients = users ?? [];

    // Dry run: return count only
    if (isDryRun) {
      return jsonResponse({
        success: true,
        dry_run: true,
        data: {
          campaign_name: body.campaign_name,
          audience: body.audience,
          recipient_count: recipients.length,
          max_recipients: maxRecipients,
        },
      });
    }

    // Concurrency guard: check if another broadcast is in progress (created in last 10 mins)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: recentBroadcasts } = await supabase
      .from("whatsapp_broadcast_log")
      .select("id, campaign_name, created_at")
      .gte("created_at", tenMinutesAgo)
      .limit(1);

    if (recentBroadcasts && recentBroadcasts.length > 0) {
      return jsonResponse({
        success: false,
        error: `Another broadcast is already in progress: "${recentBroadcasts[0].campaign_name}" (started ${recentBroadcasts[0].created_at}). Wait for it to complete.`,
      }, 409);
    }

    // Send messages sequentially with rate limiting.
    // Each recipient goes through reserveWhatsAppSlot, which honors the
    // global per-user daily cap and the user's whatsapp_enabled preference.
    // Per-type policies don't apply — broadcasts use a synthetic type with
    // no notification_policy row, so reserve_whatsapp_slot only enforces
    // the global cap for them.
    const broadcastType = `broadcast:${body.campaign_name}`;
    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const user of recipients) {
      if (!user.phone) continue;

      const reservation = await reserveWhatsAppSlot(
        supabase,
        user.id,
        broadcastType,
        {
          source: "whatsapp-broadcast",
          content_sid: body.content_sid,
          audience: body.audience,
        },
      );

      if (!reservation.allowed) {
        skippedCount++;
        await logSendOutcome(supabase, {
          user_id: user.id,
          notification_type: broadcastType,
          outcome: "skipped",
          skip_reason: reservation.reason,
          context: { source: "whatsapp-broadcast" },
        });
        continue;
      }

      try {
        const normalizedPhone = formatPhoneWithCountryCode(
          sanitizePhone(user.phone)
        );

        const result = await sendWhatsApp({
          to: normalizedPhone,
          template: body.content_sid,
          templateParams: body.content_variables
            ? Object.values(body.content_variables)
            : undefined,
        });

        const sendResult = result as { success: boolean; error?: string; messageId?: string };

        if (sendResult.success) {
          sentCount++;
        } else {
          failedCount++;
          console.warn(
            `[broadcast] Failed for XXXX${user.phone.slice(-4)}: ${sendResult.error}`
          );
        }

        if (reservation.slotId) {
          await releaseWhatsAppSlot(
            supabase,
            reservation.slotId,
            sendResult.success ? "sent" : "failed",
            sendResult.messageId,
            sendResult.success ? undefined : sendResult.error,
          );
        } else {
          // Reservation failed open (RPC error). Backstop the audit trail
          // with an explicit log entry so this send isn't invisible.
          await logSendOutcome(supabase, {
            user_id: user.id,
            notification_type: broadcastType,
            outcome: sendResult.success ? "sent" : "failed",
            external_id: sendResult.messageId,
            error_message: sendResult.success ? undefined : sendResult.error,
            context: { source: "whatsapp-broadcast", reservation_failed_open: true },
          });
        }
      } catch (sendError) {
        failedCount++;
        console.error(`[broadcast] Error for user ${user.id}:`, sendError);
        if (reservation.slotId) {
          await releaseWhatsAppSlot(
            supabase,
            reservation.slotId,
            "failed",
            undefined,
            sendError instanceof Error ? sendError.message : String(sendError),
          );
        } else {
          await logSendOutcome(supabase, {
            user_id: user.id,
            notification_type: broadcastType,
            outcome: "failed",
            error_message: sendError instanceof Error ? sendError.message : String(sendError),
            context: { source: "whatsapp-broadcast", reservation_failed_open: true },
          });
        }
      }

      // Rate limiting: 100ms delay between messages (~10 MPS, well under 80 MPS limit)
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Log to broadcast_log table. Soft-fail: if the insert errors (e.g.
    // schema mismatch from an unapplied migration), surface log_failed in
    // the response and log loudly to console — but don't 500. Returning
    // 500 after a successful Twilio fan-out invites the admin to retry,
    // which (after the 10-min single-flight) would double-send the
    // campaign. The audit_logs row below is the compliance trail; the
    // broadcast_log table is the operational trail.
    const { error: logError } = await supabase
      .from("whatsapp_broadcast_log")
      .insert({
        campaign_name: body.campaign_name,
        content_sid: body.content_sid,
        content_variables: body.content_variables,
        audience_filter: body.audience,
        total_sent: sentCount,
        total_failed: failedCount,
        total_skipped: skippedCount,
        initiated_by: "admin",
      });
    const logFailed = !!logError;
    if (logError) {
      console.error("[broadcast] Failed to log broadcast (audit_logs still recorded):", logError);
    }

    await audit.logSuccess(
      "BROADCAST_SENT",
      "notification",
      "whatsapp",
      undefined,
      {
        campaign_name: body.campaign_name,
        audience: body.audience,
        total_recipients: recipients.length,
        sent: sentCount,
        failed: failedCount,
        skipped: skippedCount,
      }
    );

    return jsonResponse({
      success: true,
      log_failed: logFailed,
      log_error: logError?.message,
      data: {
        campaign_name: body.campaign_name,
        audience: body.audience,
        total_recipients: recipients.length,
        sent: sentCount,
        failed: failedCount,
        skipped: skippedCount,
      },
    });
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
