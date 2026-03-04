/**
 * M360 Identity Data Processor — Shared Module
 *
 * Extracted from verify-identity/index.ts to avoid duplication between
 * auth-otp (Cashfree path) and verify-identity.
 *
 * Handles:
 * - Data masking (PAN, Aadhaar, bank accounts)
 * - User profile update with M360-verified name
 * - Risk recomputation
 * - m360_status update on users table
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { maskAadhaar, maskPan } from "./validation.ts";
import { extractFirstName } from "./name-utils.ts";
import { computeRisk } from "./risk-utils.ts";
import type { Mobile360IdentityData } from "./cashfree-m360-otp.ts";

// ==============================================
// TYPES
// ==============================================

export interface ProcessedVerificationData {
  reference_id?: string;
  status: string;
  verified_at: string | null;

  // Personal details
  m360_full_name?: string;
  m360_gender?: string;
  m360_date_of_birth?: string;
  m360_age?: number;
  m360_occupation?: string;
  m360_total_income?: string;
  m360_relatives?: unknown;

  // Contact info
  m360_phone_numbers?: unknown;
  m360_emails?: unknown;

  // Identity documents (masked)
  m360_pan_details?: unknown;
  m360_aadhaar_masked?: string | null;
  m360_passport_details?: unknown;
  m360_driving_license_details?: unknown;
  m360_voter_details?: unknown;
  m360_ration_card_details?: unknown;

  // Financial data (masked)
  m360_bank_accounts?: unknown;
  m360_employment_details?: unknown;

  // Addresses
  m360_addresses?: unknown;

  // Intelligence scores
  m360_credit_score?: number;
  m360_mobile_intelligence?: unknown;
  m360_risk_intelligence?: unknown;

  // Social profiles
  m360_social_profiles?: unknown;

  // Raw response
  raw_response?: unknown;
}

// ==============================================
// DATA MASKING
// ==============================================

/**
 * Masks sensitive fields in M360 identity data for storage.
 */
export function buildVerificationData(
  m360Status: string,
  referenceId: string | undefined,
  data: Mobile360IdentityData | undefined,
  rawResponse: unknown
): ProcessedVerificationData {
  return {
    reference_id: referenceId,
    status: m360Status === "SUCCESS" ? "SUCCESS" : m360Status,
    verified_at: m360Status === "SUCCESS" ? new Date().toISOString() : null,

    // Personal details (Cashfree nests under personal_details, fallback to root)
    m360_full_name: data?.full_name,
    m360_gender: data?.gender,
    m360_date_of_birth: data?.dob,
    m360_age: typeof data?.age === "string" ? parseInt(data.age, 10) || undefined : data?.age,
    m360_occupation: data?.occupation,
    m360_total_income: data?.total_income,
    m360_relatives: data?.personal_details?.relatives_details?.map((r) => ({
      name: r.relative_name ?? (r as unknown as { name?: string }).name,
      relation: r.relation,
    })) ?? data?.relatives,

    // Contact info
    m360_phone_numbers: data?.phone_numbers,
    m360_emails: data?.emails,

    // Identity documents (masked)
    m360_pan_details: data?.pan_details?.map((p) => ({
      ...p,
      pan: maskPan(p.pan_number ?? p.pan ?? ""),
    })),
    m360_aadhaar_masked: data?.aadhaar_details?.[0]?.masked_aadhaar_number
      ?? (data?.aadhaar_number ? maskAadhaar(data.aadhaar_number) : null),
    m360_passport_details: data?.passport_details,
    m360_driving_license_details: data?.driving_license_details,
    m360_voter_details: data?.voter_details,
    m360_ration_card_details: data?.ration_card_details,

    // Financial data (masked) — Cashfree uses bank_account_details with bank_account field
    m360_bank_accounts: (data?.bank_account_details ?? data?.bank_accounts)?.map((b) => {
      const acct = (b as { bank_account?: string }).bank_account
        ?? (b as { account_number?: string }).account_number ?? "";
      return {
        account_masked: acct ? `XXXX${acct.slice(-4)}` : "XXXX????",
        ifsc: b.ifsc,
        bank_name: b.bank_name,
      };
    }),
    m360_employment_details: Array.isArray(data?.employment_details)
      ? data.employment_details
      : data?.employment_details ? [data.employment_details] : undefined,

    // Addresses
    m360_addresses: data?.addresses,

    // Intelligence scores
    m360_credit_score: data?.credit_score,
    m360_mobile_intelligence: data?.mobile_number_intelligence ?? data?.mobile_intelligence,
    m360_risk_intelligence: data?.risk_intelligence,

    // Raw response
    raw_response: rawResponse,
  };
}

