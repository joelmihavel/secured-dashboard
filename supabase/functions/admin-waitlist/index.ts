/**
 * Flent Secured v2 - Edge Function: admin-waitlist
 *
 * Admin-only endpoint for managing waitlist entries.
 * Requires service_role authentication.
 *
 * Actions:
 * - approve: Approve a single user or batch of users
 * - reject: Reject a user with reasons and cooldown
 * - set_in_progress: Mark user(s) as under review
 *
 * Endpoint: POST /functions/v1/admin-waitlist
 * Auth: service_role only
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient, getSupabaseUrl } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, getCorsHeaders } from "../_shared/cors.ts";
import { ValidationError, AuthError, handleError } from "../_shared/errors.ts";
import { AuditLogger } from "../_shared/audit.ts";
import { scheduleNotification } from "../_shared/notifications.ts";
import { ensureTenancyForExtraction } from "../_shared/onboarding.ts";
import { recomputeAndStoreRisk } from "../_shared/risk-utils.ts";

// ==============================================
// TYPES
// ==============================================

type AdminAction = "approve" | "reject" | "set_in_progress";

interface AdminWaitlistRequest {
  admin_key: string;            // ADMIN_API_KEY secret for authentication
  action: AdminAction;
  user_ids: string[];           // One or more user IDs
  rejection_reasons?: string[];
  next_application_hours?: number; // Hours until user can re-apply (default 24)
  admin_note?: string;
}

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const headers = getCorsHeaders(req);

  if (req.method !== "POST") {
    return jsonResponse({ error: true, message: "Method not allowed" }, 405, headers);
  }

  try {
    // Parse body first (need admin_key from body for auth)
    const body: AdminWaitlistRequest = await req.json();

    // Authenticate via admin_key in request body
    // (Supabase relay strips all custom headers and Authorization,
    //  so body-based auth is the only reliable method for admin endpoints)
    const expectedKey = Deno.env.get("ADMIN_API_KEY");
    if (!body.admin_key || !expectedKey || body.admin_key !== expectedKey) {
      throw new AuthError("Unauthorized - invalid admin key");
    }

    const supabase = createServiceClient();
    const audit = AuditLogger.fromRequest(supabase, req, "admin", "admin-waitlist");

    if (!body.action || !["approve", "reject", "set_in_progress"].includes(body.action)) {
      throw new ValidationError("Invalid action. Use 'approve', 'reject', or 'set_in_progress'");
    }

    if (!body.user_ids || !Array.isArray(body.user_ids) || body.user_ids.length === 0) {
      throw new ValidationError("user_ids must be a non-empty array of UUIDs");
    }

    if (body.user_ids.length > 100) {
      throw new ValidationError("Cannot process more than 100 users at once");
    }

    // Validate UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const uid of body.user_ids) {
      if (!uuidRegex.test(uid)) {
        throw new ValidationError(`Invalid UUID: ${uid}`);
      }
    }

    if (body.action === "reject") {
      if (!body.rejection_reasons || body.rejection_reasons.length === 0) {
        throw new ValidationError("rejection_reasons required for reject action");
      }
    }

    // ==============================================
    // EXECUTE ACTION
    // ==============================================

    const results: Array<{ user_id: string; success: boolean; error?: string; warning?: string }> = [];

    if (body.action === "approve") {
      // Guard: block approval if extraction is not completed
      // Prevents tenancy gaps where user is approved but has no extracted data
      const { data: incompleteExtractions } = await supabase
        .from("extracted_rental_info")
        .select("user_id, extraction_status")
        .in("user_id", body.user_ids)
        .neq("extraction_status", "completed");

      // Build set of users whose LATEST extraction is not completed
      const usersWithIncomplete = new Set<string>();
      if (incompleteExtractions && incompleteExtractions.length > 0) {
        // Check each user's latest extraction
        for (const uid of body.user_ids) {
          const { data: latest } = await supabase
            .from("extracted_rental_info")
            .select("extraction_status")
            .eq("user_id", uid)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!latest || latest.extraction_status !== "completed") {
            usersWithIncomplete.add(uid);
          }
        }
      }

      if (usersWithIncomplete.size > 0 && !body.force) {
        // Return error listing which users can't be approved
        for (const uid of body.user_ids) {
          if (usersWithIncomplete.has(uid)) {
            results.push({
              user_id: uid,
              success: false,
              error: "Cannot approve: agreement extraction not completed. Use force=true to override.",
            });
          }
        }
        // Filter out blocked users, continue with the rest
        body.user_ids = body.user_ids.filter((uid: string) => !usersWithIncomplete.has(uid));
        if (body.user_ids.length === 0) {
          return jsonResponse({ success: false, results, message: "No users approved — all have incomplete extractions" });
        }
      }

      // Guard: block approval if user's latest tenancy is not bank-verified.
      // The /(waitlist) screen already enforces this for users (4226462c); the
      // admin path needs the same gate so a sheet edit or web-UI approve can't
      // promote a user past that requirement. No force override — bank
      // verification is a hard prerequisite for being approved.
      const { data: tenancyRows } = await supabase
        .from("tenancies")
        .select("user_id, bank_verified, created_at")
        .in("user_id", body.user_ids)
        .order("created_at", { ascending: false });

      const latestTenancyByUser = new Map<string, { bank_verified: boolean | null }>();
      for (const t of tenancyRows ?? []) {
        if (!latestTenancyByUser.has(t.user_id as string)) {
          latestTenancyByUser.set(t.user_id as string, t as { bank_verified: boolean | null });
        }
      }

      const usersWithoutBank = new Set<string>();
      for (const uid of body.user_ids) {
        const t = latestTenancyByUser.get(uid);
        if (!t || !t.bank_verified) {
          usersWithoutBank.add(uid);
        }
      }

      if (usersWithoutBank.size > 0) {
        for (const uid of body.user_ids) {
          if (usersWithoutBank.has(uid)) {
            const t = latestTenancyByUser.get(uid);
            results.push({
              user_id: uid,
              success: false,
              error: t
                ? "Cannot approve: bank not verified."
                : "Cannot approve: no tenancy yet — user hasn't completed bank verification.",
            });
          }
        }
        body.user_ids = body.user_ids.filter((uid: string) => !usersWithoutBank.has(uid));
        if (body.user_ids.length === 0) {
          return jsonResponse({ success: false, results, message: "No users approved — none have verified bank" });
        }
      }

      // Recompute risk for each user before approval — ensures admin sees freshest data
      for (const uid of body.user_ids) {
        try {
          await recomputeAndStoreRisk(uid, supabase);
        } catch (riskErr) {
          console.error(`[admin-waitlist] Risk recompute failed for ${uid} (non-fatal):`, riskErr);
        }
      }

      // Batch approve
      const { data, error } = await supabase
        .from("waitlist_entries")
        .update({ admin_review: "approved" })
        .in("user_id", body.user_ids)
        .select("user_id");

      if (error) {
        throw new Error(`Batch approve failed: ${error.message}`);
      }

      const approvedIds = new Set((data ?? []).map((r: { user_id: string }) => r.user_id));
      for (const uid of body.user_ids) {
        results.push({
          user_id: uid,
          success: approvedIds.has(uid),
          error: approvedIds.has(uid) ? undefined : "No waitlist entry found",
        });
      }

      // Sync user_status → approved for all successfully approved users
      if (approvedIds.size > 0) {
        const approvedUserIds = Array.from(approvedIds);

        const { error: statusError } = await supabase
          .from("users")
          .update({
            user_status: "approved",
            status_updated_at: new Date().toISOString(),
          })
          .in("id", approvedUserIds);

        if (statusError) {
          console.error("[admin-waitlist] Failed to sync user_status on approve:", statusError);
        }

        const { data: existingTenancies } = await supabase
          .from("tenancies")
          .select("user_id")
          .in("user_id", approvedUserIds);

        const usersWithTenancy = new Set(
          (existingTenancies ?? []).map((row: { user_id: string }) => row.user_id),
        );
        const missingTenancyUserIds = approvedUserIds.filter((uid) => !usersWithTenancy.has(uid));

        const tenancyWarnings = new Map<string, string>();
        if (missingTenancyUserIds.length > 0) {
          // First try: user_verified=true extractions (normal flow)
          const { data: verifiedExtractions, error: extractionError } = await supabase
            .from("extracted_rental_info")
            .select("*")
            .in("user_id", missingTenancyUserIds)
            .eq("extraction_status", "completed")
            .eq("user_verified", true)
            .order("created_at", { ascending: false });

          if (extractionError) {
            console.error("[admin-waitlist] Failed to load verified extractions:", extractionError);
          }

          const latestByUser = new Map<string, Record<string, any>>();
          for (const extraction of verifiedExtractions ?? []) {
            if (!latestByUser.has(extraction.user_id)) {
              latestByUser.set(extraction.user_id as string, extraction);
            }
          }

          // Fallback: for users without verified extractions, try completed+unverified.
          // In the new flow (no review screen), user_verified may not be set yet if
          // finalizeExtractionForOnboarding hasn't run. Still recover the tenancy.
          const stillMissing = missingTenancyUserIds.filter((uid) => !latestByUser.has(uid));
          if (stillMissing.length > 0) {
            const { data: unverifiedExtractions } = await supabase
              .from("extracted_rental_info")
              .select("*")
              .in("user_id", stillMissing)
              .eq("extraction_status", "completed")
              .order("created_at", { ascending: false });

            for (const extraction of unverifiedExtractions ?? []) {
              if (!latestByUser.has(extraction.user_id as string)) {
                latestByUser.set(extraction.user_id as string, extraction);
                console.warn(`[admin-waitlist] Using unverified extraction ${extraction.id} for tenancy recovery of ${extraction.user_id}`);
              }
            }
          }

          for (const userId of missingTenancyUserIds) {
            const extraction = latestByUser.get(userId);
            if (!extraction) {
              console.error(`[admin-waitlist] No extraction available to recover tenancy for ${userId}`);
              tenancyWarnings.set(userId, "No completed extraction found — tenancy not created");
              continue;
            }

            try {
              const { tenancyId, missingFields } = await ensureTenancyForExtraction({
                supabase,
                userId,
                extraction,
                confirmedRole: "tenant",
              });
              if (!tenancyId && missingFields?.length) {
                const msg = `Tenancy not created — extraction missing: ${missingFields.join(", ")}`;
                console.error(`[admin-waitlist] ${msg} for ${userId}`);
                tenancyWarnings.set(userId, msg);
              }
            } catch (tenancyRecoveryError) {
              const msg = tenancyRecoveryError instanceof Error ? tenancyRecoveryError.message : String(tenancyRecoveryError);
              console.error(`[admin-waitlist] Failed to recover tenancy for ${userId}:`, msg);
              tenancyWarnings.set(userId, `Tenancy creation failed: ${msg}`);
            }
          }
        }

        // Attach tenancy warnings to per-user results so admin sees issues
        if (tenancyWarnings.size > 0) {
          for (const r of results) {
            const warn = tenancyWarnings.get(r.user_id);
            if (warn) r.warning = warn;
          }
        }

        // Activate tenancies for approved users (pending_verification → active)
        const { error: tenancyError } = await supabase
          .from("tenancies")
          .update({
            status: "active",
            updated_at: new Date().toISOString(),
          })
          .in("user_id", approvedUserIds)
          .eq("status", "pending_verification");

        if (tenancyError) {
          console.error("[admin-waitlist] Failed to activate tenancies on approve:", tenancyError);
        }
      }

      await audit.logSuccess("WAITLIST_BATCH_APPROVED", "system", "waitlist_entries", undefined, {
        count: approvedIds.size,
        user_ids: body.user_ids,
      });

      // Send push notifications to approved users.
      //
      // Everything below is a post-commit side effect: the waitlist row,
      // users.user_status and the tenancy activation above have already been
      // written. A throw here used to propagate to handleError and return a
      // 500, so the admin saw "approval failed" for an approval that had in
      // fact fully applied — and retrying just re-ran the same writes. Side
      // effects must never decide the outcome of the request.
      try {
      if (approvedIds.size > 0) {
        const supabaseUrl = getSupabaseUrl();
        const serviceKey = (Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;

        // Fetch first names for template
        const { data: users } = await supabase
          .from("users")
          .select("id, first_name")
          .in("id", Array.from(approvedIds));

        const nameMap = new Map((users ?? []).map((u: { id: string; first_name: string }) => [u.id, u.first_name]));

        await Promise.allSettled(
          Array.from(approvedIds).map((uid) =>
            scheduleNotification(supabase, supabaseUrl, serviceKey, {
              user_id: uid,
              notification_type: "waitlist_approved",
              template_vars: { name: nameMap.get(uid) ?? "there" },
            })
          )
        );

        // Schedule setup_incomplete nudge (15 min + 6h reminder)
        await Promise.allSettled(
          Array.from(approvedIds).map((uid) =>
            scheduleNotification(supabase, supabaseUrl, serviceKey, {
              user_id: uid,
              notification_type: "setup_incomplete",
            }).catch((e) => console.warn("[admin-waitlist] Failed to schedule setup_incomplete:", e))
          )
        );

        // Auto-advance to 'active' for users who already have a verified landlord
        // bank (the new pre-waitlist add-bank cohort). The RPC is gated on
        // user_status='approved' AND tenancies.bank_verified=true and is a no-op
        // otherwise, so old-flow users (no bank yet) stay 'approved' as before.
        // Placed after both scheduleNotification calls so the immediate
        // 'waitlist_approved' push fires while user_status is still 'approved'
        // (process-notification-schedule.ts:70 suppresses on !== 'approved').
        await Promise.allSettled(
          Array.from(approvedIds).map(async (uid) => {
            try {
              await supabase.rpc("check_and_advance_to_active", { p_user_id: uid });
            } catch (e) {
              console.warn(`[admin-waitlist] check_and_advance_to_active failed for ${uid}:`, e);
            }
          })
        );
      }
      } catch (sideEffectError) {
        // Approval itself already succeeded — log loudly and still return 200
        // so the admin gets an accurate result. Surfacing the real error here
        // also replaces the masked `TypeError` that handleError was reporting.
        console.error(
          "[admin-waitlist] post-approval side effects failed (non-fatal) —",
          "approval WAS applied for:", Array.from(approvedIds),
          sideEffectError,
        );
      }

    } else if (body.action === "reject") {
      // Default cooldown: 30 days. Admin can override via next_application_hours.
      const cooldownHours = body.next_application_hours ?? 24 * 30;
      const nextApplicationAt = new Date(Date.now() + cooldownHours * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from("waitlist_entries")
        .update({
          admin_review: "rejected",
          rejection_reasons: body.rejection_reasons,
          next_application_at: nextApplicationAt,
        })
        .in("user_id", body.user_ids)
        .select("user_id");

      if (error) {
        throw new Error(`Batch reject failed: ${error.message}`);
      }

      const rejectedIds = new Set((data ?? []).map((r: { user_id: string }) => r.user_id));
      for (const uid of body.user_ids) {
        results.push({
          user_id: uid,
          success: rejectedIds.has(uid),
          error: rejectedIds.has(uid) ? undefined : "No waitlist entry found",
        });
      }

      // Sync user_status → not_eligible for all successfully rejected users
      if (rejectedIds.size > 0) {
        const { error: statusError } = await supabase
          .from("users")
          .update({
            user_status: "not_eligible",
            status_updated_at: new Date().toISOString(),
          })
          .in("id", Array.from(rejectedIds));

        if (statusError) {
          console.error("[admin-waitlist] Failed to sync user_status on reject:", statusError);
        }
      }

      await audit.logSuccess("WAITLIST_BATCH_REJECTED", "system", "waitlist_entries", undefined, {
        count: rejectedIds.size,
        user_ids: body.user_ids,
        rejection_reasons: body.rejection_reasons,
        next_application_at: nextApplicationAt,
      });

      // Send push notifications to rejected users
      if (rejectedIds.size > 0) {
        const supabaseUrl = getSupabaseUrl();
        const serviceKey = (Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;

        await Promise.allSettled(
          Array.from(rejectedIds).map((uid) =>
            scheduleNotification(supabase, supabaseUrl, serviceKey, {
              user_id: uid,
              notification_type: "waitlist_rejected",
            })
          )
        );
      }

    } else if (body.action === "set_in_progress") {
      const { data, error } = await supabase
        .from("waitlist_entries")
        .update({ admin_review: "in_progress" })
        .in("user_id", body.user_ids)
        .select("user_id");

      if (error) {
        throw new Error(`Batch set_in_progress failed: ${error.message}`);
      }

      const updatedIds = new Set((data ?? []).map((r: { user_id: string }) => r.user_id));
      for (const uid of body.user_ids) {
        results.push({
          user_id: uid,
          success: updatedIds.has(uid),
          error: updatedIds.has(uid) ? undefined : "No waitlist entry found",
        });
      }

      await audit.logSuccess("WAITLIST_BATCH_IN_PROGRESS", "system", "waitlist_entries", undefined, {
        count: updatedIds.size,
        user_ids: body.user_ids,
      });
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return jsonResponse({
      success: true,
      data: {
        action: body.action,
        total: body.user_ids.length,
        succeeded: successCount,
        failed: failCount,
        results,
      },
    }, 200, headers);
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
