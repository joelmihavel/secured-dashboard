/**
 * Flent Secured v2 - Shared Name Match Service
 *
 * Extracts the common pattern of resolving landlord names from agreement
 * and matching a verified name against them using Gemini AI with fallback.
 *
 * Used by: verify-bank, verify-utility, verify-pan
 */

import { matchNamesWithGemini, matchNameAgainstCandidates, matchConsumerNameWithPropertyGemini, type NameMatchResult } from "./gemini.ts";

// ==============================================
// TYPES
// ==============================================

type SupabaseClient = ReturnType<typeof import("./supabase.ts").createServiceClient>;

export interface ResolvedNames {
  names: string[];          // Deduplicated list: primary + extracted
  primaryName: string;      // First name (fallback for display)
  source: "agreement" | "tenancy" | "none";
}

type GeminiContext = Parameters<typeof matchNamesWithGemini>[2];

export interface NameMatchInput {
  verifiedName: string;         // Name from external API (bank, utility, PAN)
  candidateNames: string[];     // From resolveAgreementNames()
  context: GeminiContext;       // Which Gemini prompt to use
  matchThreshold?: number;      // Levenshtein fallback threshold (default 0.7)
}

export interface NameMatchOutput {
  matched: boolean;
  matchedName: string | null;   // Which candidate matched
  score: number;                // 0-100 confidence
  details: {
    gemini_used: boolean;
    reasoning?: string;
    match_type?: string;
    all_candidates?: string[];  // Only if >1
    name_at_source?: string;    // The verified name from external source
    fallback_score?: number;
    skipped?: boolean;
    reason?: string;
  };
}

// ==============================================
// RESOLVE AGREEMENT NAMES
// ==============================================

/**
 * Resolves all landlord (or tenant) names from a tenancy.
 * Replaces the identical ~20-line block duplicated in verify-bank and verify-utility.
 *
 * @param supabase - Service client
 * @param tenancyId - The tenancy to resolve names from
 * @param party - Which party's names to resolve ('landlord' or 'tenant')
 */
export async function resolveAgreementNames(
  supabase: SupabaseClient,
  tenancyId: string,
  party: "landlord" | "tenant" = "landlord"
): Promise<ResolvedNames> {
  // Fetch tenancy with extraction reference
  const { data: tenancy, error: tenancyError } = await supabase
    .from("tenancies")
    .select("landlord_name, landlord_names, extracted_rental_info_id")
    .eq("id", tenancyId)
    .single();

  if (tenancyError || !tenancy) {
    return { names: [], primaryName: "", source: "none" };
  }

  // Use tenancy.landlord_names (array) if available — it's the canonical source
  // since it's copied from extraction at tenancy creation and includes all landlords.
  // Fall back to extraction table for older tenancies created before this column existed.
  let allNames: string[] = [];

  if (party === "landlord" && tenancy.landlord_names?.length) {
    allNames = tenancy.landlord_names;
  } else if (tenancy.extracted_rental_info_id) {
    const field = party === "landlord" ? "landlord_names" : "tenant_names";
    const { data: extraction } = await supabase
      .from("extracted_rental_info")
      .select(field)
      .eq("id", tenancy.extracted_rental_info_id)
      .single();
    if (extraction?.[field]?.length) {
      allNames = extraction[field];
    }
  }

  // Build deduplicated list: primary name first, then remaining names
  const names: string[] = [];
  const primaryName = party === "landlord" ? (tenancy.landlord_name ?? "") : "";

  if (primaryName) names.push(primaryName);
  for (const name of allNames) {
    if (name && !names.includes(name)) names.push(name);
  }

  const source = allNames.length > 0
    ? "agreement" as const
    : primaryName
    ? "tenancy" as const
    : "none" as const;

  return { names, primaryName: names[0] ?? "", source };
}

// ==============================================
// MATCH AGAINST AGREEMENT NAMES
// ==============================================

/**
 * Core matching function. Takes a verified name + candidate names,
 * runs Gemini matching with Levenshtein fallback.
 *
 * Extracted from verify-bank lines 239-297 and verify-utility lines 368-423.
 */
