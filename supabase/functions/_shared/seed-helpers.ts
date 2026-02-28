/**
 * Shared seed helpers for test data seeding.
 *
 * Used by both `seed-test-data` (service-role authenticated)
 * and `dev-seed` (anon-key proxy for client-side Jump-to-Screen).
 */

import { createServiceClient } from "./supabase.ts";
import { AppError } from "./errors.ts";

// ==============================================
// CONFIGURATION
// ==============================================

export const TEST_PHONE_REGEX = /^\+91999990\d{4}$/;

/** Apple review phones — only these get is_test_user=true (bypasses PayU/Cashfree). */
const APPLE_REVIEW_PHONES = new Set(["+919999900001", "+919999900002"]);

export const VALID_STATES = [
  "signed_up",
  "agreement_confirmed",
  "extraction_confirmed",
  "waitlisted",
  "waitlisted_rejected",
  "approved",
  "active",
] as const;

export type TargetState = typeof VALID_STATES[number];

export interface SeedOptions {
  with_payment_history?: boolean;
  payment_count?: number;
  with_cashback?: boolean;
  with_saved_methods?: boolean;
  bank_verified?: boolean;
  utility_verified?: boolean;
  landlord_approved?: boolean;
}

export interface SeedRequest {
  phone: string;
  target_state: TargetState;
  options?: SeedOptions;
}

export type SupabaseClient = ReturnType<typeof createServiceClient>;

// ==============================================
// SEED RESULT
// ==============================================

export interface SeedResult {
  user_id: string;
  phone: string;
  target_state: string;
  created_entities: string[];
  cleaned_entities: string[];
}

// ==============================================
// MAIN ORCHESTRATOR
// ==============================================

