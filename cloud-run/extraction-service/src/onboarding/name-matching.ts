/**
 * Flent Secured v2 - Name Matching (Cloud Run Port)
 *
 * Ported from:
 *   supabase/functions/_shared/gemini.ts   -> matchNameAgainstCandidates, callGemini, fallbacks
 *   supabase/functions/_shared/name-match-service.ts -> resolveAgreementNames, matchAgainstAgreementNames
 *
 * Uses Google Gemini for semantic Indian name matching with Levenshtein fallback.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ==============================================
// CONFIGURATION
// ==============================================

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY_SECURED || process.env.GEMINI_API_KEY;

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent";

// ==============================================
// TYPES
// ==============================================

export interface NameMatchResult {
  is_match: boolean;
  confidence: number; // 0-100
  reasoning: string;
  normalized_name1: string;
  normalized_name2: string;
  match_type: "exact" | "strong" | "partial" | "weak" | "no_match";
}

export interface MultiCandidateMatchResult {
  matched: boolean;
  matched_name: string | null;
  confidence: number; // 0-100
  reasoning: string;
  match_type: "exact" | "strong" | "partial" | "weak" | "no_match";
}

export interface ResolvedNames {
  names: string[];
  primaryName: string;
  source: "agreement" | "tenancy" | "none";
}

export type GeminiContext =
  | "landlord_verification"
  | "tenant_verification"
  | "bank_verification"
  | "agreement_bank_verification"
  | "pan_verification"
  | "pan_huf_verification";

export interface NameMatchInput {
  verifiedName: string;
  candidateNames: string[];
  context: GeminiContext;
  matchThreshold?: number;
}

export interface NameMatchOutput {
  matched: boolean;
  matchedName: string | null;
  score: number;
  details: {
    gemini_used: boolean;
    reasoning?: string;
    match_type?: string;
    all_candidates?: string[];
    name_at_source?: string;
    fallback_score?: number;
    skipped?: boolean;
    reason?: string;
  };
}

// ==============================================
// GEMINI API CALL
// ==============================================

interface GeminiRequest {
  contents: {
    parts: { text: string }[];
  }[];
  generationConfig?: {
    temperature?: number;
    topK?: number;
    topP?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
  };
}

interface GeminiResponse {
  candidates?: {
    content: {
      parts: { text: string }[];
    };
  }[];
  error?: {
    code: number;
    message: string;
  };
}

async function callGemini(prompt: string, jsonMode = true): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "Gemini API key not configured (GEMINI_API_KEY_SECURED or GEMINI_API_KEY)"
    );
  }

  const requestBody: GeminiRequest = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      topK: 1,
      topP: 0.8,
      maxOutputTokens: 1024,
      ...(jsonMode && { responseMimeType: "application/json" }),
    },
  };

  const MAX_RETRIES = 3;
  const TIMEOUT_MS = 30_000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        if (
          (response.status === 429 || response.status === 503) &&
          attempt < MAX_RETRIES
        ) {
          const backoffMs = Math.min(
            1000 * Math.pow(2, attempt - 1),
            8000
          );
          console.warn(
            `Gemini API ${response.status} (attempt ${attempt}/${MAX_RETRIES}), retrying in ${backoffMs}ms`
          );
          await new Promise((r) => setTimeout(r, backoffMs));
          continue;
        }
        console.error("Gemini API error:", error);
        throw new Error(`Gemini API error: ${response.status} - ${error}`);
      }

      const data: GeminiResponse = await response.json();

      if (data.error) {
        throw new Error(
          `Gemini API error: ${data.error.code} - ${data.error.message}`
        );
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("No response from Gemini API");
      }

      return text;
    } catch (err: unknown) {
      const isAbort =
        err instanceof DOMException && err.name === "AbortError";
      const isNetwork =
        err instanceof TypeError &&
        ((err as Error).message.includes("fetch") ||
          (err as Error).message.includes("network"));
      if ((isAbort || isNetwork) && attempt < MAX_RETRIES) {
        const backoffMs = Math.min(
          1000 * Math.pow(2, attempt - 1),
          8000
        );
        console.warn(
          `Gemini API ${isAbort ? "timeout" : "network error"} (attempt ${attempt}/${MAX_RETRIES}), retrying in ${backoffMs}ms`
        );
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }
      throw err;
    }
  }

  throw new Error("Gemini API: max retries exhausted");
}

// ==============================================
// MULTI-CANDIDATE NAME MATCHING (single Gemini call)
// ==============================================

/**
 * Matches a verified name against ALL candidate names in a SINGLE Gemini call.
 * Eliminates the multi-call priority bug and is faster (1 API call vs N).
 */
