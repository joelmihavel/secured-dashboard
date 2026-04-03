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
import { createServiceClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { checkAndUpgradeLandlordStatus } from "../_shared/landlord-m360-check.ts";

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
      .select("id, landlord_phone")
      .eq("landlord_status", "otp_confirmed")
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
    let errors = 0;

    for (const tenancy of tenancies) {
      try {
        const result = await checkAndUpgradeLandlordStatus(
          tenancy.id,
          tenancy.landlord_phone,
          supabase,
        );

        if (result.upgraded) {
          upgraded++;
        } else {
          skipped++;
        }
      } catch (err) {
        errors++;
        console.error(`[upgrade-landlord-status] Error processing tenancy ${tenancy.id}:`, err);
      }
    }

    console.log(`[upgrade-landlord-status] Done: ${upgraded} upgraded, ${skipped} skipped, ${errors} errors`);

    return jsonResponse({
      processed: tenancies.length,
      upgraded,
      skipped,
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