export async function matchAgainstAgreementNames(
  input: NameMatchInput
): Promise<NameMatchOutput> {
  const {
    verifiedName,
    candidateNames,
    context,
    matchThreshold = 0.7,
  } = input;

  // Guard: empty inputs
  if (!verifiedName?.trim() || !candidateNames.length) {
    return {
      matched: false,
      matchedName: null,
      score: 0,
      details: {
        gemini_used: false,
        skipped: true,
        reason: !verifiedName?.trim() ? "empty_verified_name" : "no_candidate_names",
      },
    };
  }

  try {
    console.log(`[name-match-service] Matching "${verifiedName}" against ${candidateNames.length} candidate(s) in single Gemini call, context=${context}`);

    // Single Gemini call with ALL candidates — eliminates multi-call priority bugs
    const result = await matchNameAgainstCandidates(verifiedName, candidateNames, context);

    return {
      matched: result.matched,
      matchedName: result.matched_name,
      score: result.confidence,
      details: {
        gemini_used: true,
        reasoning: result.reasoning,
        match_type: result.match_type,
        all_candidates: candidateNames.length > 1 ? candidateNames : undefined,
        name_at_source: verifiedName,
      },
    };
  } catch (error) {
    console.error("[name-match-service] Gemini matching failed, using Levenshtein fallback:", error);

    // Fallback: Levenshtein against each candidate
    let bestScore = 0;
    let matchedName: string | null = null;

    for (const candidate of candidateNames) {
      const score = calculateNameMatchScore(verifiedName, candidate);
      if (score > bestScore) {
        bestScore = score;
        matchedName = candidate;
      }
    }

    const matched = bestScore >= matchThreshold;

    return {
      matched,
      matchedName,
      score: Math.round(bestScore * 100),
      details: {
        gemini_used: false,
        fallback_score: Math.round(bestScore * 100),
        all_candidates: candidateNames.length > 1 ? candidateNames : undefined,
        name_at_source: verifiedName,
      },
    };
  }
}

// ==============================================
// CANONICAL NAME MATCH SCORE (Levenshtein + Initials)
// ==============================================

/**
 * Calculates name match score using Levenshtein distance.
 * Handles common Indian name variations (initials, middle names, etc.)
 *
 * This is the canonical version, moved from verify-utility (lines 789-858).
 * Enhanced over verify-bank's simpler version with initials handling.
 */
export function calculateNameMatchScore(name1: string, name2: string): number {
  // Normalize: uppercase, strip titles/relational suffixes, keep only letters+spaces
  const normalize = (s: string) =>
    s
      .toUpperCase()
      .replace(/\b[SWDC]\/O\b.*/, "")                                   // Strip S/O, W/O etc + everything after
      .replace(/\b(MR|MRS|MS|DR|SHRI|SMT|KUMARI|LATE|PROF)\b\.?/g, "") // Strip titles
      .replace(/[^A-Z\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const n1 = normalize(name1);
  const n2 = normalize(name2);

  if (n1 === n2) return 1;
  if (!n1 || !n2) return 0;

  const words1 = n1.split(" ");
  const words2 = n2.split(" ");

  // Subset match: one name's words are all contained in the other
  // e.g. "DEEKSHA" vs "DEEKSHA AGARWAL", "RAMESH SHARMA" vs "RAMESH KUMAR SHARMA"
  const [shorter, longer] = words1.length <= words2.length ? [words1, words2] : [words2, words1];
  if (shorter.length >= 1 && shorter.every((w) => longer.includes(w))) {
    return Math.max(0.82, (shorter.length / longer.length) * 0.95);
  }

  // Initials handling: "R K SHARMA" vs "RAMESH KUMAR SHARMA"
  const hasInitials1 = words1.some((w) => w.length === 1);
  const hasInitials2 = words2.some((w) => w.length === 1);
  if (hasInitials1 || hasInitials2) {
    const initials1 = words1.map((w) => w[0]).join("");
    const initials2 = words2.map((w) => w[0]).join("");
    if (initials1 === initials2) return 0.85;
  }

  // Levenshtein distance
  const len1 = n1.length;
  const len2 = n2.length;
  const dp: number[][] = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));
  for (let i = 0; i <= len1; i++) dp[i][0] = i;
  for (let j = 0; j <= len2; j++) dp[0][j] = j;
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = n1[i - 1] === n2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return 1 - dp[len1][len2] / Math.max(len1, len2);
}

// ==============================================
// UTILITY CONSUMER → BUILDING/SOCIETY NAME MATCH
// ==============================================

export interface PropertyNameMatchInput {
  consumerName: string;
  propertyAddress: string;
}

/**
 * Checks if a utility bill consumer name matches the building/society/apartment
 * at the given property address. Uses Gemini AI with word-overlap fallback.
 *
 * This is a standalone check, separate from landlord name matching.
 * Used by verify-utility when the consumer name doesn't match any landlord.
 */
export async function matchUtilityConsumerAgainstProperty(
  input: PropertyNameMatchInput
): Promise<NameMatchOutput> {
  const { consumerName, propertyAddress } = input;

  if (!consumerName?.trim() || !propertyAddress?.trim()) {
    return {
      matched: false,
      matchedName: null,
      score: 0,
      details: {
        gemini_used: false,
        skipped: true,
        reason: !consumerName?.trim() ? "empty_consumer_name" : "empty_property_address",
      },
    };
  }

  try {
    console.log(`[name-match-service] Matching utility consumer "${consumerName}" against property for building/society name`);

    const result = await matchConsumerNameWithPropertyGemini(consumerName, propertyAddress);

    return {
      matched: result.is_match,
      matchedName: result.normalized_name2 || null,
      score: result.confidence,
      details: {
        gemini_used: true,
        reasoning: result.reasoning,
        match_type: result.match_type,
        name_at_source: consumerName,
      },
    };
  } catch (error) {
    console.error("[name-match-service] Building name matching failed:", error);

    return {
      matched: false,
      matchedName: null,
      score: 0,
      details: {
        gemini_used: false,
        reason: "building_match_error",
        name_at_source: consumerName,
      },
    };
  }
}

