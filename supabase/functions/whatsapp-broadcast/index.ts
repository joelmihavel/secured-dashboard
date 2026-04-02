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

    // Send messages sequentially with rate limiting
    let sentCount = 0;
    let failedCount = 0;

    for (const user of recipients) {
      if (!user.phone) continue;

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

        if (result.success) {
          sentCount++;
        } else {
          failedCount++;
          console.warn(
            `[broadcast] Failed for XXXX${user.phone.slice(-4)}: ${result.error}`
          );
        }
      } catch (sendError) {
        failedCount++;
        console.error(`[broadcast] Error for user ${user.id}:`, sendError);
      }

      // Rate limiting: 100ms delay between messages (~10 MPS, well under 80 MPS limit)
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Log to broadcast_log table
    await supabase
      .from("whatsapp_broadcast_log")
      .insert({
        campaign_name: body.campaign_name,
        content_sid: body.content_sid,
        content_variables: body.content_variables,
        audience_filter: body.audience,
        total_sent: sentCount,
        total_failed: failedCount,
        initiated_by: "admin",
      })
      .catch((err: Error) => {
        console.error("[broadcast] Failed to log broadcast:", err);
      });

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
      }
    );

    return jsonResponse({
      success: true,
      data: {
        campaign_name: body.campaign_name,
        audience: body.audience,
        total_recipients: recipients.length,
        sent: sentCount,
        failed: failedCount,
      },
    });
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
