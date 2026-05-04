/**
 * Flent Secured v2 - Edge Function: claim-invite-code
 *
 * Validates and claims an admin-generated invite code.
 * Code format: 2 letters + 2 digits (4 characters total).
 *
 * Rate limited: max 5 attempts per user per minute.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { handleCors, getCorsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  AuthError,
  ValidationError,
  RateLimitError,
  handleError,
} from "../_shared/errors.ts";

// ==============================================
// VALIDATION
// ==============================================

const CODE_REGEX = /^[A-Z0-9]{4}$/;
const MAX_ATTEMPTS_PER_MINUTE = 5;

function validateCodeFormat(code: string): boolean {
  if (!CODE_REGEX.test(code)) return false;

  // Must have exactly 2 letters and 2 digits
  const letters = code.replace(/[^A-Z]/g, "").length;
  const digits = code.replace(/[^0-9]/g, "").length;
  return letters === 2 && digits === 2;
}

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const headers = getCorsHeaders(req);

  try {
    if (req.method !== "POST") {
      throw new ValidationError("Method not allowed");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = (Deno.env.get("SB_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY"))!;
    const supabaseServiceKey = (Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new AuthError("Missing authorization header");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthError("Unauthorized");
    }

    // Parse request body
    const body = await req.json();
    const code = (body.code ?? "").trim().toUpperCase();

    if (!code) {
      throw new ValidationError("Invite code is required");
    }

    if (!validateCodeFormat(code)) {
      throw new ValidationError(
        "Invalid invite code format. Code must be 4 characters with 2 letters and 2 digits."
      );
    }

    // Service client for privileged operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // ==============================================
    // RATE LIMITING
    // ==============================================

    const { count: recentAttempts } = await adminClient
      .from("invite_code_attempts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("attempted_at", new Date(Date.now() - 60_000).toISOString());

    if ((recentAttempts ?? 0) >= MAX_ATTEMPTS_PER_MINUTE) {
      throw new RateLimitError(60);
    }

    // ==============================================
    // EXTRACTION READINESS GATE (narrowed)
    // ==============================================
    //
    // Fire-and-forget upload flow: the user may submit an invite code while
    // the agreement scan is still running in the background. If extraction
    // hasn't completed yet, we MUST NOT consume the code — return
    // EXTRACTION_NOT_READY so the client surfaces a retry message and the
    // code stays unused.
    //
    // Narrowed in PR-1: the gate now fires only when extraction_status is
    // anything other than 'completed' (i.e. pending, processing, failed,
    // extraction_failed). It NO LONGER bails on contract_status ∈
    // {manual_review, invalid_document, expired, missing_stamp_paper}:
    //   - For non-VIP users, the RPC's use_count/admin_review queue handles
    //     those rows naturally — they get counted but stay in admin_review
    //     until a human resolves the contract_status.
    //   - For VIP users, the RPC promotes them anyway by design (admin queue
    //     and extraction quality are intentionally bypassed for VIP).
    // Defense-in-depth lives in the RPC itself (see the EXTRACTION_NOT_READY
    // and bank+PAN checks in claim_invite_code).
    const { data: extraction, error: extractionLookupError } = await adminClient
      .from("extracted_rental_info")
      .select("extraction_status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (extractionLookupError) {
      console.error("[claim-invite-code] extraction lookup failed:", extractionLookupError);
      return jsonResponse(
        {
          success: false,
          error: true,
          code: "INTERNAL_ERROR",
          message: "Could not verify your agreement status. Please try again.",
        },
        500,
        headers
      );
    }

    const extractionReady =
      !!extraction && extraction.extraction_status === "completed";

    if (!extractionReady) {
      // Log the attempt so it shows up in rate-limit accounting (the user is
      // hitting the endpoint legitimately, just early). Do NOT consume the code.
      await adminClient.from("invite_code_attempts").insert({
        user_id: user.id,
        code_attempted: code,
        was_valid: false,
      }).catch(() => {});

      return jsonResponse(
        {
          success: false,
          error: true,
          code: "EXTRACTION_NOT_READY",
          message: "Your agreement is still being scanned. Please wait a moment and try again.",
        },
        409,
        headers
      );
    }

    // ==============================================
    // CLAIM CODE (atomic via RPC)
    // ==============================================

    const { data: claimResult, error: claimError } = await adminClient.rpc(
      "claim_invite_code",
      {
        p_user_id: user.id,
        p_code: code,
      }
    );

    // Log attempt
    const wasValid = claimResult?.[0]?.success === true;
    await adminClient.from("invite_code_attempts").insert({
      user_id: user.id,
      code_attempted: code,
      was_valid: wasValid,
    });

    if (claimError) {
      console.error("Claim RPC error:", claimError);
      return jsonResponse(
        {
          success: false,
          error: true,
          code: "INTERNAL_ERROR",
          message: "Failed to validate invite code",
        },
        500,
        headers
      );
    }

    const result = claimResult?.[0];

    if (!result?.success) {
      return jsonResponse(
        {
          success: false,
          error: true,
          code: result?.error_code ?? "INVALID_CODE",
          message: result?.error_message ?? "This invite code is not valid",
        },
        400,
        headers
      );
    }

    // ==============================================
    // SUCCESS
    // ==============================================
    //
    // VIP promotion is now handled atomically inside the claim_invite_code RPC.
    // The RPC has already done all of:
    //   - waitlist_entries.admin_review = 'approved'
    //   - users.user_status = 'approved' (with NOT IN-terminal guard)
    //   - check_and_advance_to_active() — flips to 'active' if bank already verified
    // …all in the same transaction as code consumption. The result row tells us
    // whether the user was actually promoted (auto_approved=true) so we can
    // surface the correct copy. Migration 20260501160000 owns this contract.
    const autoApproved = result.auto_approved === true;
    if (autoApproved) {
      console.log(`[claim-invite-code] VIP code ${code} — auto-approved user ${user.id}`);
    }

    return jsonResponse(
      {
        success: true,
        data: {
          code,
          auto_approved: autoApproved,
          message: autoApproved
            ? "You're in! Your application has been approved."
            : "Invite code accepted! Your application is under review.",
        },
      },
      200,
      headers
    );
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