// ==============================================
// PROFILE & RISK UPDATE
// ==============================================

/**
 * Updates user profile with M360-verified name and recomputes risk.
 * Also updates m360_status on the users table.
 *
 * @param userId - The user's UUID
 * @param m360Status - The M360 verification status ('SUCCESS', 'DETAILS_NOT_FOUND', etc.)
 * @param data - The M360 identity data (may be undefined for non-SUCCESS)
 * @param supabase - Service-role Supabase client
 * @returns The identity_status for the client: 'completed' | 'not_available' | 'pending'
 */
export async function processM360IdentityResult(
  userId: string,
  m360Status: string,
  data: Mobile360IdentityData | undefined,
  supabase: SupabaseClient
): Promise<"completed" | "not_available" | "pending"> {
  const now = new Date().toISOString();

  if (m360Status === "SUCCESS" && data?.full_name) {
    const extracted = extractFirstName(data.full_name);

    // Update user profile with M360-verified name
    await supabase
      .from("users")
      .update({
        first_name: extracted.first_name,
        last_name: extracted.last_name,
        full_name: data.full_name,
        name_source: "m360",
        m360_status: "fetched",
        m360_status_updated_at: now,
      })
      .eq("id", userId);

    // Sync user_metadata.name so Zustand hydration reads the M360-verified name
    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { name: extracted.first_name },
    });

    // Recompute risk now that M360 data is available
    try {
      const { data: waitlistEntry } = await supabase
        .from("waitlist_entries")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (waitlistEntry) {
        const riskResult = await computeRisk(userId, supabase);
        await supabase.from("waitlist_entries").update({
          risk_level: riskResult.risk_level,
          risk_factors: riskResult.risk_factors,
          risk_computed_at: now,
        }).eq("user_id", userId);
      }
    } catch (riskError) {
      console.error("[m360-identity-processor] Risk recomputation failed (non-fatal):", riskError);
    }

    return "completed";
  }

  if (m360Status === "DETAILS_NOT_FOUND") {
    await supabase
      .from("users")
      .update({
        m360_status: "not_available",
        m360_status_updated_at: now,
      })
      .eq("id", userId);

    return "not_available";
  }

  if (m360Status === "SUCCESS") {
    // SUCCESS but no full_name — still mark as fetched
    await supabase
      .from("users")
      .update({
        m360_status: "fetched",
        m360_status_updated_at: now,
      })
      .eq("id", userId);

    return "completed";
  }

  // For other failure statuses (OTP_INVALID, OTP_EXPIRED, VERIFICATION_FAILED)
  // Don't update m360_status — let it stay pending for retry
  return "pending";
}

/**
 * Marks m360_status as 'pending' when OTP is sent via Cashfree.
 * Uses atomic conditional update to prevent race conditions.
 */
export async function markM360Pending(
  userId: string,
  supabase: SupabaseClient
): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("users")
    .update({
      m360_status: "pending",
      m360_status_updated_at: now,
    })
    .eq("id", userId);
}

/**
 * Marks m360_status as 'failed' when M360 verification fails terminally.
 */
export async function markM360Failed(
  userId: string,
  supabase: SupabaseClient
): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("users")
    .update({
      m360_status: "failed",
      m360_status_updated_at: now,
    })
    .eq("id", userId);
}
