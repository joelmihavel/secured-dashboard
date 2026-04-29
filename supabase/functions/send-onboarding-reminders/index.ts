/**
 * Send Onboarding Reminders — Cron Edge Function
 *
 * Sends WhatsApp notifications to users who signed up but haven't
 * uploaded their agreement:
 *   1. First nudge: 15 minutes after signup
 *   2. Reminder: 6 hours after signup
 *
 * Schedule: Every 5 minutes via pg_cron
 * Auth: Service role only
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { notifyUser } from "../_shared/notifications.ts";
import { isWhatsAppAutomatedEnabled } from "../_shared/feature-flags.ts";

function getSupabaseUrl(): string {
  return Deno.env.get("SUPABASE_URL") || Deno.env.get("SB_URL") || "";
}

function getServiceKey(): string {
  return Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.includes(getServiceKey())) {
      return errorResponse("Unauthorized", 401);
    }

    const supabaseUrl = getSupabaseUrl();
    const serviceKey = getServiceKey();
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Skip the entire automated nudge cron when the operator has paused
    // automated WA. Push/in-app would still go out but onboarding nudges are
    // 100% WhatsApp — there's nothing else to do for these users right now.
    if (!(await isWhatsAppAutomatedEnabled())) {
      return jsonResponse({
        success: true,
        sent: 0,
        skipped: 0,
        errors: 0,
        message: "whatsapp_automated_disabled",
      });
    }

    const now = new Date();
    let sent = 0;
    let skipped = 0;
    let errors = 0;

    // Get all signed_up users (haven't uploaded agreement yet)
    const { data: signedUpUsers } = await supabase
      .from("users")
      .select("id, full_name, created_at")
      .eq("user_status", "signed_up");

    if (!signedUpUsers || signedUpUsers.length === 0) {
      return jsonResponse({ success: true, sent: 0, message: "No signed_up users" });
    }

    // Filter out users who already have waitlist entries (means they uploaded)
    const userIds = signedUpUsers.map((u: any) => u.id);
    const { data: withWaitlist } = await supabase
      .from("waitlist_entries")
      .select("user_id")
      .in("user_id", userIds);

    const hasUploaded = new Set((withWaitlist ?? []).map((w: any) => w.user_id));

    for (const user of signedUpUsers) {
      if (hasUploaded.has(user.id)) continue;

      const createdAt = new Date(user.created_at);
      const minutesSinceSignup = (now.getTime() - createdAt.getTime()) / (1000 * 60);

      // Determine which reminder to send based on time since signup
      let dedupSuffix: string | null = null;

      if (minutesSinceSignup >= 15 && minutesSinceSignup < 30) {
        // First nudge: 15 minutes after signup (window: 15-30 min)
        dedupSuffix = "15m";
      } else if (minutesSinceSignup >= 360 && minutesSinceSignup < 390) {
        // Reminder: 6 hours after signup (window: 6h-6h30m)
        dedupSuffix = "6h";
      }

      if (!dedupSuffix) {
        skipped++;
        continue;
      }

      // Dedup: one send per user per timing window
      const dedupKey = `${user.id}:onboarding_dropoff:${dedupSuffix}`;
      const { data: existing } = await supabase
        .from("notification_dedup")
        .select("id")
        .eq("dedup_key", dedupKey)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      try {
        await notifyUser(supabaseUrl, serviceKey, {
          user_id: user.id,
          notification_type: "onboarding_dropoff",
          template_vars: { name: user.full_name || "there" },
        });

        try {
          await supabase.from("notification_dedup").insert({
            dedup_key: dedupKey,
            user_id: user.id,
            notification_type: "onboarding_dropoff",
          });
        } catch { /* ignore dedup insert errors */ }

        sent++;
      } catch (e) {
        console.error(`[onboarding-reminders] Failed for ${user.id}:`, e);
        errors++;
      }
    }

    console.log(`[onboarding-reminders] Done: ${sent} sent, ${skipped} skipped, ${errors} errors`);

    return jsonResponse({ success: true, sent, skipped, errors });
  } catch (error) {
    console.error("[onboarding-reminders] Fatal error:", error);
    return errorResponse(error instanceof Error ? error.message : "Unknown error", 500);
  }
});