// ==============================================
// OPPORTUNISTIC NAME MATCH (PRE-WAITLIST RACE FIX)
// ==============================================

export interface OpportunisticMatchInput {
  supabase: SupabaseClient;
  userId: string;
  bankAccountId: string;
  verifiedName: string;
  context: GeminiContext;
  source: "verify-bank" | "verify-upi-vpa" | "verify-pan";
}

/**
 * Opportunistic name matching for the pre-waitlist timing race.
 *
 * When hasTenancy=false, bank accounts are created with agreement_name_match
 * skipped. The deferred matching in onboarding.ts runs when the tenancy is
 * CREATED. But if the tenancy was already created (extraction completed while
 * user was filling the bank form), deferred matching already ran and found
 * nothing. This function catches that gap.
 *
 * Call this AFTER creating/updating a bank_accounts row when !hasTenancy
 * and the verification succeeded. It checks if a tenancy now exists for
 * the user and, if so, runs name matching immediately.
 *
 * This is intentionally non-fatal. If it fails, the deferred matching
 * in onboarding.ts is the safety net for future tenancy creation.
 */
export async function runOpportunisticNameMatch(
  input: OpportunisticMatchInput
): Promise<void> {
  const { supabase, userId, bankAccountId, verifiedName, context, source } = input;

  try {
    // Check if a tenancy was created while the user was on the bank screen
    const { data: lateTenancy } = await supabase
      .from("tenancies")
      .select("id, user_id, landlord_name, extracted_rental_info_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!lateTenancy || lateTenancy.user_id !== userId) return;

    // Resolve landlord names from the tenancy/extraction
    const resolved = await resolveAgreementNames(supabase, lateTenancy.id, "landlord");
    if (resolved.names.length === 0) return;

    // Run Gemini name matching (with Levenshtein fallback)
    const matchResult = await matchAgainstAgreementNames({
      verifiedName,
      candidateNames: resolved.names,
      context,
    });

    // Update bank account with real match result (replaces { skipped: true }).
    // Pre-fix kept verified=true on no_match (informational). New product
    // flow makes name match a hard gate, so flip verified=false when match
    // fails — same change applied to runDeferredBankNameMatching.
    const bankUpdate: Record<string, unknown> = {
      agreement_name_matched: matchResult.matched,
      agreement_name_match_score: matchResult.score,
      agreement_name_match_details: {
        ...matchResult.details,
        opportunistic: true,
        matched_at: new Date().toISOString(),
      },
    };
    if (!matchResult.matched) {
      bankUpdate.verified = false;
      bankUpdate.verified_at = null;
    }
    await supabase.from("bank_accounts").update(bankUpdate).eq("id", bankAccountId);

    // tenancies.bank_verified mirrors match outcome (was unconditionally
    // true pre-fix, which let users with mismatched holders keep
    // bank_verified=true on the tenancy).
    const matchedLandlordName = matchResult.matched ? matchResult.matchedName : null;
    await supabase.from("tenancies").update({
      bank_verified: matchResult.matched,
      ...(matchedLandlordName && { landlord_name: matchedLandlordName }),
    }).eq("id", lateTenancy.id);

    // Flag risk on waitlist entry if name mismatch -- admin sees this during review
    if (!matchResult.matched) {
      const { data: we } = await supabase
        .from("waitlist_entries")
        .select("risk_factors")
        .eq("user_id", userId)
        .maybeSingle();

      await supabase.from("waitlist_entries").update({
        risk_factors: [...((we?.risk_factors as any[]) ?? []), {
          type: "bank_name_mismatch",
          bank_holder: verifiedName,
          agreement_landlords: resolved.names,
          match_score: matchResult.score,
          flagged_at: new Date().toISOString(),
        }],
        risk_level: "high",
      }).eq("user_id", userId);
    }

    // Attempt user_status advancement (approved -> active)
    await supabase
      .rpc("check_and_advance_to_active", { p_user_id: userId })
      .catch(() => {});

    console.log(
      `[${source}] Opportunistic name match: matched=${matchResult.matched}, score=${matchResult.score}`
    );
  } catch (err) {
    // Non-fatal -- deferred matching in onboarding.ts is the safety net
    console.warn(`[${source}] Opportunistic matching failed (non-fatal):`, err);
  }
}
