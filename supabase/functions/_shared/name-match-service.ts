/**
 * Flent Secured v2 - Shared Name Match Service
 *
 * Extracts the common pattern of resolving landlord names from agreement
 * and matching a verified name against them using Gemini AI with fallback.
 *
 * Used by: verify-bank, verify-utility, verify-pan
 */

import { matchNamesWithGemini, matchConsumerNameWithPropertyGemini, type NameMatchResult } from "./gemini.ts";

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
    .select("landlord_name, extracted_rental_info_id")
    .eq("id", tenancyId)
    .single();

  if (tenancyError || !tenancy) {
    return { names: [], primaryName: "", source: "none" };
  }

  // Fetch extracted names from agreement (handles multiple landlords/tenants)
  let extractedNames: string[] = [];
  if (tenancy.extracted_rental_info_id) {
    const field = party === "landlord" ? "landlord_names" : "tenant_names";
    const { data: extraction } = await supabase
      .from("extracted_rental_info")
      .select(field)
      .eq("id", tenancy.extracted_rental_info_id)
      .single();
    if (extraction?.[field]?.length) {
      extractedNames = extraction[field];
    }
  }

  // Build deduplicated list: primary name first, then extracted names
  const names: string[] = [];
  const primaryName = party === "landlord" ? (tenancy.landlord_name ?? "") : "";

  if (primaryName) names.push(primaryName);
  for (const name of extractedNames) {
    if (name && !names.includes(name)) names.push(name);
  }

  const source = extractedNames.length > 0
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
    console.log(`[name-match-service] Matching "${verifiedName}" against ${candidateNames.length} candidate(s) with context=${context}`);

    let bestResult: NameMatchResult | null = null;
    let matchedName: string | null = null;

    for (const candidate of candidateNames) {
      const result = await matchNamesWithGemini(verifiedName, candidate, context);
      if (!bestResult || result.confidence > bestResult.confidence) {
        bestResult = result;
        matchedName = candidate;
      }
    }

    return {
      matched: bestResult!.is_match,
      matchedName,
      score: bestResult!.confidence,
      details: {
        gemini_used: true,
        reasoning: bestResult!.reasoning,
        match_type: bestResult!.match_type,
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
  // Normalize names
  const normalize = (s: string) =>
    s
      .toUpperCase()
      .replace(/[^A-Z\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const n1 = normalize(name1);
  const n2 = normalize(name2);

  if (n1 === n2) return 1;
  if (!n1 || !n2) return 0;

  // Split into words and compare
  const words1 = n1.split(" ");
  const words2 = n2.split(" ");

  // Check if one name contains initials (single letter words)
  const hasInitials1 = words1.some((w) => w.length === 1);
  const hasInitials2 = words2.some((w) => w.length === 1);

  // If initials present, expand comparison
  if (hasInitials1 || hasInitials2) {
    // Compare first letters of each word
    const initials1 = words1.map((w) => w[0]).join("");
    const initials2 = words2.map((w) => w[0]).join("");

    if (initials1 === initials2) {
      return 0.85; // High match for matching initials
    }

    // Check if full name contains initial pattern
    const fullWords1 = words1.filter((w) => w.length > 1);
    const fullWords2 = words2.filter((w) => w.length > 1);

    const fullInitials1 = fullWords1.map((w) => w[0]).join("");
    const fullInitials2 = fullWords2.map((w) => w[0]).join("");

    if (fullInitials1.includes(initials2.replace(/[^A-Z]/g, "")) ||
        fullInitials2.includes(initials1.replace(/[^A-Z]/g, ""))) {
      return 0.8;
    }
  }

  // Calculate Levenshtein distance
  const len1 = n1.length;
  const len2 = n2.length;
  const dp: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) dp[i][0] = i;
  for (let j = 0; j <= len2; j++) dp[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = n1[i - 1] === n2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  const distance = dp[len1][len2];
  const maxLen = Math.max(len1, len2);
  return 1 - distance / maxLen;
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
