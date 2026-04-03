/**
 * Flent Secured v2 - Landlord M360 Identity Check
 *
 * Checks whether the M360 identity verification on a landlord's phone
 * matches the landlord name(s) on the rental agreement.
 *
 * Uses the same Gemini name matching service as penny drop (verify-bank).
 *
 * Used by: landlord-confirm, notify-landlord, upgrade-landlord-status
 */

import { matchAgainstAgreementNames, resolveAgreementNames } from "./name-match-service.ts";

// ==============================================
// TYPES
// ==============================================

type SupabaseClient = ReturnType<typeof import("./supabase.ts").createServiceClient>;

export interface LandlordM360CheckResult {
  m360Found: boolean;
  nameMatched: boolean;
  m360Name: string | null;
  matchScore: number;
  matchDetails: Record<string, unknown> | null;
  detail: string;
}

// ==============================================
// M360 LOOKUP + GEMINI NAME MATCH
// ==============================================

/**
 * Checks if a landlord's M360 identity matches the agreement landlord name.
 *
 * 1. Finds the latest FLENT_LANDLORD_* M360 record for the landlord's phone
 * 2. Resolves all landlord names from the tenancy/agreement
 * 3. Runs Gemini name match (same as penny drop) with Levenshtein fallback
 */
export async function checkLandlordM360Status(
  tenancyId: string,
  landlordPhone: string | null,
  supabase: SupabaseClient,
): Promise<LandlordM360CheckResult> {
  if (!landlordPhone?.trim()) {
    return {
      m360Found: false,
      nameMatched: false,
      m360Name: null,
      matchScore: 0,
      matchDetails: null,
      detail: "No landlord phone on tenancy",
    };
  }

  // Normalize: extract last 10 digits (tenancies stores bare digits, identity_verifications stores with 91 prefix)
  const last10 = landlordPhone.replace(/\D/g, "").slice(-10);
  if (last10.length < 10) {
    return {
      m360Found: false,
      nameMatched: false,
      m360Name: null,
      matchScore: 0,
      matchDetails: null,
      detail: `Invalid landlord phone: ${landlordPhone}`,
    };
  }

  // Find the latest successful LANDLORD M360 check for this phone
  const { data: m360Record, error: m360Error } = await supabase
    .from("identity_verifications")
    .select("m360_full_name, status, verification_id, consent_phone")
    .like("verification_id", "FLENT_LANDLORD_%")
    .eq("status", "SUCCESS")
    .like("consent_phone", `%${last10}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (m360Error) {
    console.error("[landlord-m360-check] DB query failed:", m360Error);
    return {
      m360Found: false,
      nameMatched: false,
      m360Name: null,
      matchScore: 0,
      matchDetails: null,
      detail: `DB error looking up M360: ${m360Error.message}`,
    };
  }

  if (!m360Record) {
    return {
      m360Found: false,
      nameMatched: false,
      m360Name: null,
      matchScore: 0,
      matchDetails: null,
      detail: `No M360 SUCCESS record found for phone ending ${last10}`,
    };
  }

  const m360Name = m360Record.m360_full_name;
  if (!m360Name?.trim()) {
    return {
      m360Found: true,
      nameMatched: false,
      m360Name: null,
      matchScore: 0,
      matchDetails: null,
      detail: "M360 record found but m360_full_name is empty",
    };
  }

  // Resolve all landlord names from tenancy + extracted rental info
  const resolved = await resolveAgreementNames(supabase, tenancyId, "landlord");
  if (!resolved.names.length) {
    return {
      m360Found: true,
      nameMatched: false,
      m360Name,
      matchScore: 0,
      matchDetails: null,
      detail: "M360 found but no landlord names on tenancy/agreement to match against",
    };
  }

  // Gemini name match — same code path as penny drop (verify-bank)
  const matchResult = await matchAgainstAgreementNames({
    verifiedName: m360Name,
    candidateNames: resolved.names,
    context: "landlord_verification",
  });

  console.log(
    `[landlord-m360-check] M360 name="${m360Name}" vs landlord names=${JSON.stringify(resolved.names)} → matched=${matchResult.matched}, score=${matchResult.score}, type=${matchResult.details.match_type ?? "n/a"}`,
  );

  return {
    m360Found: true,
    nameMatched: matchResult.matched,
    m360Name,
    matchScore: matchResult.score,
    matchDetails: {
      ...matchResult.details,
      landlord_names_checked: resolved.names,
      name_source: resolved.source,
    },
    detail: matchResult.matched
      ? `M360 name "${m360Name}" matches landlord (score=${matchResult.score})`
      : `M360 name "${m360Name}" does NOT match landlord names ${JSON.stringify(resolved.names)}`,
  };
}

// ==============================================
// UPGRADE HELPER
// ==============================================

/**
 * Checks M360 name match and upgrades tenancy to 'verified' if matched.
 * Used as fire-and-forget after landlord OTP confirmation, and by the cron.
 */
export async function checkAndUpgradeLandlordStatus(
  tenancyId: string,
  landlordPhone: string | null,
  supabase: SupabaseClient,
): Promise<{ upgraded: boolean; result: LandlordM360CheckResult }> {
  const result = await checkLandlordM360Status(tenancyId, landlordPhone, supabase);

  if (result.m360Found && result.nameMatched) {
    const { error: updateError } = await supabase
      .from("tenancies")
      .update({
        landlord_status: "verified",
        landlord_approved: true,
      })
      .eq("id", tenancyId)
      .eq("landlord_status", "otp_confirmed");

    if (updateError) {
      console.error(`[landlord-m360-check] Failed to upgrade tenancy ${tenancyId}:`, updateError);
      return { upgraded: false, result };
    }

    console.log(`[landlord-m360-check] Tenancy ${tenancyId} upgraded to verified (M360 name="${result.m360Name}", score=${result.matchScore})`);
    return { upgraded: true, result };
  }

  console.log(`[landlord-m360-check] Tenancy ${tenancyId} NOT upgraded: ${result.detail}`);
  return { upgraded: false, result };
}
