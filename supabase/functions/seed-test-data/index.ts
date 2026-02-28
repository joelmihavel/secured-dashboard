/**
 * Flent Secured v2 - Seed Test Data Edge Function
 *
 * Seeds or resets a test user to a specific journey state.
 * Used for Apple Review preparation, dev environment setup, and automated testing.
 *
 * Safety:
 *   - Requires service role authentication
 *   - Only works with designated test phone numbers (strict regex)
 *   - Refuses to overwrite real users
 *   - Idempotent (UPSERT semantics)
 *   - Audit-logged
 *
 * Supported target states:
 *   signed_up            - Auth user + users row, nothing else
 *   extraction_confirmed - + extracted_rental_info (confirmed)
 *   waitlisted           - + waitlist_entries (admin_review=due)
 *   waitlisted_rejected  - + waitlist_entries (admin_review=rejected)
 *   approved             - + waitlist (approved) + tenancy (pending_verification)
 *   active               - + tenancy (active) + optional payments/cashback
 *
 * Endpoint: POST /functions/v1/seed-test-data
 * Auth: Service role key (Bearer token)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, verifyServiceRole } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import {
  AppError,
  ValidationError,
  handleError,
} from "../_shared/errors.ts";
import { AuditLogger } from "../_shared/audit.ts";
import {
  seedTestUser,
  TEST_PHONE_REGEX,
  VALID_STATES,
  type TargetState,
  type SeedRequest,
} from "../_shared/seed-helpers.ts";

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Only POST
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  try {
    // Require service role authentication
    const authHeader = req.headers.get("Authorization");
    verifyServiceRole(authHeader);

    const supabase = createServiceClient();
    const audit = AuditLogger.fromRequest(supabase, req, undefined, "seed-test-data");

    // Parse and validate request body
    const body = await req.json() as SeedRequest;

    if (!body.phone || !body.target_state) {
      throw new ValidationError("phone and target_state are required.");
    }

    // Strict test phone validation
    if (!TEST_PHONE_REGEX.test(body.phone)) {
      throw new ValidationError(
        "Only test phone numbers matching +91999990XXXX are allowed.",
        { phone: "Must match +91999990XXXX pattern" }
      );
    }

    if (!VALID_STATES.includes(body.target_state)) {
      throw new ValidationError(
        `Invalid target_state. Must be one of: ${VALID_STATES.join(", ")}`,
        { target_state: "Invalid state" }
      );
    }

    // Simple rate limiting: check last seed invocation in audit_logs (1 per 5s)
    const { data: recentSeed } = await supabase
      .from("audit_logs")
      .select("id")
      .eq("action", "SEED_TEST_DATA")
      .gt("created_at", new Date(Date.now() - 5_000).toISOString())
      .limit(1)
      .maybeSingle();

    if (recentSeed) {
      throw new AppError("Rate limited. Please wait a few seconds.", "RATE_LIMITED", 429);
    }

    // Safety: TEST_PHONE_REGEX already ensures only +91999990XXXX phones reach here.
    // No additional is_test_user check needed — demo phones may have is_test_user=false
    // (only Apple review phones 00001/00002 have is_test_user=true).
    const phoneWithCountryCode = body.phone; // Already includes +91
    const sanitizedPhone = body.phone.replace(/^\+91/, "");

    // Normalize: treat "agreement_confirmed" as "extraction_confirmed"
    const normalizedState = body.target_state === "agreement_confirmed"
      ? "extraction_confirmed" as TargetState
      : body.target_state;

    // Execute seed
    const result = await seedTestUser(
      phoneWithCountryCode,
      sanitizedPhone,
      normalizedState,
      body.options ?? {},
      supabase
    );

    // Audit log
    await audit.logSuccess(
      "SEED_TEST_DATA",
      "system",
      "user",
      result.user_id,
      {
        phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`,
        target_state: body.target_state,
        options: body.options,
      }
    );

    return jsonResponse({
      success: true,
      data: result,
    });
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
