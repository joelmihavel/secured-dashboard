/**
 * Flent Secured v2 - Upgrade Landlord Status (Cron)
 *
 * Processes tenancies stuck at landlord_status='otp_confirmed' where the
 * fire-and-forget M360 check in landlord-confirm may have failed.
 *
 * Runs every 15 minutes via pg_cron.
 *
 * For each eligible tenancy:
 *   1. Queries the M360 record for the landlord's phone
 *   2. Runs Gemini name match against agreement landlord names
 *   3. Upgrades to 'verified' + landlord_approved=true if matched
 *
 * Auth: Internal (service role key via cron, or x-supabase-internal header)
 * Endpoint: POST /functions/v1/upgrade-landlord-status
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, getSupabaseUrl } from "../_shared/supabase.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { checkAndUpgradeLandlordStatus } from "../_shared/landlord-m360-check.ts";
import { notifyUser } from "../_shared/notifications.ts";

const MAX_PER_RUN = 20;

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabase = createServiceClient();

  try {
    // Find tenancies with OTP confirmed but M360 not yet matched
    // Safety: only process where landlord_otp_verified = true
    const { data: tenancies, error } = await supabase
      .from("tenancies")
      .select("id, user_id, landlord_phone, landlord_approved_at, landlord_verification_failed_notified_at")
      .in("landlord_status", ["otp_confirmed", "human_review"])
      .eq("landlord_approved", false)
      .eq("landlord_otp_verified", true)
      .order("landlord_approved_at", { ascending: true })
      .limit(MAX_PER_RUN);

    if (error) {
      console.error("[upgrade-landlord-status] Query failed:", error);
      return jsonResponse({ error: "Query failed", detail: error.message }, 500);
    }

    if (!tenancies?.length) {
      return jsonResponse({ processed: 0, message: "No tenancies to process" });
    }

    console.log(`[upgrade-landlord-status] Processing ${tenancies.length} tenancies`);

    let upgraded = 0;
    let skipped = 0;
    let failureNotified = 0;
    let errors = 0;
    const FIFTEEN_MIN_MS = 15 * 60 * 1000;
    const now = Date.now();

    for (const tenancy of tenancies) {
      try {
        const result = await checkAndUpgradeLandlordStatus(
          tenancy.id,
          tenancy.landlord_phone,
          supabase,
        );

        if (result.upgraded) {
          upgraded++;
          continue;
        }

        skipped++;

        // Failure-notification path: tenancy still not verified, OTP-confirm
        // happened ≥15 min ago, and we haven't notified yet. Atomic claim:
        // only the row whose UPDATE returns rowCount=1 fires the notification.
        const approvedAtMs = tenancy.landlord_approved_at
          ? new Date(tenancy.landlord_approved_at).getTime()
          : null;
        const eligibleForFailureNotify =
          approvedAtMs !== null &&
          now - approvedAtMs >= FIFTEEN_MIN_MS &&
          tenancy.landlord_verification_failed_notified_at === null;

        if (!eligibleForFailureNotify) continue;

        const { data: claimed, error: claimErr } = await supabase
          .from("tenancies")
          .update({ landlord_verification_failed_notified_at: new Date().toISOString() })
          .eq("id", tenancy.id)
          .is("landlord_verification_failed_notified_at", null)
          .in("landlord_status", ["otp_confirmed", "human_review"])
          .select("id")
          .maybeSingle();

        if (claimErr) {
          console.error(
            `[upgrade-landlord-status] Failure-notify claim failed for ${tenancy.id}:`,
            claimErr,
          );
          continue;
        }
        if (!claimed) {
          // Another worker (overlapping cron tick or admin-decline path) won
          // the claim. Skip silently.
          continue;
        }

        // Fire-and-forget — claim already persists, so a thrown notifyUser
        // doesn't risk re-firing on the next tick (and silently dropping
        // is preferable to spamming the tenant).
        const supabaseUrl = getSupabaseUrl();
        const serviceKey = (Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;
        notifyUser(supabaseUrl, serviceKey, {
          user_id: tenancy.user_id,
          notification_type: "landlord_verification_failed",
          priority: "high",
          related_entity_type: "tenancy",
          related_entity_id: tenancy.id,
        }).catch((err) =>
          console.error(
            `[upgrade-landlord-status] notifyUser(landlord_verification_failed) failed for ${tenancy.id}:`,
            err,
          ),
        );

        failureNotified++;
      } catch (err) {
        errors++;
        console.error(`[upgrade-landlord-status] Error processing tenancy ${tenancy.id}:`, err);
      }
    }

    console.log(
      `[upgrade-landlord-status] Done: ${upgraded} upgraded, ${skipped} skipped, ${failureNotified} failure-notified, ${errors} errors`,
    );

    return jsonResponse({
      processed: tenancies.length,
      upgraded,
      skipped,
      failure_notified: failureNotified,
      errors,
    });
  } catch (error) {
    console.error("[upgrade-landlord-status] Fatal error:", error);
    return jsonResponse(
      { error: "Internal error", detail: error instanceof Error ? error.message : "Unknown" },
      500,
    );
  }
});
