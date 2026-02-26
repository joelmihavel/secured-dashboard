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
 *   agreement_confirmed  - + agreement + confirmed extraction
 *   waitlisted           - + waitlist entry (pending)
 *   waitlisted_rejected  - + waitlist entry (rejected)
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

// ==============================================
// CONFIGURATION
// ==============================================

// Only test phone numbers matching this pattern are allowed
const TEST_PHONE_REGEX = /^\+91999990\d{4}$/;

// Valid target states (ordered by journey progression)
const VALID_STATES = [
  "signed_up",
  "agreement_confirmed",
  "waitlisted",
  "waitlisted_rejected",
  "approved",
  "active",
] as const;

type TargetState = typeof VALID_STATES[number];

interface SeedRequest {
  phone: string;
  target_state: TargetState;
  options?: {
    with_payment_history?: boolean;
    payment_count?: number;
    with_cashback?: boolean;
  };
}

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

    // Safety check: refuse to overwrite a real user
    const phoneWithCountryCode = body.phone; // Already includes +91
    const sanitizedPhone = body.phone.replace(/^\+91/, "");

    const { data: existingAuthUser } = await supabase.auth.admin.listUsers();
    const matchingUser = existingAuthUser?.users?.find(
      (u) => u.phone === phoneWithCountryCode || u.phone === `+91${sanitizedPhone}`
    );

    if (matchingUser && matchingUser.user_metadata?.is_test_user !== true) {
      // Check if user exists in users table as well
      const { data: existingProfile } = await supabase
        .from("users")
        .select("id")
        .or(`phone.eq.${phoneWithCountryCode},phone.eq.${sanitizedPhone}`)
        .maybeSingle();

      if (existingProfile) {
        throw new AppError(
          "Phone number belongs to a real user. Refusing to overwrite. " +
          "If this is actually a test user, set user_metadata.is_test_user = true first.",
          "SAFETY_BLOCK",
          403
        );
      }
    }

    // Execute seed
    const result = await seedTestUser(
      body.phone,
      sanitizedPhone,
      body.target_state,
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

// ==============================================
// SEED LOGIC
// ==============================================

interface SeedResult {
  user_id: string;
  phone: string;
  target_state: string;
  created_entities: string[];
  cleaned_entities: string[];
}

async function seedTestUser(
  phoneWithCountryCode: string,
  sanitizedPhone: string,
  targetState: TargetState,
  options: SeedRequest["options"] & {},
  supabase: ReturnType<typeof createServiceClient>
): Promise<SeedResult> {
  const created: string[] = [];
  const cleaned: string[] = [];

  // Step 1: Create or find the auth user
  const userId = await ensureAuthUser(phoneWithCountryCode, supabase);
  created.push("auth_user");

  // Step 2: Upsert the users profile row
  await upsertUserProfile(userId, phoneWithCountryCode, sanitizedPhone, supabase);
  created.push("user_profile");

  // Step 3: Clean downstream data that may conflict with target state
  // Always clean everything below the target state level to ensure idempotency
  const stateIndex = VALID_STATES.indexOf(targetState);

  // Clean payments (only exist in 'active' state)
  const { data: deletedPayments } = await supabase
    .from("payments")
    .delete()
    .eq("user_id", userId)
    .select("id");
  if (deletedPayments?.length) cleaned.push(`payments(${deletedPayments.length})`);

  // Clean tenancies (exist in 'approved' and 'active')
  if (stateIndex < VALID_STATES.indexOf("approved")) {
    const { data: deletedTenancies } = await supabase
      .from("tenancies")
      .delete()
      .eq("user_id", userId)
      .select("id");
    if (deletedTenancies?.length) cleaned.push(`tenancies(${deletedTenancies.length})`);
  }

  // Clean waitlist (exists in 'waitlisted', 'waitlisted_rejected', 'approved', 'active')
  if (stateIndex < VALID_STATES.indexOf("waitlisted")) {
    const { data: deletedWaitlist } = await supabase
      .from("waitlist")
      .delete()
      .eq("user_id", userId)
      .select("id");
    if (deletedWaitlist?.length) cleaned.push(`waitlist(${deletedWaitlist.length})`);
  }

  // Clean agreements + extractions (exist in 'agreement_confirmed' and above)
  if (stateIndex < VALID_STATES.indexOf("agreement_confirmed")) {
    // Delete extractions first (FK to agreements)
    const { data: userAgreements } = await supabase
      .from("agreements")
      .select("id")
      .eq("user_id", userId);

    if (userAgreements?.length) {
      for (const agr of userAgreements) {
        await supabase.from("agreement_extractions").delete().eq("agreement_id", agr.id);
      }
      await supabase.from("agreements").delete().eq("user_id", userId);
      cleaned.push(`agreements(${userAgreements.length})`);
    }
  }

  // Step 4: Build up the state progressively
  if (stateIndex >= VALID_STATES.indexOf("agreement_confirmed")) {
    await ensureAgreement(userId, supabase);
    created.push("agreement", "agreement_extraction");
  }

  if (stateIndex >= VALID_STATES.indexOf("waitlisted")) {
    const waitlistStatus =
      targetState === "waitlisted_rejected" ? "rejected" :
      stateIndex >= VALID_STATES.indexOf("approved") ? "approved" :
      "pending";
    await ensureWaitlist(userId, waitlistStatus, supabase);
    created.push(`waitlist(${waitlistStatus})`);
  }

  if (stateIndex >= VALID_STATES.indexOf("approved")) {
    const tenancyStatus = targetState === "active" ? "active" : "pending_verification";
    const tenancyId = await ensureTenancy(userId, tenancyStatus, supabase);
    created.push(`tenancy(${tenancyStatus})`);

    if (targetState === "active" && options.with_payment_history) {
      const count = options.payment_count ?? 3;
      await seedPayments(userId, tenancyId, count, options.with_cashback ?? false, supabase);
      created.push(`payments(${count})`);
    }
  }

  return {
    user_id: userId,
    phone: phoneWithCountryCode,
    target_state: targetState,
    created_entities: created,
    cleaned_entities: cleaned,
  };
}

// ==============================================
// ENTITY HELPERS
// ==============================================

/**
 * Ensures an auth user exists for the test phone. Returns the user ID.
 * If the user already exists, returns their ID. If not, creates them.
 */
async function ensureAuthUser(
  phoneWithCountryCode: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<string> {
  // Try to create user; if already exists, find them
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    phone: phoneWithCountryCode,
    phone_confirm: true,
    user_metadata: {
      is_test_user: true,
      full_name: "Test User",
    },
  });

  if (authError?.message?.includes("already been registered")) {
    // Find existing user
    const { data: listData } = await supabase.auth.admin.listUsers();
    const existing = listData?.users?.find(
      (u) => u.phone === phoneWithCountryCode
    );

    if (!existing) {
      throw new AppError("Auth user exists but could not be found", "USER_LOOKUP_FAILED", 500);
    }

    // Ensure is_test_user metadata is set
    if (existing.user_metadata?.is_test_user !== true) {
      await supabase.auth.admin.updateUserById(existing.id, {
        user_metadata: { ...existing.user_metadata, is_test_user: true },
      });
    }

    return existing.id;
  }

  if (authError) {
    throw new AppError(`Failed to create auth user: ${authError.message}`, "AUTH_CREATE_FAILED", 500);
  }

  return authData.user!.id;
}

