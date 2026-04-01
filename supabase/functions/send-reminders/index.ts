/**
 * Send Reminders — Cron Edge Function
 *
 * Sends proactive notifications for:
 * 1. rent_due — 3 days before due date
 * 2. rent_due_tomorrow — 1 day before due date
 * 3. rent_overdue — 1 day after due date (if unpaid)
 * 4. reminder_utility — 2 days after approval if utility not verified
 * 5. reminder_landlord_invite — 3 days after approval if landlord not invited
 * 6. reminder_agreement — 2 days after signup if no agreement uploaded
 * 7. setup_incomplete — approved users who haven't finished setup (1+ days)
 * 8. onboarding_dropoff — signed_up users with no waitlist entry (2+ days)
 * 9. landlord_pending — invited landlord not confirmed (2+ days)
 * 10. milestone_streak — 3 or 6 consecutive on-time payments
 *
 * Schedule: Daily at 10:00 AM IST (04:30 UTC) via pg_cron
 * Auth: Service role only
 *
 * Deduplication: Uses `notification_dedup` table to prevent re-sending
 * the same notification type to the same user within 24 hours.
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { notifyUser } from "../_shared/notifications.ts";
import type { NotificationType } from "../_shared/notification-templates.ts";

function getSupabaseUrl(): string {
  return Deno.env.get("SUPABASE_URL") || Deno.env.get("SB_URL") || "";
}

function getServiceKey(): string {
  return Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

// IST timezone offset
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function nowIST(): Date {
  const utc = new Date();
  return new Date(utc.getTime() + IST_OFFSET_MS);
}

interface ReminderResult {
  type: string;
  sent: number;
  skipped: number;
  errors: number;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    // Verify service role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.includes(getServiceKey())) {
      return errorResponse("Unauthorized", 401);
    }

    const supabaseUrl = getSupabaseUrl();
    const serviceKey = getServiceKey();
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const results: ReminderResult[] = [];
    const today = nowIST();
    const todayDay = today.getDate();

    // ========================================
    // 1. RENT REMINDERS (active tenancies only)
    // ========================================

    // Get all active tenancies with upcoming payment info
    const { data: tenancies } = await supabase
      .from("tenancies")
      .select("id, user_id, monthly_rent, rent_due_day, landlord_name, status")
      .eq("status", "active");

    if (tenancies && tenancies.length > 0) {
      // Check which users already paid this month
      const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
      const { data: paidThisMonth } = await supabase
        .from("payments")
        .select("user_id")
        .eq("payment_month", currentMonth)
        .in("status", ["success", "processing", "pending", "initiated"]);

      const paidUserIds = new Set((paidThisMonth ?? []).map((p: any) => p.user_id));

      for (const tenancy of tenancies) {
        if (paidUserIds.has(tenancy.user_id)) continue; // Already paid/processing

        const dueDay = tenancy.rent_due_day ?? 1;
        // Compute actual days until due — handles month boundaries correctly.
        // Simple subtraction (dueDay - todayDay) fails when due date is in next month
        // (e.g., rent_due_day=1, today=March 29 → -28 instead of 3).
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const clampedDueDay = Math.min(dueDay, daysInMonth);
        const dueThisMonth = new Date(today.getFullYear(), today.getMonth(), clampedDueDay);
        const dueNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, Math.min(dueDay, new Date(today.getFullYear(), today.getMonth() + 2, 0).getDate()));
        const targetDue = dueThisMonth.getTime() >= today.getTime() ? dueThisMonth : dueNextMonth;
        const daysUntilDue = Math.round((targetDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const amountStr = (tenancy.monthly_rent ?? 0).toLocaleString("en-IN");
        const dueMonthIdx = targetDue.getMonth();
        const dueDate = `${dueDay} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][dueMonthIdx]}`;

        let notificationType: NotificationType | null = null;

        if (daysUntilDue === 3) {
          notificationType = "rent_due";
        } else if (daysUntilDue === 1) {
          notificationType = "rent_due_tomorrow";
        } else if (daysUntilDue === -1) {
          notificationType = "rent_overdue";
        }

        if (!notificationType) continue;

        // Dedup check — don't send same type to same user within 24h
        const dedupKey = `${tenancy.user_id}:${notificationType}:${currentMonth}`;
        const { data: existing } = await supabase
          .from("notification_dedup")
          .select("id")
          .eq("dedup_key", dedupKey)
          .maybeSingle();

        if (existing) continue; // Already sent

        try {
          await notifyUser(supabaseUrl, serviceKey, {
            user_id: tenancy.user_id,
            notification_type: notificationType,
            template_vars: { amount: amountStr, date: dueDate },
            related_entity_type: "tenancy",
            related_entity_id: tenancy.id,
          });

          // Mark as sent
          await supabase.from("notification_dedup").insert({
            dedup_key: dedupKey,
            user_id: tenancy.user_id,
            notification_type: notificationType,
          }).catch(() => {}); // Best-effort dedup tracking

          const existing_result = results.find(r => r.type === notificationType);
          if (existing_result) existing_result.sent++;
          else results.push({ type: notificationType, sent: 1, skipped: 0, errors: 0 });
        } catch (e) {
          console.error(`[send-reminders] ${notificationType} failed for ${tenancy.user_id}:`, e);
          const existing_result = results.find(r => r.type === notificationType);
          if (existing_result) existing_result.errors++;
          else results.push({ type: notificationType, sent: 0, skipped: 0, errors: 1 });
        }
      }
    }

    // ========================================
    // 2. SETUP REMINDERS (approved users who haven't completed setup)
    // ========================================

    // Get approved users with incomplete verification
    const { data: incompleteUsers } = await supabase
      .from("tenancies")
      .select(`
        id, user_id, status, created_at,
        verification_status:tenancy_verifications(
          bank_verified, utility_verified, landlord_approved, landlord_response
        )
      `)
      .eq("status", "pending_verification");

    if (incompleteUsers && incompleteUsers.length > 0) {
      for (const tenancy of incompleteUsers) {
        const vs = (tenancy.verification_status as any)?.[0] ?? tenancy.verification_status;
        if (!vs) continue;

        const createdAt = new Date(tenancy.created_at);
        const daysSinceCreated = Math.floor((today.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

        // reminder_utility: 2 days after setup, bank done, utility not done
        if (vs.bank_verified && !vs.utility_verified && daysSinceCreated >= 2) {
          const dedupKey = `${tenancy.user_id}:reminder_utility:${today.toISOString().slice(0, 10)}`;
          const { data: existing } = await supabase
            .from("notification_dedup")
            .select("id")
            .eq("dedup_key", dedupKey)
            .maybeSingle();

          if (!existing) {
            try {
              await notifyUser(supabaseUrl, serviceKey, {
                user_id: tenancy.user_id,
                notification_type: "reminder_utility",
              });
              await supabase.from("notification_dedup").insert({
                dedup_key: dedupKey,
                user_id: tenancy.user_id,
                notification_type: "reminder_utility",
              }).catch(() => {});
              results.push({ type: "reminder_utility", sent: 1, skipped: 0, errors: 0 });
            } catch {
              results.push({ type: "reminder_utility", sent: 0, skipped: 0, errors: 1 });
            }
          }
        }

        // reminder_landlord_invite: 3 days after setup, utility done, landlord not invited
        if (vs.bank_verified && vs.utility_verified && !vs.landlord_approved &&
            vs.landlord_response === null && daysSinceCreated >= 3) {
          const dedupKey = `${tenancy.user_id}:reminder_landlord_invite:${today.toISOString().slice(0, 10)}`;
          const { data: existing } = await supabase
            .from("notification_dedup")
            .select("id")
            .eq("dedup_key", dedupKey)
            .maybeSingle();

          if (!existing) {
            try {
              await notifyUser(supabaseUrl, serviceKey, {
                user_id: tenancy.user_id,
                notification_type: "reminder_landlord_invite",
              });
              await supabase.from("notification_dedup").insert({
                dedup_key: dedupKey,
                user_id: tenancy.user_id,
                notification_type: "reminder_landlord_invite",
              }).catch(() => {});
              results.push({ type: "reminder_landlord_invite", sent: 1, skipped: 0, errors: 0 });
            } catch {
              results.push({ type: "reminder_landlord_invite", sent: 0, skipped: 0, errors: 1 });
            }
          }
        }
      }
    }

    // ========================================
    // 3. AGREEMENT REMINDER (signed_up users, no waitlist entry after 2 days)
    // ========================================

    const { data: staleSignups } = await supabase
      .from("users")
      .select("id, created_at")
      .eq("user_status", "signed_up")
      .lt("created_at", new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString());

    if (staleSignups && staleSignups.length > 0) {
      // Check which ones already have waitlist entries (meaning they uploaded)
      const userIds = staleSignups.map((u: any) => u.id);
      const { data: withEntries } = await supabase
        .from("waitlist_entries")
        .select("user_id")
        .in("user_id", userIds);

      const hasEntry = new Set((withEntries ?? []).map((w: any) => w.user_id));

      for (const user of staleSignups) {
        if (hasEntry.has(user.id)) continue; // Already uploaded

        const dedupKey = `${user.id}:reminder_agreement:${today.toISOString().slice(0, 10)}`;
        const { data: existing } = await supabase
          .from("notification_dedup")
          .select("id")
          .eq("dedup_key", dedupKey)
          .maybeSingle();

        if (!existing) {
          try {
            await notifyUser(supabaseUrl, serviceKey, {
              user_id: user.id,
              notification_type: "reminder_agreement",
            });
            await supabase.from("notification_dedup").insert({
              dedup_key: dedupKey,
              user_id: user.id,
              notification_type: "reminder_agreement",
            }).catch(() => {});
            results.push({ type: "reminder_agreement", sent: 1, skipped: 0, errors: 0 });
          } catch {
            results.push({ type: "reminder_agreement", sent: 0, skipped: 0, errors: 1 });
          }
        }
      }
    }

    // ========================================
    // 4. SETUP INCOMPLETE (approved users who haven't finished setup, 1+ days)
    // ========================================

    const { data: approvedNotSetup } = await supabase
      .from("users")
      .select("id, created_at")
      .eq("user_status", "approved");

    if (approvedNotSetup && approvedNotSetup.length > 0) {
      for (const user of approvedNotSetup) {
        const createdAt = new Date(user.created_at);
        const daysSince = Math.floor((today.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince < 1) continue;

        const dedupKey = `${user.id}:setup_incomplete:${today.toISOString().slice(0, 10)}`;
        const { data: existing } = await supabase
          .from("notification_dedup")
          .select("id")
          .eq("dedup_key", dedupKey)
          .maybeSingle();

        if (!existing) {
          try {
            await notifyUser(supabaseUrl, serviceKey, {
              user_id: user.id,
              notification_type: "setup_incomplete",
            });
            await supabase.from("notification_dedup").insert({
              dedup_key: dedupKey,
              user_id: user.id,
              notification_type: "setup_incomplete",
            }).catch(() => {});
            results.push({ type: "setup_incomplete", sent: 1, skipped: 0, errors: 0 });
          } catch {
            results.push({ type: "setup_incomplete", sent: 0, skipped: 0, errors: 1 });
          }
        }
      }
    }

    // ========================================
    // 5. ONBOARDING DROP-OFF (signed_up, no waitlist entry, 2+ days)
    // ========================================

    // Note: This is similar to reminder_agreement but uses different WA template copy.
    // The existing reminder_agreement (section 3) handles push; this adds the WA-specific type.
    const { data: dropoffUsers } = await supabase
      .from("users")
      .select("id, full_name, created_at")
      .eq("user_status", "signed_up")
      .lt("created_at", new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString());

    if (dropoffUsers && dropoffUsers.length > 0) {
      const dropoffUserIds = dropoffUsers.map((u: any) => u.id);
      const { data: withWaitlist } = await supabase
        .from("waitlist_entries")
        .select("user_id")
        .in("user_id", dropoffUserIds);

      const hasWaitlistEntry = new Set((withWaitlist ?? []).map((w: any) => w.user_id));

      for (const user of dropoffUsers) {
        if (hasWaitlistEntry.has(user.id)) continue;

        const dedupKey = `${user.id}:onboarding_dropoff:${today.toISOString().slice(0, 10)}`;
        const { data: existing } = await supabase
          .from("notification_dedup")
          .select("id")
          .eq("dedup_key", dedupKey)
          .maybeSingle();

        if (!existing) {
          try {
            await notifyUser(supabaseUrl, serviceKey, {
              user_id: user.id,
              notification_type: "onboarding_dropoff",
              template_vars: { name: user.full_name || "there" },
            });
            await supabase.from("notification_dedup").insert({
              dedup_key: dedupKey,
              user_id: user.id,
              notification_type: "onboarding_dropoff",
            }).catch(() => {});
            results.push({ type: "onboarding_dropoff", sent: 1, skipped: 0, errors: 0 });
          } catch {
            results.push({ type: "onboarding_dropoff", sent: 0, skipped: 0, errors: 1 });
          }
        }
      }
    }

    // ========================================
    // 6. LANDLORD PENDING (invited but not confirmed, 2+ days)
    // ========================================

    const { data: pendingLandlord } = await supabase
      .from("tenancies")
      .select("id, user_id, landlord_invite_sent_at")
      .eq("landlord_status", "invited")
      .not("landlord_invite_sent_at", "is", null);

    if (pendingLandlord && pendingLandlord.length > 0) {
      for (const tenancy of pendingLandlord) {
        if (!tenancy.landlord_invite_sent_at) continue;
        const inviteSentAt = new Date(tenancy.landlord_invite_sent_at);
        const daysSinceInvite = Math.floor((today.getTime() - inviteSentAt.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceInvite < 2) continue;

        const dedupKey = `${tenancy.user_id}:landlord_pending:${today.toISOString().slice(0, 10)}`;
        const { data: existing } = await supabase
          .from("notification_dedup")
          .select("id")
          .eq("dedup_key", dedupKey)
          .maybeSingle();

        if (!existing) {
          try {
            await notifyUser(supabaseUrl, serviceKey, {
              user_id: tenancy.user_id,
              notification_type: "landlord_pending",
              related_entity_type: "tenancy",
              related_entity_id: tenancy.id,
            });
            await supabase.from("notification_dedup").insert({
              dedup_key: dedupKey,
              user_id: tenancy.user_id,
              notification_type: "landlord_pending",
            }).catch(() => {});
            results.push({ type: "landlord_pending", sent: 1, skipped: 0, errors: 0 });
          } catch {
            results.push({ type: "landlord_pending", sent: 0, skipped: 0, errors: 1 });
          }
        }
      }
    }

    // ========================================
    // 7. MILESTONE STREAKS (3 or 6 consecutive on-time payments)
    // ========================================

    // Get active tenancies with their rent_due_day
    const { data: activeTenantsForStreak } = await supabase
      .from("tenancies")
      .select("id, user_id, rent_due_day")
      .eq("status", "active");

    if (activeTenantsForStreak && activeTenantsForStreak.length > 0) {
      for (const tenancy of activeTenantsForStreak) {
        // Get all successful payments for this user, ordered by month
        const { data: userPayments } = await supabase
          .from("payments")
          .select("payment_month, paid_at")
          .eq("user_id", tenancy.user_id)
          .eq("status", "success")
          .order("payment_month", { ascending: false });

        if (!userPayments || userPayments.length < 3) continue;

        // Compute consecutive on-time streak from most recent
        const dueDay = tenancy.rent_due_day ?? 1;
        let streak = 0;

        for (let i = 0; i < userPayments.length; i++) {
          const payment = userPayments[i];
          if (!payment.paid_at || !payment.payment_month) break;

          // Check if paid on time (within 3 days of due date as grace period)
          const paymentDate = new Date(payment.paid_at);
          const monthStart = new Date(payment.payment_month);
          const dueDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), Math.min(dueDay, 28));
          const graceCutoff = new Date(dueDate.getTime() + 3 * 24 * 60 * 60 * 1000);

          if (paymentDate <= graceCutoff) {
            streak++;
          } else {
            break; // Streak broken
          }

          // Check month continuity (each payment_month should be 1 month before the previous)
          if (i > 0) {
            const prevMonth = new Date(userPayments[i - 1].payment_month);
            const currMonth = new Date(payment.payment_month);
            const monthDiff = (prevMonth.getFullYear() - currMonth.getFullYear()) * 12 +
              (prevMonth.getMonth() - currMonth.getMonth());
            if (monthDiff !== 1) break; // Gap in months
          }
        }

        // Fire notification at 3 and 6 month milestones
        for (const milestone of [3, 6]) {
          if (streak >= milestone) {
            const dedupKey = `${tenancy.user_id}:milestone_streak:${milestone}`;
            const { data: existing } = await supabase
              .from("notification_dedup")
              .select("id")
              .eq("dedup_key", dedupKey)
              .maybeSingle();

            if (!existing) {
              // Calculate total cashback earned
              const { data: cashbackData } = await supabase
                .from("payments")
                .select("cashback_amount")
                .eq("user_id", tenancy.user_id)
                .eq("status", "success");

              const totalCashback = (cashbackData ?? [])
                .reduce((sum: number, p: any) => sum + (p.cashback_amount ?? 0), 0);
              const cashbackStr = (totalCashback / 100).toLocaleString("en-IN");

              try {
                await notifyUser(supabaseUrl, serviceKey, {
                  user_id: tenancy.user_id,
                  notification_type: "milestone_streak",
                  template_vars: {
                    streak_months: String(milestone),
                    total_cashback: cashbackStr,
                  },
                  related_entity_type: "tenancy",
                  related_entity_id: tenancy.id,
                });
                await supabase.from("notification_dedup").insert({
                  dedup_key: dedupKey,
                  user_id: tenancy.user_id,
                  notification_type: "milestone_streak",
                }).catch(() => {});
                const existingResult = results.find(r => r.type === `milestone_streak_${milestone}`);
                if (existingResult) existingResult.sent++;
                else results.push({ type: `milestone_streak_${milestone}`, sent: 1, skipped: 0, errors: 0 });
              } catch {
                const existingResult = results.find(r => r.type === `milestone_streak_${milestone}`);
                if (existingResult) existingResult.errors++;
                else results.push({ type: `milestone_streak_${milestone}`, sent: 0, skipped: 0, errors: 1 });
              }
            }
          }
        }
      }
    }

    // ========================================
    // 8. CLEANUP old dedup entries (older than 7 days)
    // ========================================
    await supabase
      .from("notification_dedup")
      .delete()
      .lt("created_at", new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .catch(() => {});

    // Aggregate results
    const totalSent = results.reduce((s, r) => s + r.sent, 0);
    const totalErrors = results.reduce((s, r) => s + r.errors, 0);

    console.log(`[send-reminders] Done: ${totalSent} sent, ${totalErrors} errors`, JSON.stringify(results));

    return jsonResponse({
      success: true,
      sent: totalSent,
      errors: totalErrors,
      breakdown: results,
    });
  } catch (error) {
    console.error("[send-reminders] Fatal error:", error);
    return errorResponse(error instanceof Error ? error.message : "Unknown error", 500);
  }
});