export async function matchNameAgainstCandidates(
  verifiedName: string,
  candidateNames: string[],
  context: GeminiContext = "landlord_verification"
): Promise<MultiCandidateMatchResult> {
  const candidateList = candidateNames
    .map((n, i) => `  ${i + 1}. "${n}"`)
    .join("\n");

  const prompt = `You are an expert at matching Indian names. Your job is to determine if a bank-verified name matches ANY ONE of the candidate names from a rental agreement.

VERIFIED NAME (from bank records): "${verifiedName}"

CANDIDATE NAMES (from rental agreement -- landlords/co-owners):
${candidateList}

Your task: Does the verified name match ANY ONE of the candidates above? Even a close/partial match to any single candidate is sufficient.

IMPORTANT -- Indian names are extremely loose. You MUST account for ALL of these:
1. Initials vs full names: "R K SHARMA" = "RAMESH KUMAR SHARMA"
2. First name only vs full name: "NEEL ROY" = "NEEL ROY CRUZ" (just missing surname)
3. Missing middle names: "RAMESH SHARMA" = "RAMESH KUMAR SHARMA"
4. Titles/honorifics -- IGNORE: MR, MRS, MS, DR, SHRI, SMT, KUMARI, LATE, PROF
5. Relational suffixes -- IGNORE: S/O, W/O, D/O, C/O and everything after them
6. Common abbreviations: KUMAR=KR=K, MOHAMMED=MOHAMMAD=MD=MOHD, SINGH=SINGHJI
7. Hindi/Sanskrit transliteration variants: LAKSHMI=LAXMI, SHUBHAM=SUBHAM, KRISHNA=KRUSHNA
8. Name order swapped: "SHARMA RAMESH" = "RAMESH SHARMA"
9. Bank name truncation: Banks truncate names -- "NEEL ROY" = "NEEL ROY CRUZ"
10. Extra/missing spaces: "RAMA KRISHNA" = "RAMAKRISHNA"
11. (HUF) suffix: Strip it
12. Joint bank accounts: Verified name may contain MULTIPLE names -- "RAMESH KUMAR AND SEEMA SHARMA", "RAMESH / SEEMA", "RAMESH KUMAR & SEEMA SHARMA". If ANY part of the joint name matches ANY candidate, return matched=true with that candidate as matched_name.

CRITICAL RULE: Only return matched=false if the verified name clearly belongs to a COMPLETELY DIFFERENT PERSON from ALL candidates. If there is ANY reasonable possibility it matches any one candidate, return matched=true. We are catching fraud (completely wrong person), NOT penalizing formatting differences. Even a close match is fine.

Return ONLY a JSON object:
{
  "matched": boolean,
  "matched_name": string or null (the candidate name that matched, null if none),
  "confidence": number (0-100),
  "reasoning": string (brief explanation),
  "match_type": "exact" | "strong" | "partial" | "weak" | "no_match"
}

Context: ${context.replace(/_/g, " ")}
${context === "agreement_bank_verification" ? "The verified name comes from a Cashfree penny drop (formal bank records). The candidates come from a rental agreement PDF. Expect large formatting differences. Only reject if clearly a different person." : ""}${context === "pan_verification" ? "PAN records use formal legal names. Agreements may have casual/short forms. Only reject if clearly different people." : ""}`;

  try {
    const result = await callGemini(prompt);
    const parsed = JSON.parse(result) as MultiCandidateMatchResult;

    if (
      typeof parsed.matched !== "boolean" ||
      typeof parsed.confidence !== "number"
    ) {
      throw new Error("Invalid response format from Gemini");
    }

    return parsed;
  } catch (error) {
    console.error("Gemini multi-candidate matching failed:", error);
    return fallbackMultiCandidateMatch(verifiedName, candidateNames);
  }
}

// ==============================================
// FALLBACK: MULTI-CANDIDATE MATCH
// ==============================================

