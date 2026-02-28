/**
 * Flent Secured v2 - Broadcast App Update Notification
 *
 * Sends an app_update push notification to all users with active device tokens.
 * Processes users in batches to avoid overwhelming the notify-user function.
 *
 * Endpoint: POST /functions/v1/broadcast-app-update
 * Auth: Service Role only (admin/internal use)
 *
 * Optional body:
 *   {
 *     "store_url": "https://apps.apple.com/...",   // override App Store URL
 *     "dry_run": true                                // preview without sending
 *   }
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  createServiceClient,
  verifyServiceRole,
  getSupabaseUrl,
} from "../_shared/supabase.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { handleError } from "../_shared/errors.ts";
import { AuditLogger } from "../_shared/audit.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const BATCH_SIZE = 50;
const DEFAULT_STORE_URL =
  "https://apps.apple.com/in/app/secured-by-flent/id6757275258";

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabase = createServiceClient();
  let audit: AuditLogger | null = null;

  try {
    // Service role only
    const authHeader = req.headers.get("Authorization");
    verifyServiceRole(authHeader);

    audit = AuditLogger.fromRequest(
      supabase,
      req,
      undefined,
      "broadcast-app-update",
    );

    // Parse optional body
    let storeUrl = DEFAULT_STORE_URL;
    let dryRun = false;

    try {
      const body = await req.json();
      if (body.store_url) storeUrl = body.store_url;
      if (body.dry_run === true) dryRun = true;
    } catch {
      // Empty body is fine — use defaults
    }

    // Get distinct user IDs that have at least one active device token
    const { data: users, error: usersError } = await supabase
      .from("device_tokens")
      .select("user_id")
      .eq("status", "active");

    if (usersError) {
      throw new Error(`Failed to query device_tokens: ${usersError.message}`);
    }

    // Deduplicate user IDs (a user may have multiple tokens)
    const userIds = [...new Set((users ?? []).map((r: { user_id: string }) => r.user_id))];

    if (dryRun) {
      return jsonResponse({
        success: true,
        dry_run: true,
        data: {
          user_count: userIds.length,
          store_url: storeUrl,
          message: `Would send app_update notification to ${userIds.length} users`,
        },
      });
    }

    // Send notifications in batches
    const supabaseUrl = getSupabaseUrl();
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let sentCount = 0;
    let failedCount = 0;
    const errors: Array<{ user_id: string; error: string }> = [];

    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);

      // Send each notification in the batch concurrently
      const results = await Promise.allSettled(
        batch.map(async (userId) => {
          const response = await fetch(
            `${supabaseUrl}/functions/v1/notify-user`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${serviceKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                user_id: userId,
                notification_type: "app_update",
                data: { store_url: storeUrl },
                priority: "high",
              }),
            },
          );

          if (!response.ok) {
            const errText = await response.text().catch(() => "Unknown");
            throw new Error(errText);
          }

          return response.json();
        }),
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === "fulfilled") {
          sentCount++;
        } else {
          failedCount++;
          errors.push({
            user_id: batch[j],
            error: result.reason?.message ?? "Unknown error",
          });
        }
      }
    }

    await audit.logSuccess(
      "APP_UPDATE_BROADCAST",
      "notification",
      "notification",
      undefined,
      {
        user_count: userIds.length,
        sent_count: sentCount,
        failed_count: failedCount,
        store_url: storeUrl,
      },
    );

    return jsonResponse({
      success: true,
      data: {
        user_count: userIds.length,
        sent_count: sentCount,
        failed_count: failedCount,
        store_url: storeUrl,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      },
    });
  } catch (error) {
    if (audit) {
      await audit.logFailure(
        "APP_UPDATE_BROADCAST_FAILED",
        "notification",
        error instanceof Error ? "BROADCAST_FAILED" : "UNKNOWN_ERROR",
        error instanceof Error ? error.message : "Unknown error",
        "notification",
      );
    }

    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
