/**
 * Process Notification Schedule — Cron Edge Function
 *
 * Runs every 5 minutes. Picks up pending notifications from
 * notification_schedule table that are due, verifies the user
 * hasn't already completed the desired action (state check),
 * and sends via notify-user.
 *
 * Also handles rent due reminders on 1st, 3rd, 5th of each month.
 *
 * Schedule: Every 5 minutes via pg_cron
 * Auth: Service role only
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { notifyUser } from "../_shared/notifications.ts";

function getSupabaseUrl(): string {
  return Deno.env.get("SUPABASE_URL") || Deno.env.get("SB_URL") || "";
}

function getServiceKey(): string {
  return Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

/**
 * State check functions — verify user hasn't completed the desired action.
 * Returns true if notification should STILL be sent (user hasn't acted).
 * Returns false if user has acted (skip the notification).
 */
async function shouldStillSend(
  supabase: any,
  userId: string,
  notificationType: string,
): Promise<boolean> {
  switch (notificationType) {
    // Note: onboarding_dropoff is primarily handled by send-onboarding-reminders cron.
    // This case exists as a fallback if someone manually inserts into notification_schedule.
    case "onboarding_dropoff": {
      // Check if user is still signed_up with no waitlist entry
      const { data: user } = await supabase
        .from("users").select("user_status").eq("id", userId).single();
      if (!user || user.user_status !== "signed_up") return false;
      const { data: wl } = await supabase
        .from("waitlist_entries").select("id").eq("user_id", userId).limit(1);
      return !wl || wl.length === 0;
    }

    case "agreement_upload_failed": {
      // Check if user still has no successful upload (still signed_up)
      const { data: user } = await supabase
        .from("users").select("user_status").eq("id", userId).single();
      return user?.user_status === "signed_up";
    }

    case "waitlist_rejected": {
      // Check if user hasn't re-uploaded (still not_eligible/waitlisted_rejected)
      const { data: user } = await supabase
        .from("users").select("user_status").eq("id", userId).single();
      return user?.user_status === "not_eligible" || user?.user_status === "waitlisted_rejected";
    }

    case "waitlist_approved": {
      // Check if user hasn't started setup (still approved, not active)
      const { data: user } = await supabase
        .from("users").select("user_status").eq("id", userId).single();
      return user?.user_status === "approved";
    }

    case "setup_incomplete": {
      // Check if user still hasn't completed setup
      const { data: user } = await supabase
        .from("users").select("user_status").eq("id", userId).single();
      return user?.user_status === "approved";
    }

    case "landlord_pending": {
      // Check if landlord still hasn't responded
      const { data: tenancy } = await supabase
        .from("tenancies").select("landlord_status")
        .eq("user_id", userId).eq("landlord_status", "invited").limit(1);
      return tenancy && tenancy.length > 0;
    }

    case "rent_overdue": {
      // Check if user still hasn't paid this month
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const { data: payments } = await supabase
        .from("payments").select("id")
        .eq("user_id", userId).eq("payment_month", currentMonth)
        .in("status", ["success", "processing", "pending"]).limit(1);
      return !payments || payments.length === 0;
    }

    case "payment_failed": {
      // Check if user hasn't retried successfully
      // Look for any successful payment in the last 6 hours
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const { data: payments } = await supabase
        .from("payments").select("id")
        .eq("user_id", userId).eq("status", "success")
        .gte("created_at", sixHoursAgo).limit(1);
      return !payments || payments.length === 0;
    }

    default:
      // For types without state checks (informational), always send
      return true;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    const authHeader = req.headers.get("Authorization");
    const serviceKey = getServiceKey();
    if (!authHeader?.includes(serviceKey)) {
      return errorResponse("Unauthorized", 401);
    }

    const supabaseUrl = getSupabaseUrl();
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const now = new Date();
    let sent = 0;
    let skipped = 0;
    let errors = 0;

    // ========================================
    // 1. Process scheduled notifications
    // ========================================

    const { data: dueNotifications } = await supabase
      .from("notification_schedule")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", now.toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(50);

    if (dueNotifications && dueNotifications.length > 0) {
      for (const notif of dueNotifications) {
        // State check: has user completed the desired action?
        const shouldSend = await shouldStillSend(supabase, notif.user_id, notif.notification_type);

        if (!shouldSend) {
          // User has acted — skip and cancel any remaining notifications of this type
          await supabase
            .from("notification_schedule")
            .update({ status: "skipped", skip_reason: "user_action_completed" })
            .eq("user_id", notif.user_id)
            .eq("notification_type", notif.notification_type)
            .eq("status", "pending");
          skipped++;
          continue;
        }

        try {
          await notifyUser(supabaseUrl, serviceKey, {
            user_id: notif.user_id,
            notification_type: notif.notification_type,
            template_vars: notif.template_vars ?? {},
            related_entity_type: notif.related_entity_type,
            related_entity_id: notif.related_entity_id,
          });

          await supabase
            .from("notification_schedule")
            .update({ status: "sent", sent_at: now.toISOString() })
            .eq("id", notif.id);
          sent++;
        } catch (e) {
          console.error(`[schedule] Failed to send ${notif.notification_type} for ${notif.user_id}:`, e);
          errors++;
        }
      }
    }

    // ========================================
    // 2. Rent due reminders (1st, 3rd, 5th of month)
    // ========================================

    const dayOfMonth = now.getDate();
    const hour = now.getUTCHours() + 5; // IST offset (approximate)
    const adjustedHour = hour >= 24 ? hour - 24 : hour;

    // Only run rent due check at ~10 AM IST (UTC 4:30)
    // The cron runs every 5 min, so check if we're in the 10:00-10:04 AM IST window
    const isRentDueTime = [1, 3, 5].includes(dayOfMonth) && adjustedHour === 10;

    if (isRentDueTime) {
      // Get active tenancies where user hasn't paid this month
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

      const { data: tenancies } = await supabase
        .from("tenancies")
        .select("id, user_id, monthly_rent")
        .eq("status", "active");

      if (tenancies && tenancies.length > 0) {
        // Check which users already paid
        const userIds = tenancies.map((t: any) => t.user_id);
        const { data: paidUsers } = await supabase
          .from("payments").select("user_id")
          .eq("payment_month", currentMonth)
          .in("status", ["success", "processing", "pending"])
          .in("user_id", userIds);

        const paidSet = new Set((paidUsers ?? []).map((p: any) => p.user_id));

        for (const tenancy of tenancies) {
          if (paidSet.has(tenancy.user_id)) continue;

          // Dedup: one rent_due per user per day
          const dedupKey = `${tenancy.user_id}:rent_due:${now.toISOString().slice(0, 10)}`;
          const { data: existing } = await supabase
            .from("notification_dedup")
            .select("id").eq("dedup_key", dedupKey).maybeSingle();

          if (existing) continue;

          try {
            await notifyUser(supabaseUrl, serviceKey, {
              user_id: tenancy.user_id,
              notification_type: "rent_due",
              related_entity_type: "tenancy",
              related_entity_id: tenancy.id,
            });
            try {
              await supabase.from("notification_dedup").insert({
                dedup_key: dedupKey,
                user_id: tenancy.user_id,
                notification_type: "rent_due",
              });
            } catch { /* ignore dedup insert errors */ }
            sent++;
          } catch {
            errors++;
          }
        }
      }
    }

    // ========================================
    // 3. Cleanup old completed schedule entries (older than 7 days)
    // ========================================
    try {
      await supabase
        .from("notification_schedule")
        .delete()
        .in("status", ["sent", "skipped", "cancelled"])
        .lt("created_at", new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());
    } catch { /* ignore cleanup errors */ }

    console.log(`[process-schedule] Done: ${sent} sent, ${skipped} skipped, ${errors} errors`);

    return jsonResponse({ success: true, sent, skipped, errors });
  } catch (error) {
    console.error("[process-schedule] Fatal error:", error);
    return errorResponse(error instanceof Error ? error.message : "Unknown error", 500);
  }
});