export async function seedTestUser(
  phoneWithCountryCode: string,
  sanitizedPhone: string,
  targetState: TargetState,
  options: SeedOptions,
  supabase: SupabaseClient
): Promise<SeedResult> {
  const created: string[] = [];
  const cleaned: string[] = [];

  // Determine if this phone qualifies for test-user bypass (Apple review only)
  const isAppleReview = APPLE_REVIEW_PHONES.has(phoneWithCountryCode);

  // Step 1: Create or find the auth user
  const userId = await ensureAuthUser(phoneWithCountryCode, supabase, isAppleReview);
  created.push("auth_user");

  // Step 2: Upsert the users profile row
  await upsertUserProfile(userId, phoneWithCountryCode, sanitizedPhone, targetState, supabase, isAppleReview);
  created.push("user_profile");

  // Step 3: Clean downstream data that may conflict with target state
  const stateIndex = VALID_STATES.indexOf(targetState);

  // Clean payments first (FK to tenancies)
  const { data: deletedPayments } = await supabase
    .from("payments")
    .delete()
    .eq("user_id", userId)
    .select("id");
  if (deletedPayments?.length) cleaned.push(`payments(${deletedPayments.length})`);

  // Clean cashback_ledger
  const { data: deletedCashback } = await supabase
    .from("cashback_ledger")
    .delete()
    .eq("user_id", userId)
    .select("id");
  if (deletedCashback?.length) cleaned.push(`cashback(${deletedCashback.length})`);

  // Clean payment_methods
  const { data: deletedSavedMethods } = await supabase
    .from("payment_methods")
    .delete()
    .eq("user_id", userId)
    .select("id");
  if (deletedSavedMethods?.length) cleaned.push(`payment_methods(${deletedSavedMethods.length})`);

  // Clean tenancies (exist in 'approved' and 'active')
  if (stateIndex < VALID_STATES.indexOf("approved")) {
    const { data: deletedTenancies } = await supabase
      .from("tenancies")
      .delete()
      .eq("user_id", userId)
      .select("id");
    if (deletedTenancies?.length) cleaned.push(`tenancies(${deletedTenancies.length})`);
  }

  // Clean waitlist_entries
  if (stateIndex < VALID_STATES.indexOf("waitlisted")) {
    const { data: deletedWaitlist } = await supabase
      .from("waitlist_entries")
      .delete()
      .eq("user_id", userId)
      .select("id");
    if (deletedWaitlist?.length) cleaned.push(`waitlist_entries(${deletedWaitlist.length})`);
  }

  // Clean extracted_rental_info
  if (stateIndex < VALID_STATES.indexOf("extraction_confirmed")) {
    const { data: deletedExtractions } = await supabase
      .from("extracted_rental_info")
      .delete()
      .eq("user_id", userId)
      .select("id");
    if (deletedExtractions?.length) cleaned.push(`extractions(${deletedExtractions.length})`);
  }

  // Step 4: Build up the state progressively
  let extractionId: string | null = null;

  if (stateIndex >= VALID_STATES.indexOf("extraction_confirmed")) {
    extractionId = await ensureExtraction(userId, supabase);
    created.push("extracted_rental_info");
  }

  if (stateIndex >= VALID_STATES.indexOf("waitlisted")) {
    const adminReview =
      targetState === "waitlisted_rejected" ? "rejected" :
      stateIndex >= VALID_STATES.indexOf("approved") ? "approved" :
      "due";
    await ensureWaitlistEntry(userId, adminReview, extractionId, supabase);
    created.push(`waitlist_entries(${adminReview})`);
  }

  if (stateIndex >= VALID_STATES.indexOf("approved")) {
    const isActive = targetState === "active";
    const tenancyStatus = isActive ? "active" : "pending_verification";

    // Allow option overrides for verification fields
    const bankVerified = options.bank_verified ?? isActive;
    const utilityVerified = options.utility_verified ?? isActive;
    const landlordApproved = options.landlord_approved ?? isActive;

    const tenancyId = await ensureTenancy(
      userId, tenancyStatus, extractionId, supabase,
      bankVerified, utilityVerified, landlordApproved
    );
    created.push(`tenancy(${tenancyStatus})`);

    // Seed bank account for active state (landlord bank must be verified)
    if (isActive) {
      await supabase.from("bank_accounts").delete().eq("user_id", userId).eq("party_type", "landlord");
      const { error: bankErr } = await supabase.from("bank_accounts").insert({
        user_id: userId,
        party_type: "landlord",
        account_holder_name: "Demo Landlord",
        account_number_encrypted: "SEED_DEMO_00001234",
        account_number_masked: "XXXX XXXX 1234",
        ifsc_code: "HDFC0001234",
        verified: true,
        penny_drop_status: "SUCCESS",
        penny_drop_name_match_score: 100,
        verified_account_holder_name: "Demo Landlord",
        verified_at: new Date().toISOString(),
        is_primary: true,
        agreement_name_matched: true,
      });
      if (bankErr) {
        console.warn("[seed-helpers] Failed to seed bank account:", bankErr.message);
      } else {
        created.push("bank_account(landlord)");
      }
    }

    if (isActive && (options.with_payment_history ?? true)) {
      const count = options.payment_count ?? 3;
      await seedPayments(userId, tenancyId, count, options.with_cashback ?? false, supabase);
      created.push(`payments(${count})`);
    }

    // Seed saved payment methods (default true for active state)
    const shouldSeedMethods = options.with_saved_methods ?? isActive;
    if (shouldSeedMethods) {
      await ensureSavedPaymentMethods(userId, supabase);
      created.push("payment_methods");
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

export async function ensureAuthUser(
  phoneWithCountryCode: string,
  supabase: SupabaseClient,
  isAppleReview: boolean = false
): Promise<string> {
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    phone: phoneWithCountryCode,
    phone_confirm: true,
    user_metadata: {
      is_test_user: isAppleReview,
      full_name: "Test User",
    },
  });

  if (authError?.message?.includes("already") && authError?.message?.includes("registered")) {
    const { data: profileRow } = await supabase
      .from("users")
      .select("id")
      .eq("phone", phoneWithCountryCode)
      .maybeSingle();

    let existingId = profileRow?.id;

    if (!existingId) {
      let page = 1;
      while (!existingId && page <= 20) {
        const { data: listData } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
        if (!listData?.users?.length) break;
        const match = listData.users.find((u) => u.phone === phoneWithCountryCode);
        if (match) { existingId = match.id; break; }
        if (listData.users.length < 100) break;
        page++;
      }
    }

    if (!existingId) {
      throw new AppError(
        `Auth user with phone ${phoneWithCountryCode} exists but could not be resolved. ` +
        `Try deleting via Supabase dashboard and re-running.`,
        "USER_LOOKUP_FAILED", 500
      );
    }

    await supabase.auth.admin.updateUserById(existingId, {
      user_metadata: { is_test_user: isAppleReview, full_name: "Test User" },
    });

    return existingId;
  }

  if (authError) {
    throw new AppError(`Failed to create auth user: ${authError.message}`, "AUTH_CREATE_FAILED", 500);
  }

  return authData.user!.id;
}

export async function upsertUserProfile(
  userId: string,
  phoneWithCountryCode: string,
  sanitizedPhone: string,
  targetState: TargetState,
  supabase: SupabaseClient,
  isAppleReview: boolean = false
): Promise<void> {
  const stateIndex = VALID_STATES.indexOf(targetState);
  const userStatus =
    targetState === "active" ? "active" :
    stateIndex >= VALID_STATES.indexOf("approved") ? "approved" :
    stateIndex >= VALID_STATES.indexOf("waitlisted") ? "waitlisted" :
    "signed_up";

  const { error } = await supabase
    .from("users")
    .upsert(
      {
        id: userId,
        phone: phoneWithCountryCode,
        phone_number: sanitizedPhone,
        full_name: "Test User",
        first_name: "Test",
        last_name: "User",
        is_test_user: isAppleReview,
        user_status: userStatus,
        role: "tenant",
        is_active: true,
      },
      { onConflict: "id" }
    );

  if (error) {
    throw new AppError(`Failed to upsert user profile: ${error.message}`, "PROFILE_UPSERT_FAILED", 500);
  }
}

export async function ensureExtraction(
  userId: string,
  supabase: SupabaseClient
): Promise<string> {
  const { data: existing } = await supabase
    .from("extracted_rental_info")
    .select("id")
    .eq("user_id", userId)
    .eq("extraction_status", "completed")
    .maybeSingle();

  if (existing) return existing.id;

  const now = new Date();
  const leaseStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const leaseEnd = new Date(now.getFullYear() + 1, now.getMonth() + 9, 0);

  const { data: extraction, error } = await supabase
    .from("extracted_rental_info")
    .insert({
      user_id: userId,
      document_storage_path: "test/seed-agreement.pdf",
      document_type: "lease_agreement",
      original_filename: "seed-agreement.pdf",
      extraction_status: "completed",
      extraction_confidence: 0.95,
      user_verified: true,
      verified_at: now.toISOString(),
      tenant_name: "Test User",
      landlord_name: "Demo Landlord",
      landlord_phone: "+919876543210",
      property_address: "42 MG Road, Bengaluru, Karnataka 560001",
      property_city: "Bengaluru",
      property_state: "Karnataka",
      property_pincode: "560001",
      monthly_rent_paise: 2500000,
      security_deposit_paise: 7500000,
      rent_due_day: 5,
      lease_start_date: leaseStart.toISOString().split("T")[0],
      lease_end_date: leaseEnd.toISOString().split("T")[0],
    })
    .select("id")
    .single();

  if (error || !extraction) {
    throw new AppError(`Failed to create extraction: ${error?.message ?? "no data"}`, "EXTRACTION_CREATE_FAILED", 500);
  }

  return extraction.id;
}

export async function ensureWaitlistEntry(
  userId: string,
  adminReview: "due" | "approved" | "rejected",
  extractionId: string | null,
  supabase: SupabaseClient
): Promise<void> {
  await supabase.from("waitlist_entries").delete().eq("user_id", userId);

  const { error } = await supabase
    .from("waitlist_entries")
    .insert({
      user_id: userId,
      waitlist_position: adminReview === "approved" ? 1 : 42,
      status: adminReview === "approved" ? "approved" : "pending_review",
      admin_review: adminReview,
      extraction_id: extractionId,
      extraction_status: "completed",
      contract_status: "confirmed",
      priority_boost: 0,
      batch_number: adminReview === "approved" ? 1 : null,
    });

  if (error) {
    throw new AppError(`Failed to create waitlist entry: ${error.message}`, "WAITLIST_CREATE_FAILED", 500);
  }
}

export async function ensureTenancy(
  userId: string,
  status: "pending_verification" | "active",
  extractionId: string | null,
  supabase: SupabaseClient,
  bankVerified: boolean = status === "active",
  utilityVerified: boolean = status === "active",
  landlordApproved: boolean = status === "active"
): Promise<string> {
  await supabase.from("tenancies").delete().eq("user_id", userId);

  const now = new Date();
  const leaseStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const leaseEnd = new Date(now.getFullYear() + 1, now.getMonth() + 9, 0);

  const { data: tenancy, error } = await supabase
    .from("tenancies")
    .insert({
      user_id: userId,
      extracted_rental_info_id: extractionId,
      status,
      property_address: "42 MG Road, Bengaluru, Karnataka 560001",
      property_city: "Bengaluru",
      property_state: "Karnataka",
      property_pincode: "560001",
      monthly_rent_paise: 2500000,
      rent_due_day: 5,
      landlord_name: "Demo Landlord",
      landlord_phone: "+919876543210",
      lease_start_date: leaseStart.toISOString().split("T")[0],
      lease_end_date: leaseEnd.toISOString().split("T")[0],
      bank_verified: bankVerified,
      utility_verified: utilityVerified,
      landlord_approved: landlordApproved,
      landlord_approved_at: landlordApproved ? now.toISOString() : null,
    })
    .select("id")
    .single();

  if (error || !tenancy) {
    throw new AppError(`Failed to create tenancy: ${error?.message ?? "no data"}`, "TENANCY_CREATE_FAILED", 500);
  }

  return tenancy.id;
}

export async function seedPayments(
  userId: string,
  tenancyId: string,
  count: number,
  withCashback: boolean,
  supabase: SupabaseClient
): Promise<void> {
  await supabase.from("payments").delete().eq("tenancy_id", tenancyId);

  const now = new Date();
  const rentPaise = 2500000;
  const pgFeePaise = 59000;
  const cashbackPaise = withCashback ? Math.floor(rentPaise * 0.01) : 0;

  const payments = [];

  for (let i = 0; i < count; i++) {
    const paymentDate = new Date(now.getFullYear(), now.getMonth() - (count - i), 6);
    const paymentMonth = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), 1);
    const dueDate = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), 5);

    const appliedCashback = (i > 0 && withCashback) ? cashbackPaise : 0;
    const totalAmount = rentPaise + pgFeePaise - appliedCashback;

    payments.push({
      user_id: userId,
      tenancy_id: tenancyId,
      rent_amount_paise: rentPaise,
      total_amount_paise: totalAmount,
      pg_fee_paise: pgFeePaise,
      cashback_applied_paise: appliedCashback,
      flent_subsidy_paise: withCashback ? cashbackPaise : 0,
      net_rent_paise: rentPaise - (withCashback ? cashbackPaise : 0),
      status: "success",
      payment_method: "upi",
      payment_gateway: "payu",
      idempotency_key: `seed_${sanitizeForIdempotency(userId)}_${paymentMonth.toISOString().split("T")[0]}`,
      due_date: dueDate.toISOString().split("T")[0],
      payment_month: paymentMonth.toISOString().split("T")[0],
      paid_at: paymentDate.toISOString(),
    });
  }

  const { error } = await supabase.from("payments").insert(payments);

  if (error) {
    throw new AppError(`Failed to seed payments: ${error.message}`, "PAYMENTS_CREATE_FAILED", 500);
  }

  if (withCashback) {
    const ledgerEntries = [];
    let runningBalance = 0;

    for (let i = 0; i < count; i++) {
      const paymentDate = new Date(now.getFullYear(), now.getMonth() - (count - i), 6);
      runningBalance += cashbackPaise;

      ledgerEntries.push({
        user_id: userId,
        tenancy_id: tenancyId,
        transaction_type: "discount",
        amount_paise: cashbackPaise,
        balance_after_paise: runningBalance,
        description: `1% instant discount on rent payment - ${paymentDate.toLocaleDateString("en-IN")}`,
      });
    }

    const { error: ledgerError } = await supabase.from("cashback_ledger").insert(ledgerEntries);
    if (ledgerError) {
      console.warn("[seed-helpers] Failed to seed cashback ledger:", ledgerError.message);
    }
  }
}

export async function ensureSavedPaymentMethods(
  userId: string,
  supabase: SupabaseClient
): Promise<void> {
  await supabase.from("payment_methods").delete().eq("user_id", userId);

  const { error } = await supabase.from("payment_methods").insert([
    {
      user_id: userId,
      type: "upi",
      display_name: "test@ybl",
      upi_vpa: "test@ybl",
      is_default: true,
      is_verified: true,
    },
    {
      user_id: userId,
      type: "card",
      display_name: "HDFC \u2022\u2022\u2022\u2022 4242",
      card_last4: "4242",
      card_network: "visa",
      card_type: "debit",
      card_expiry_month: 12,
      card_expiry_year: 2028,
      is_default: false,
      is_verified: true,
    },
  ]);

  if (error) {
    console.warn("[seed-helpers] Failed to seed saved payment methods:", error.message);
  }
}

export function sanitizeForIdempotency(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 32);
}