/**
 * Upserts the users profile row.
 */
async function upsertUserProfile(
  userId: string,
  phoneWithCountryCode: string,
  sanitizedPhone: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<void> {
  const { error } = await supabase
    .from("users")
    .upsert(
      {
        id: userId,
        phone: phoneWithCountryCode,
        full_name: "Test User",
        first_name: "Test",
        last_name: "User",
      },
      { onConflict: "id" }
    );

  if (error) {
    console.error("[seed-test-data] Failed to upsert user profile:", error);
    throw new AppError("Failed to upsert user profile", "PROFILE_UPSERT_FAILED", 500);
  }
}

/**
 * Ensures an agreement + confirmed extraction exist for the user.
 */
async function ensureAgreement(
  userId: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<string> {
  // Check for existing agreement
  const { data: existing } = await supabase
    .from("agreements")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing.id;

  // Create agreement
  const { data: agreement, error: agrError } = await supabase
    .from("agreements")
    .insert({
      user_id: userId,
      status: "confirmed",
      uploaded_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (agrError || !agreement) {
    throw new AppError("Failed to create agreement", "AGREEMENT_CREATE_FAILED", 500);
  }

  // Create confirmed extraction
  const { error: extError } = await supabase
    .from("agreement_extractions")
    .insert({
      agreement_id: agreement.id,
      status: "confirmed",
      extraction_data: {
        tenant_name: "Test User",
        landlord_name: "Demo Landlord",
        property_address: "42 MG Road, Bengaluru, Karnataka 560001",
        monthly_rent: 25000,
        lease_start_date: "2025-01-01",
        lease_end_date: "2026-12-31",
        security_deposit: 75000,
      },
    });

  if (extError) {
    console.error("[seed-test-data] Failed to create extraction:", extError);
  }

  return agreement.id;
}

/**
 * Ensures a waitlist entry exists for the user.
 */
async function ensureWaitlist(
  userId: string,
  status: "pending" | "approved" | "rejected",
  supabase: ReturnType<typeof createServiceClient>
): Promise<void> {
  // Delete any existing waitlist entry, then insert fresh
  await supabase.from("waitlist").delete().eq("user_id", userId);

  const { error } = await supabase
    .from("waitlist")
    .insert({
      user_id: userId,
      status,
      position: status === "pending" ? 42 : null,
      batch_number: status === "approved" ? 1 : null,
      applied_at: new Date().toISOString(),
    });

  if (error) {
    console.error("[seed-test-data] Failed to create waitlist entry:", error);
    throw new AppError("Failed to create waitlist entry", "WAITLIST_CREATE_FAILED", 500);
  }
}

/**
 * Ensures a tenancy exists for the user. Returns the tenancy ID.
 */
async function ensureTenancy(
  userId: string,
  status: "pending_verification" | "active",
  supabase: ReturnType<typeof createServiceClient>
): Promise<string> {
  // Delete existing tenancies, then create fresh
  await supabase.from("tenancies").delete().eq("user_id", userId);

  const now = new Date();
  const leaseStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const leaseEnd = new Date(now.getFullYear() + 1, now.getMonth() + 9, 0);

  const verificationStatus = status === "active"
    ? { bank: true, utility: true, landlord: true }
    : { bank: false, utility: false, landlord: false };

  const { data: tenancy, error } = await supabase
    .from("tenancies")
    .insert({
      user_id: userId,
      status,
      property_address: "42 MG Road, Bengaluru, Karnataka 560001",
      property_city: "Bengaluru",
      monthly_rent_paise: 2500000, // 25,000 INR
      rent_due_day: 5,
      landlord_name: "Demo Landlord",
      landlord_phone: "+919876543210",
      lease_start_date: leaseStart.toISOString().split("T")[0],
      lease_end_date: leaseEnd.toISOString().split("T")[0],
      cashback_cutoff_day: 5,
      bank_verified: verificationStatus.bank,
      utility_verified: verificationStatus.utility,
      landlord_approved: verificationStatus.landlord,
    })
    .select("id")
    .single();

  if (error || !tenancy) {
    console.error("[seed-test-data] Failed to create tenancy:", error);
    throw new AppError("Failed to create tenancy", "TENANCY_CREATE_FAILED", 500);
  }

  return tenancy.id;
}

/**
 * Seeds payment history for the active tenancy.
 */
async function seedPayments(
  userId: string,
  tenancyId: string,
  count: number,
  withCashback: boolean,
  supabase: ReturnType<typeof createServiceClient>
): Promise<void> {
  // Clear existing payments for this tenancy
  await supabase.from("payments").delete().eq("tenancy_id", tenancyId);

  const now = new Date();
  const payments = [];

  for (let i = 0; i < count; i++) {
    const paymentDate = new Date(now.getFullYear(), now.getMonth() - (count - i), 6);
    const rentMonth = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, "0")}`;
    const cashbackEarned = withCashback ? Math.floor(2500000 * 0.01) : 0; // 1% cashback on 25k

    payments.push({
      user_id: userId,
      tenancy_id: tenancyId,
      amount_paise: 2500000,
      pg_fee_paise: 59000, // ~2.36% processing fee
      cashback_applied_paise: i > 0 && withCashback ? cashbackEarned : 0, // Apply previous month cashback
      status: "success",
      payment_method: "upi",
      idempotency_key: `seed_${sanitizeForIdempotency(userId)}_${rentMonth}`,
      rent_month: rentMonth,
      paid_at: paymentDate.toISOString(),
    });
  }

  const { error } = await supabase.from("payments").insert(payments);

  if (error) {
    console.error("[seed-test-data] Failed to seed payments:", error);
    throw new AppError("Failed to seed payments", "PAYMENTS_CREATE_FAILED", 500);
  }
}

/**
 * Sanitizes a string for use in an idempotency key.
 */
function sanitizeForIdempotency(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 32);
}
