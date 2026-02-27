/**
 * Flent Secured v2 - Dev Seed Edge Function
 *
 * Thin proxy for client-side Jump-to-Screen functionality.
 * Callable with anon key (no service role needed from client).
 * Internally uses service role to seed test data.
 *
 * Safety:
 *   - ALLOW_DEMO_AUTH env must be "true"
 *   - Phone must match test phone pattern (+91999990XXXX)
 *   - Same guards as auth-otp demo path
 *   - No service key in request or response
 *
 * Endpoint: POST /functions/v1/dev-seed
 * Auth: Anon key (apikey header)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { handleError, ValidationError, AppError } from "../_shared/errors.ts";
import {
  seedTestUser,
  TEST_PHONE_REGEX,
  VALID_STATES,
  type TargetState,
  type SeedOptions,
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
    // Guard 1: ALLOW_DEMO_AUTH must be enabled
    const allowDemo = Deno.env.get("ALLOW_DEMO_AUTH");
    if (allowDemo !== "true") {
      throw new AppError(
        "Dev seeding is not enabled in this environment.",
        "DEV_SEED_DISABLED",
        403
      );
    }

    // Parse request body
    const body = await req.json();
    const phone: string = body.phone;
    const targetState: string = body.target_state;
    const options: SeedOptions = body.options ?? {};

    // Validate required fields
    if (!phone || !targetState) {
      throw new ValidationError("phone and target_state are required.");
    }

    // Guard 2: Strict test phone validation
    if (!TEST_PHONE_REGEX.test(phone)) {
      throw new ValidationError(
        "Only test phone numbers matching +91999990XXXX are allowed.",
        { phone: "Must match +91999990XXXX pattern" }
      );
    }

    // Validate target state
    if (!VALID_STATES.includes(targetState as TargetState)) {
      throw new ValidationError(
        `Invalid target_state. Must be one of: ${VALID_STATES.join(", ")}`,
        { target_state: "Invalid state" }
      );
    }

    // Normalize: treat "agreement_confirmed" as "extraction_confirmed"
    const normalizedState = targetState === "agreement_confirmed"
      ? "extraction_confirmed" as TargetState
      : targetState as TargetState;

    const sanitizedPhone = phone.replace(/^\+91/, "");

    // Safety check: refuse to overwrite a real user
    const supabase = createServiceClient();

    const { data: existingProfile } = await supabase
      .from("users")
      .select("id, is_test_user")
      .eq("phone", phone)
      .maybeSingle();

    if (existingProfile && existingProfile.is_test_user !== true) {
      throw new AppError(
        "Phone number belongs to a real user. Refusing to overwrite.",
        "SAFETY_BLOCK",
        403
      );
    }

    // Execute seed using shared helpers (service role, server-side only)
    const result = await seedTestUser(
      phone,
      sanitizedPhone,
      normalizedState,
      options,
      supabase
    );

    return jsonResponse({
      success: true,
      data: result,
    });
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