function fallbackMultiCandidateMatch(
  verifiedName: string,
  candidateNames: string[]
): MultiCandidateMatchResult {
  const normalize = (s: string) =>
    s
      .toUpperCase()
      .replace(/[^A-Z\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const splitJointName = (name: string): string[] => {
    const parts = name
      .split(/\s+(?:AND|&)\s+|\s*\/\s*/i)
      .map((p) => p.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts : [name];
  };

  const verifiedParts = splitJointName(verifiedName);

  let bestScore = 0;
  let bestCandidate: string | null = null;

  for (const candidate of candidateNames) {
    const normCandidate = normalize(candidate);

    for (const part of verifiedParts) {
      const normPart = normalize(part);
      if (!normPart) continue;

      if (normPart === normCandidate) {
        return {
          matched: true,
          matched_name: candidate,
          confidence: 100,
          reasoning: "Exact match",
          match_type: "exact",
        };
      }

      const partWords = normPart.split(" ");
      const candidateWords = normCandidate.split(" ");
      const [shorter, longer] =
        partWords.length <= candidateWords.length
          ? [partWords, candidateWords]
          : [candidateWords, partWords];
      if (
        shorter.length >= 1 &&
        shorter.every((w) => longer.includes(w))
      ) {
        const score = Math.max(82, (shorter.length / longer.length) * 95);
        if (score > bestScore) {
          bestScore = score;
          bestCandidate = candidate;
        }
      }
    }
  }

  if (bestScore >= 70) {
    return {
      matched: true,
      matched_name: bestCandidate,
      confidence: Math.round(bestScore),
      reasoning: "Subset word match (joint name split)",
      match_type: "partial",
    };
  }

  return {
    matched: false,
    matched_name: null,
    confidence: 0,
    reasoning: "No match in fallback",
    match_type: "no_match",
  };
}

// ==============================================
// LEVENSHTEIN NAME MATCH SCORE
// ==============================================

/**
 * Calculates name match score using Levenshtein distance.
 * Handles common Indian name variations (initials, middle names, etc.)
 */
export function calculateNameMatchScore(name1: string, name2: string): number {
  const normalize = (s: string) =>
    s
      .toUpperCase()
      .replace(/\b[SWDC]\/O\b.*/, "")
      .replace(/\b(MR|MRS|MS|DR|SHRI|SMT|KUMARI|LATE|PROF)\b\.?/g, "")
      .replace(/[^A-Z\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const n1 = normalize(name1);
  const n2 = normalize(name2);

  if (n1 === n2) return 1;
  if (!n1 || !n2) return 0;

  const words1 = n1.split(" ");
  const words2 = n2.split(" ");

  // Subset match
  const [shorter, longer] =
    words1.length <= words2.length ? [words1, words2] : [words2, words1];
  if (shorter.length >= 1 && shorter.every((w) => longer.includes(w))) {
    return Math.max(0.82, (shorter.length / longer.length) * 0.95);
  }

  // Initials handling
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
  return 1 - dp[len1][len2] / Math.max(len1, len2);
}

// ==============================================
// RESOLVE AGREEMENT NAMES
// ==============================================

/**
 * Resolves all landlord (or tenant) names from a tenancy.
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
  const { data: tenancy, error: tenancyError } = await supabase
    .from("tenancies")
    .select("landlord_name, landlord_names, extracted_rental_info_id")
    .eq("id", tenancyId)
    .single();

  if (tenancyError || !tenancy) {
    return { names: [], primaryName: "", source: "none" };
  }

  let allNames: string[] = [];

  if (
    party === "landlord" &&
    (tenancy as Record<string, any>).landlord_names?.length
  ) {
    allNames = (tenancy as Record<string, any>).landlord_names;
  } else if ((tenancy as Record<string, any>).extracted_rental_info_id) {
    const field =
      party === "landlord" ? "landlord_names" : "tenant_names";
    const { data: extraction } = await supabase
      .from("extracted_rental_info")
      .select(field)
      .eq("id", (tenancy as Record<string, any>).extracted_rental_info_id)
      .single();
    if ((extraction as Record<string, any>)?.[field]?.length) {
      allNames = (extraction as Record<string, any>)[field];
    }
  }

  const names: string[] = [];
  const primaryName =
    party === "landlord"
      ? ((tenancy as Record<string, any>).landlord_name ?? "")
      : "";

  if (primaryName) names.push(primaryName);
  for (const name of allNames) {
    if (name && !names.includes(name)) names.push(name);
  }

  const source =
    allNames.length > 0
      ? ("agreement" as const)
      : primaryName
        ? ("tenancy" as const)
        : ("none" as const);

  return { names, primaryName: names[0] ?? "", source };
}

// ==============================================
// MATCH AGAINST AGREEMENT NAMES
// ==============================================

/**
 * Core matching function. Takes a verified name + candidate names,
 * runs Gemini matching with Levenshtein fallback.
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

  if (!verifiedName?.trim() || !candidateNames.length) {
    return {
      matched: false,
      matchedName: null,
      score: 0,
      details: {
        gemini_used: false,
        skipped: true,
        reason: !verifiedName?.trim()
          ? "empty_verified_name"
          : "no_candidate_names",
      },
    };
  }

  try {
    console.log(
      `[name-match-service] Matching "${verifiedName}" against ${candidateNames.length} candidate(s) in single Gemini call, context=${context}`
    );

    const result = await matchNameAgainstCandidates(
      verifiedName,
      candidateNames,
      context
    );

    return {
      matched: result.matched,
      matchedName: result.matched_name,
      score: result.confidence,
      details: {
        gemini_used: true,
        reasoning: result.reasoning,
        match_type: result.match_type,
        all_candidates:
          candidateNames.length > 1 ? candidateNames : undefined,
        name_at_source: verifiedName,
      },
    };
  } catch (error) {
    console.error(
      "[name-match-service] Gemini matching failed, using Levenshtein fallback:",
      error
    );

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
        all_candidates:
          candidateNames.length > 1 ? candidateNames : undefined,
        name_at_source: verifiedName,
      },
    };
  }
}
