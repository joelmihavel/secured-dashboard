/**
 * Flent Secured v2 - Join Waitlist Edge Function
 *
 * Idempotently creates a waitlist entry for the authenticated user.
 * If the user already has an entry, returns the existing one.
 *
 * Endpoint: POST /functions/v1/join-waitlist
 * Auth: Required (JWT)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     entry_id: string,
 *     position: number,
 *     is_new: boolean
 *   }
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient, createAuthenticatedClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, getCorsHeaders } from "../_shared/cors.ts";
import { handleError } from "../_shared/errors.ts";
import { AuditLogger } from "../_shared/audit.ts";
import { ensureWaitlistState, maybeAutoApproveDemoUser } from "../_shared/onboarding.ts";

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const headers = getCorsHeaders(req);

  if (req.method !== "POST") {
    return jsonResponse(
      { error: true, message: "Method not allowed", code: "METHOD_NOT_ALLOWED" },
      405,
      headers
    );
  }

  const supabase = createServiceClient();
  let audit: AuditLogger | null = null;
  let userId: string | null = null;

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const { userId: uid } = await createAuthenticatedClient(authHeader);
    userId = uid;

    // Initialize audit logger
    audit = AuditLogger.fromRequest(supabase, req, userId, "join-waitlist");

    // Gate check: user must have confirmed their agreement before joining waitlist
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("user_status")
      .eq("id", userId)
      .single();

    if (userError || !userData) {
      console.error("[join-waitlist] Failed to fetch user status:", userError);
      throw new Error("Failed to verify user status");
    }

    // Allow if user is already waitlisted or beyond (idempotent)
    const allowedStatuses = ["signed_up", "agreement_confirmed", "waitlisted", "approved", "active"];
    if (!allowedStatuses.includes(userData.user_status)) {
      return jsonResponse(
        {
          success: false,
          error: true,
          code: "AGREEMENT_NOT_CONFIRMED",
          message: "You must confirm your agreement details before joining the waitlist",
        },
        403,
        headers
      );
    }

    const result = await ensureWaitlistState({
      supabase,
      userId,
      currentUserStatus: userData.user_status,
    });

    // ── DEMO AUTO-APPROVAL ──────────────────────────────────────────
    // Test users bypass admin review — instant approval for Apple Review flow.
    const demoResult = await maybeAutoApproveDemoUser({
      supabase,
      userId,
      waitlistEntryId: result.entryId,
    });
    if (demoResult.autoApproved) {
      await audit.logSuccess(
        "WAITLIST_DEMO_AUTO_APPROVED",
        "system",
        "waitlist_entries",
        result.entryId,
        { demo: true, position: result.position }
      );
    }
    // ── END DEMO AUTO-APPROVAL ──────────────────────────────────────

    // Log audit event
    if (result.isNew) {
      await audit.logSuccess(
        "WAITLIST_JOINED",
        "system",
        "waitlist_entries",
        result.entryId,
        { position: result.position }
      );
    }

    return jsonResponse(
      {
        success: true,
        data: {
          entry_id: result.entryId,
          position: result.position,
          is_new: result.isNew,
        },
      },
      200,
      headers
    );
  } catch (error) {
    if (audit && userId) {
      await audit.logFailure(
        "WAITLIST_JOIN_FAILED",
        "system",
        error instanceof Error ? error.message : "Unknown error",
        "Failed to join waitlist",
        "user",
        userId
      );
    }
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
