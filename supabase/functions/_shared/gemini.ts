/**
 * Flent Secured v2 - Gemini AI Helper
 *
 * Uses Google's Gemini 3 Flash for intelligent matching and verification.
 * Used for semantic name matching and address verification.
 */

// ==============================================
// CONFIGURATION
// ==============================================

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY_SECURED") || Deno.env.get("GEMINI_API_KEY");
const VERTEX_AI_PROJECT_ID = Deno.env.get("VERTEX_AI_PROJECT_ID") || "flent-ai-project-2";
const VERTEX_AI_LOCATION = Deno.env.get("VERTEX_AI_LOCATION") || "us-central1";

// Gemini API endpoints
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent";

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

export interface AddressMatchResult {
  is_match: boolean;
  confidence: number; // 0-100
  reasoning: string;
  key_matches: string[];
  key_differences: string[];
  match_type: "exact" | "strong" | "partial" | "weak" | "no_match";
}

export interface VerificationMatchResult {
  name_match: NameMatchResult;
  address_match: AddressMatchResult;
  overall_verified: boolean;
  overall_confidence: number;
  recommendation: string;
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
    throw new Error("Gemini API key not configured (GEMINI_API_KEY_SECURED or GEMINI_API_KEY)");
  }

  const requestBody: GeminiRequest = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.1, // Low temperature for consistent, deterministic output
      topK: 1,
      topP: 0.8,
      maxOutputTokens: 1024,
      ...(jsonMode && { responseMimeType: "application/json" }),
    },
  };

  const MAX_RETRIES = 3;
  const TIMEOUT_MS = 30_000; // 30s per attempt

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
        // 429 (rate limit) and 503 (overloaded) are retryable
        if ((response.status === 429 || response.status === 503) && attempt < MAX_RETRIES) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
          console.warn(`Gemini API ${response.status} (attempt ${attempt}/${MAX_RETRIES}), retrying in ${backoffMs}ms`);
          await new Promise((r) => setTimeout(r, backoffMs));
          continue;
        }
        console.error("Gemini API error:", error);
        throw new Error(`Gemini API error: ${response.status} - ${error}`);
      }

      const data: GeminiResponse = await response.json();

      if (data.error) {
        throw new Error(`Gemini API error: ${data.error.code} - ${data.error.message}`);
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("No response from Gemini API");
      }

      return text;
    } catch (err: unknown) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      const isNetwork = err instanceof TypeError && (err.message.includes("fetch") || err.message.includes("network"));
      if ((isAbort || isNetwork) && attempt < MAX_RETRIES) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        console.warn(`Gemini API ${isAbort ? "timeout" : "network error"} (attempt ${attempt}/${MAX_RETRIES}), retrying in ${backoffMs}ms`);
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }
      throw err;
    }
  }

  throw new Error("Gemini API: max retries exhausted");
}

// ==============================================
// NAME MATCHING
// ==============================================

/**
 * Uses Gemini AI to semantically match two names.
 * Handles Indian name variations, initials, titles, and transliterations.
 */
export async function matchNamesWithGemini(
  name1: string,
  name2: string,
  context: "landlord_verification" | "tenant_verification" | "bank_verification" | "agreement_bank_verification" | "pan_verification" | "pan_huf_verification" = "landlord_verification"
): Promise<NameMatchResult> {
  const prompt = `You are an expert at matching Indian names. Your job is to determine if two names refer to the same person. Your default bias should be MATCH unless the names are clearly different people.

Name 1: "${name1}"
Name 2: "${name2}"

IMPORTANT — Indian names are extremely loose. You MUST account for ALL of these real-world variations and PASS them:
1. Initials vs full names: "R K SHARMA" = "RAMESH KUMAR SHARMA" = "R KUMAR SHARMA"
2. First name only vs full name: "DEEKSHA" = "DEEKSHA AGARWAL" (just missing surname)
3. Missing middle names: "RAMESH SHARMA" = "RAMESH KUMAR SHARMA"
4. Titles/honorifics — IGNORE completely: MR, MRS, MS, DR, SHRI, SMT, KUMARI, LATE, PROF
5. Relational suffixes — IGNORE what follows: S/O, W/O, D/O, C/O (e.g. "RAMESH S/O MOHAN" = "RAMESH")
6. Common abbreviations: KUMAR=KR=K, MOHAMMED=MOHAMMAD=MD=MOHD, SINGH=SINGHJI, CHANDRA=CH
7. Hindi/Sanskrit transliteration variants: LAKSHMI=LAXMI, SHUBHAM=SUBHAM, GANESH=GANESH, VIDYA=VIDHYA, KRISHNA=KRUSHNA, SHIV=SHIVA, JAYESH=JAYESHBHAI, MUKESH=MUKESHBHAI
8. Joint/combined names: "RAMESH / SEEMA SHARMA" matches either "RAMESH SHARMA" or "SEEMA SHARMA"
9. Name order swapped: "SHARMA RAMESH" = "RAMESH SHARMA"
10. Bank name truncation: Banks often truncate names — "DEEKSHA AGAR" = "DEEKSHA AGARWAL"
11. Extra/missing spaces: "RAMA KRISHNA" = "RAMAKRISHNA"
12. (HUF) suffix: Strip it — "RAMESH SHARMA (HUF)" = "RAMESH SHARMA"
13. Nicknames and short forms: "RAJU" could be "RAJESH", "SEEMA" could be "SEEMANTHINI"

CRITICAL RULE: Only return is_match=false if the names clearly belong to DIFFERENT PEOPLE (e.g. "RAMESH SHARMA" vs "SUNIL VERMA"). If there is ANY reasonable possibility they are the same person, return is_match=true. We are catching fraud (completely wrong person), NOT penalizing formatting differences.

Return ONLY a JSON object (no markdown, no explanation outside JSON):
{
  "is_match": boolean,
  "confidence": number (0-100),
  "reasoning": string (brief explanation),
  "normalized_name1": string,
  "normalized_name2": string,
  "match_type": "exact" | "strong" | "partial" | "weak" | "no_match"
}

match_type guide:
- "exact": Identical after normalization
- "strong": Same person, formatting/abbreviation differences
- "partial": Likely same person, missing parts (e.g. first name only)
- "weak": Possibly same person, significant differences but not clearly different
- "no_match": Clearly different people

Context: ${context.replace(/_/g, " ")}
${context === "agreement_bank_verification" ? "The bank name comes from a Cashfree penny drop (formal bank records). The agreement name comes from a rental agreement PDF. These are very different document types — expect large formatting differences. Only reject if clearly a different person (e.g. tenant adding their own bank instead of landlord's)." : ""}${context === "pan_verification" ? "PAN records use formal legal names. Agreements may have casual/short forms. Only reject if clearly different people." : ""}${context === "pan_huf_verification" ? "This PAN belongs to a Hindu Undivided Family (HUF). Strip '(HUF)' and match the Karta name. HUF property ownership is common in India." : ""}${context === "tenant_verification" ? "The user typed their name casually in the app. The agreement has their formal legal name. Be very lenient — first name only should match." : ""}`;

  try {
    const result = await callGemini(prompt);
    const parsed = JSON.parse(result) as NameMatchResult;

    // Validate the response
    if (typeof parsed.is_match !== "boolean" || typeof parsed.confidence !== "number") {
      throw new Error("Invalid response format from Gemini");
    }

    return parsed;
  } catch (error) {
    console.error("Gemini name matching failed:", error);

    // Fallback to basic matching if Gemini fails
    return fallbackNameMatch(name1, name2);
  }
}

// ==============================================
// UTILITY CONSUMER NAME → BUILDING/SOCIETY MATCHING
// ==============================================

/**
 * Checks if a utility bill consumer name corresponds to the building,
 * society, or apartment complex at the given property address.
 *
 * In India, electricity connections in apartment complexes are often
 * registered under the building name, housing society, or Residents'
 * Welfare Association (RWA) — not the individual flat owner.
 *
 * Cloned from matchNamesWithGemini() with a specialized prompt.
 * Does NOT modify the original person-name matching function.
 */
export async function matchConsumerNameWithPropertyGemini(
  consumerName: string,
  propertyAddress: string,
): Promise<NameMatchResult> {
  const prompt = `You are an expert at matching utility bill consumer names with building/property information in India.

In many Indian apartment complexes and housing societies, electricity bills are registered under
the building name, society name, or residents' welfare association (RWA) rather than the
individual flat owner's name.

Your task is to determine if the consumer name on this electricity bill corresponds to the
building, society, or apartment complex at the given property address.

Consumer Name (from electricity bill): "${consumerName}"
Property Address: "${propertyAddress}"

Consider these common patterns in India:
1. Society/Association names: "GREEN VALLEY APARTMENTS RWA", "PRESTIGE LAKESIDE HABITAT OWNERS ASSOC"
2. Housing society suffixes: "CHS" (Co-op Housing Society), "CHSL", "RWA", "AOA" (Apartment Owners Association)
3. Builder/Project names: "BRIGADE GATEWAY", "GODREJ INFINITY", "SOBHA DREAM ACRES", "DLF PINNACLE"
4. Complex/Colony names: "HIRANANDANI GARDENS", "MANTRI SERENITY", "PURVA VENEZIA"
5. Abbreviated forms: "PVRA" = "Palm Valley Residents Association", abbreviations of long society names
6. Welfare associations: "OWNERS WELFARE ASSOCIATION", "MAINTENANCE COMMITTEE"
7. The consumer name may be a partial match (core building name without suffixes)
8. State-specific patterns: Maharashtra uses "CHS/CHSL", Karnataka uses "OWNERS ASSOCIATION", Delhi uses "RWA"

Return a JSON object with:
{
  "is_match": boolean (true if the consumer name refers to the building/society at this address),
  "confidence": number (0-100, how confident you are),
  "reasoning": string (brief explanation),
  "normalized_name1": string (the consumer name cleaned up),
  "normalized_name2": string (the building/society name extracted from the property address),
  "match_type": "exact" | "strong" | "partial" | "weak" | "no_match"
}

Rules for match_type:
- "exact": Consumer name IS the building/society name (possibly with RWA/CHS suffix)
- "strong": Clear reference to the same building/society (core name matches, abbreviation)
- "partial": Likely the same building but some uncertainty (partial overlap in name)
- "weak": Possibly related but significant differences
- "no_match": Consumer name is clearly a person's name or refers to a different property

IMPORTANT:
- Only return is_match=true if the consumer name clearly refers to a building, society, or
  residential complex that matches the property address.
- If the consumer name appears to be an individual person's name (not a building/society),
  return is_match=false — person-name matching is handled separately.
- Be lenient with suffixes: "GREEN VALLEY" matching "GREEN VALLEY APARTMENTS OWNERS ASSOCIATION" is a strong match.`;

  try {
    const result = await callGemini(prompt);
    const parsed = JSON.parse(result) as NameMatchResult;

    if (typeof parsed.is_match !== "boolean" || typeof parsed.confidence !== "number") {
      throw new Error("Invalid response format from Gemini");
    }

    return parsed;
  } catch (error) {
    console.error("Gemini building name matching failed:", error);
    return fallbackBuildingNameMatch(consumerName, propertyAddress);
  }
}

function fallbackBuildingNameMatch(consumerName: string, propertyAddress: string): NameMatchResult {
  const normalize = (s: string) =>
    s.toUpperCase().replace(/[^A-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  const name = normalize(consumerName);
  const address = normalize(propertyAddress);

  if (!name || !address) {
    return {
      is_match: false,
      confidence: 0,
      reasoning: "Empty input",
      normalized_name1: name,
      normalized_name2: address,
      match_type: "no_match",
    };
  }

  // Extract significant words from consumer name (skip common suffixes)
  const ignoreWords = new Set([
    "RWA", "ASSOCIATION", "SOCIETY", "WELFARE", "CHS", "CHSL", "OWNERS",
    "RESIDENTS", "LIMITED", "LTD", "PVT", "PRIVATE", "THE", "OF", "AND",
    "APARTMENT", "APARTMENTS", "FLAT", "FLATS", "AOA", "COMMITTEE",
  ]);
  const nameWords = name.split(" ").filter((w) => w.length > 1 && !ignoreWords.has(w));
  const addressWords = new Set(address.split(" "));

  if (nameWords.length === 0) {
    return {
      is_match: false,
      confidence: 0,
      reasoning: "No significant words in consumer name after filtering",
      normalized_name1: name,
      normalized_name2: address,
      match_type: "no_match",
    };
  }

  const matchCount = nameWords.filter((w) => addressWords.has(w)).length;
  const similarity = (matchCount / nameWords.length) * 100;

  return {
    is_match: similarity >= 60,
    confidence: Math.round(similarity),
    reasoning: `Word overlap: ${matchCount}/${nameWords.length} significant words found in address`,
    normalized_name1: name,
    normalized_name2: address,
    match_type:
      similarity >= 90 ? "strong" :
      similarity >= 70 ? "partial" :
      similarity >= 60 ? "weak" : "no_match",
  };
}

// ==============================================
// MULTI-CANDIDATE NAME MATCHING (single Gemini call)
// ==============================================

export interface MultiCandidateMatchResult {
  matched: boolean;
  matched_name: string | null;     // Which candidate matched (null if none)
  confidence: number;              // 0-100
  reasoning: string;
  match_type: "exact" | "strong" | "partial" | "weak" | "no_match";
}

/**
 * Matches a verified name against ALL candidate names in a SINGLE Gemini call.
 * Eliminates the multi-call priority bug and is faster (1 API call vs N).
 */
export async function matchNameAgainstCandidates(
  verifiedName: string,
  candidateNames: string[],
  context: "landlord_verification" | "tenant_verification" | "bank_verification" | "agreement_bank_verification" | "pan_verification" | "pan_huf_verification" = "landlord_verification"
): Promise<MultiCandidateMatchResult> {
  const candidateList = candidateNames.map((n, i) => `  ${i + 1}. "${n}"`).join("\n");

  const prompt = `You are an expert at matching Indian names. Your job is to determine if a bank-verified name matches ANY ONE of the candidate names from a rental agreement.

VERIFIED NAME (from bank records): "${verifiedName}"

CANDIDATE NAMES (from rental agreement — landlords/co-owners):
${candidateList}

Your task: Does the verified name match ANY ONE of the candidates above? Even a close/partial match to any single candidate is sufficient.

IMPORTANT — Indian names are extremely loose. You MUST account for ALL of these:
1. Initials vs full names: "R K SHARMA" = "RAMESH KUMAR SHARMA"
2. First name only vs full name: "NEEL ROY" = "NEEL ROY CRUZ" (just missing surname)
3. Missing middle names: "RAMESH SHARMA" = "RAMESH KUMAR SHARMA"
4. Titles/honorifics — IGNORE: MR, MRS, MS, DR, SHRI, SMT, KUMARI, LATE, PROF
5. Relational suffixes — IGNORE: S/O, W/O, D/O, C/O and everything after them
6. Common abbreviations: KUMAR=KR=K, MOHAMMED=MOHAMMAD=MD=MOHD, SINGH=SINGHJI
7. Hindi/Sanskrit transliteration variants: LAKSHMI=LAXMI, SHUBHAM=SUBHAM, KRISHNA=KRUSHNA
8. Name order swapped: "SHARMA RAMESH" = "RAMESH SHARMA"
9. Bank name truncation: Banks truncate names — "NEEL ROY" = "NEEL ROY CRUZ"
10. Extra/missing spaces: "RAMA KRISHNA" = "RAMAKRISHNA"
11. (HUF) suffix: Strip it
12. Joint bank accounts: Verified name may contain MULTIPLE names — "RAMESH KUMAR AND SEEMA SHARMA", "RAMESH / SEEMA", "RAMESH KUMAR & SEEMA SHARMA". If ANY part of the joint name matches ANY candidate, return matched=true with that candidate as matched_name.

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

    if (typeof parsed.matched !== "boolean" || typeof parsed.confidence !== "number") {
      throw new Error("Invalid response format from Gemini");
    }

    return parsed;
  } catch (error) {
    console.error("Gemini multi-candidate matching failed:", error);

    // Fallback: basic substring/word matching
    return fallbackMultiCandidateMatch(verifiedName, candidateNames);
  }
}

function fallbackMultiCandidateMatch(verifiedName: string, candidateNames: string[]): MultiCandidateMatchResult {
  const normalize = (s: string) =>
    s.toUpperCase().replace(/[^A-Z\s]/g, "").replace(/\s+/g, " ").trim();

  // Split joint names (e.g., "RAMESH KUMAR AND SEEMA SHARMA") into parts
  const splitJointName = (name: string): string[] => {
    const parts = name.split(/\s+(?:AND|&)\s+|\s*\/\s*/i).map(p => p.trim()).filter(Boolean);
    return parts.length > 0 ? parts : [name];
  };

  const verifiedParts = splitJointName(verifiedName);

  let bestScore = 0;
  let bestCandidate: string | null = null;

  for (const candidate of candidateNames) {
    const normCandidate = normalize(candidate);

    // Check each part of the verified name (joint account) against each candidate
    for (const part of verifiedParts) {
      const normPart = normalize(part);
      if (!normPart) continue;

      if (normPart === normCandidate) return { matched: true, matched_name: candidate, confidence: 100, reasoning: "Exact match", match_type: "exact" };

      const partWords = normPart.split(" ");
      const candidateWords = normCandidate.split(" ");
      const [shorter, longer] = partWords.length <= candidateWords.length ? [partWords, candidateWords] : [candidateWords, partWords];
      if (shorter.length >= 1 && shorter.every((w) => longer.includes(w))) {
        const score = Math.max(82, (shorter.length / longer.length) * 95);
        if (score > bestScore) { bestScore = score; bestCandidate = candidate; }
      }
    }
  }

  if (bestScore >= 70) {
    return { matched: true, matched_name: bestCandidate, confidence: Math.round(bestScore), reasoning: "Subset word match (joint name split)", match_type: "partial" };
  }

  return { matched: false, matched_name: null, confidence: 0, reasoning: "No match in fallback", match_type: "no_match" };
}

// ==============================================
// UTILITY BILL VERIFICATION (single Gemini call)
// ==============================================

export interface UtilityVerificationResult {
  verified: boolean;
  match_found_in: "landlord_name" | "building_name" | "address" | "none";
  matched_value: string | null;       // Which landlord/building/address matched
  confidence: number;                 // 0-100
  reasoning: string;
  name_match_type: "exact" | "strong" | "partial" | "weak" | "no_match";
}

/**
 * Single Gemini call for electricity bill verification.
 * Sends ALL context (consumer name, landlord names, property address, bill address)
 * and asks Gemini: does ANY of this match? Loose matching — any match = pass.
 */
export async function verifyUtilityBillWithGemini(
  consumerName: string,
  landlordNames: string[],
  propertyAddress: string,
  billAddress: string,
): Promise<UtilityVerificationResult> {
  const landlordList = landlordNames.map((n, i) => `  ${i + 1}. "${n}"`).join("\n");

  const prompt = `You are an expert at verifying Indian electricity bill ownership. Your job is to determine if an electricity bill belongs to the property described in a rental agreement.

ELECTRICITY BILL DETAILS:
- Consumer Name: "${consumerName}"
- Bill Address: "${billAddress || "Not provided"}"

RENTAL AGREEMENT DETAILS:
- Landlord Name(s):
${landlordList}
- Property Address: "${propertyAddress}"

Your task: Does the electricity bill belong to this property? Check ALL of the following — if ANY ONE matches, return verified=true:

1. LANDLORD NAME MATCH: Does the consumer name match ANY of the landlord names?
   - Apply Indian name looseness: initials, truncation, titles, S/O W/O, transliteration, missing middle names, swapped order
   - "R K SHARMA" = "RAMESH KUMAR SHARMA", "NEEL ROY" = "NEEL ROY CRUZ"
   - JOINT NAMES: Consumer name may contain MULTIPLE landlords joined — "RAMESH KUMAR AND SEEMA SHARMA", "RAMESH / SEEMA", "RAMESH KUMAR & SEEMA SHARMA". If ANY part matches ANY landlord, it's a match.
   - Even a close/partial match counts

2. BUILDING/SOCIETY NAME MATCH: Is the consumer name actually a building, housing society, RWA, or apartment complex name that matches the property address?
   - In India, many apartment electricity connections are under the building/RWA/society name, NOT the flat owner
   - Examples: "GREEN VALLEY APARTMENTS RWA", "PRESTIGE LAKESIDE HABITAT OWNERS ASSOC", "SOBHA DREAM ACRES MAINTENANCE"
   - Suffixes to recognize: CHS, CHSL, RWA, AOA, OWNERS ASSOCIATION, WELFARE ASSOCIATION, MAINTENANCE COMMITTEE

3. ADDRESS MATCH: Does the bill address match the property address?
   - Handle Indian address variations: RD=ROAD, NAGAR, COLONY, SOCIETY, pincodes (6 digits)
   - Building/flat number variations: "FLAT 101 TOWER A" = "A-101"
   - Even partial address overlap (same area/building) counts

CRITICAL RULES:
- Default bias = MATCH. We are catching fraud (completely wrong property), NOT penalizing formatting differences.
- If ANY ONE of the three checks above shows a reasonable match, return verified=true.
- Only return verified=false if the bill clearly belongs to a DIFFERENT property/person entirely.

Return ONLY a JSON object:
{
  "verified": boolean,
  "match_found_in": "landlord_name" | "building_name" | "address" | "none",
  "matched_value": string or null (the specific landlord name / building name / address part that matched),
  "confidence": number (0-100),
  "reasoning": string (brief explanation of what matched or why nothing matched),
  "name_match_type": "exact" | "strong" | "partial" | "weak" | "no_match"
}

If multiple things match, pick the strongest match for match_found_in.`;

  try {
    const result = await callGemini(prompt);
    const parsed = JSON.parse(result) as UtilityVerificationResult;

    if (typeof parsed.verified !== "boolean" || typeof parsed.confidence !== "number") {
      throw new Error("Invalid response format from Gemini");
    }

    return parsed;
  } catch (error) {
    console.error("Gemini utility verification failed:", error);

    // Fallback: basic word matching against landlord names + address
    return fallbackUtilityVerification(consumerName, landlordNames, propertyAddress, billAddress);
  }
}

function fallbackUtilityVerification(
  consumerName: string,
  landlordNames: string[],
  propertyAddress: string,
  billAddress: string,
): UtilityVerificationResult {
  const normalize = (s: string) =>
    s.toUpperCase().replace(/[^A-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  // Split joint consumer names (e.g., "RAMESH KUMAR AND SEEMA SHARMA")
  const splitJointName = (name: string): string[] => {
    const parts = name.split(/\s+(?:AND|&)\s+|\s*\/\s*/i).map(p => p.trim()).filter(Boolean);
    return parts.length > 0 ? parts : [name];
  };

  const consumerParts = splitJointName(consumerName).map(normalize);

  // Check each consumer name part against each landlord name
  for (const consumerPart of consumerParts) {
    if (!consumerPart) continue;
    const consumerWords = consumerPart.split(" ");

    for (const name of landlordNames) {
      const norm = normalize(name);
      if (consumerPart === norm) return { verified: true, match_found_in: "landlord_name", matched_value: name, confidence: 100, reasoning: "Exact name match", name_match_type: "exact" };
      const nameWords = norm.split(" ");
      const [shorter, longer] = consumerWords.length <= nameWords.length ? [consumerWords, nameWords] : [nameWords, consumerWords];
      if (shorter.length >= 1 && shorter.every((w) => longer.includes(w))) {
        return { verified: true, match_found_in: "landlord_name", matched_value: name, confidence: 80, reasoning: "Subset word match (joint name split)", name_match_type: "partial" };
      }
    }
  }

  // Check address overlap
  if (billAddress && propertyAddress) {
    const addr1Words = new Set(normalize(propertyAddress).split(" ").filter((w) => w.length > 2));
    const addr2Words = new Set(normalize(billAddress).split(" ").filter((w) => w.length > 2));
    const overlap = [...addr1Words].filter((w) => addr2Words.has(w));
    const score = addr1Words.size > 0 ? (overlap.length / addr1Words.size) * 100 : 0;
    // Check pincode match
    const pin1 = propertyAddress.match(/\d{6}/)?.[0];
    const pin2 = billAddress.match(/\d{6}/)?.[0];
    if ((pin1 && pin2 && pin1 === pin2) || score >= 50) {
      return { verified: true, match_found_in: "address", matched_value: pin1 ?? overlap.join(" "), confidence: Math.round(Math.min(score + (pin1 === pin2 ? 30 : 0), 100)), reasoning: "Address overlap", name_match_type: "partial" };
    }
  }

  return { verified: false, match_found_in: "none", matched_value: null, confidence: 0, reasoning: "No match found in fallback", name_match_type: "no_match" };
}

// ==============================================
// ADDRESS MATCHING
// ==============================================

/**
 * Uses Gemini AI to semantically match two addresses.
 * Handles Indian address variations, abbreviations, and regional formats.
 */
export async function matchAddressesWithGemini(
  address1: string,
  address2: string,
  context: "utility_verification" | "tenancy_verification" = "utility_verification"
): Promise<AddressMatchResult> {
  const prompt = `You are an expert at matching Indian addresses for ${context.replace("_", " ")}.
Your task is to determine if these two addresses refer to the same location.

Address 1 (property address from tenancy): "${address1}"
Address 2 (address from electricity bill): "${address2}"

Consider these Indian address variations:
1. Abbreviations: "RD" = "ROAD", "ST" = "STREET", "APT" = "APARTMENT", "BLK" = "BLOCK"
2. Location terms: "NAGAR", "COLONY", "SOCIETY", "ENCLAVE", "VIHAR", "PURAM", "KUNJ"
3. Building variations: "FLAT 101, TOWER A" = "A-101" = "101-A" = "FLAT NO 101 A WING"
4. Floor variations: "1ST FLOOR" = "FLOOR 1" = "1/F"
5. Pincode: 6-digit pincodes should match (very important)
6. City/Area names may be abbreviated or spelled differently
7. Landmarks may or may not be present
8. Hindi/regional script transliteration variations
9. "Near X" or landmark references may differ
10. Cross/Main road numbering (Bangalore style)

Return a JSON object with:
{
  "is_match": boolean (true if same location, false otherwise),
  "confidence": number (0-100, how confident you are),
  "reasoning": string (brief explanation),
  "key_matches": string[] (what matched - e.g., ["pincode", "building name", "flat number"]),
  "key_differences": string[] (what differs - e.g., ["landmark missing"]),
  "match_type": "exact" | "strong" | "partial" | "weak" | "no_match"
}

Rules for match_type:
- "exact": Addresses are identical after normalization
- "strong": Same location with minor formatting differences
- "partial": Same area/building but some details unclear
- "weak": Possibly same location but significant differences
- "no_match": Clearly different locations

For utility_verification, we want to confirm the electricity connection address matches the rental property.
Pincode match is very important. Building/flat number match is critical.`;

  try {
    const result = await callGemini(prompt);
    const parsed = JSON.parse(result) as AddressMatchResult;

    // Validate the response
    if (typeof parsed.is_match !== "boolean" || typeof parsed.confidence !== "number") {
      throw new Error("Invalid response format from Gemini");
    }

    return parsed;
  } catch (error) {
    console.error("Gemini address matching failed:", error);

    // Fallback to basic matching if Gemini fails
    return fallbackAddressMatch(address1, address2);
  }
}

// ==============================================
// COMBINED VERIFICATION
// ==============================================

/**
 * Performs both name and address matching for utility verification.
 */
export async function verifyUtilityWithGemini(
  landlordName: string,
  billConsumerName: string,
  propertyAddress: string,
  billAddress: string
): Promise<VerificationMatchResult> {
  // Run both matches in parallel
  const [nameMatch, addressMatch] = await Promise.all([
    matchNamesWithGemini(landlordName, billConsumerName, "landlord_verification"),
    matchAddressesWithGemini(propertyAddress, billAddress, "utility_verification"),
  ]);

  // Calculate overall verification
  // Name is weighted higher (60%) as it confirms ownership
  // Address confirms location (40%)
  const nameWeight = 0.6;
  const addressWeight = 0.4;
  const overallConfidence = Math.round(
    nameMatch.confidence * nameWeight + addressMatch.confidence * addressWeight
  );

  // Both must pass for overall verification
  const overall_verified = nameMatch.is_match && addressMatch.is_match;

  // Generate recommendation
  let recommendation: string;
  if (overall_verified && overallConfidence >= 80) {
    recommendation = "Strong match - recommend automatic approval";
  } else if (overall_verified && overallConfidence >= 60) {
    recommendation = "Good match - recommend approval with note";
  } else if (nameMatch.is_match && !addressMatch.is_match) {
    recommendation = "Name matches but address doesn't - may need manual review";
  } else if (!nameMatch.is_match && addressMatch.is_match) {
    recommendation = "Address matches but name doesn't - electricity may be in different name";
  } else {
    recommendation = "No match - verification failed";
  }

  return {
    name_match: nameMatch,
    address_match: addressMatch,
    overall_verified,
    overall_confidence: overallConfidence,
    recommendation,
  };
}

// ==============================================
// FALLBACK MATCHING (if Gemini fails)
// ==============================================

function fallbackNameMatch(name1: string, name2: string): NameMatchResult {
  const normalize = (s: string) =>
    s
      .toUpperCase()
      .replace(/[^A-Z\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const n1 = normalize(name1);
  const n2 = normalize(name2);

  if (n1 === n2) {
    return {
      is_match: true,
      confidence: 100,
      reasoning: "Exact match after normalization",
      normalized_name1: n1,
      normalized_name2: n2,
      match_type: "exact",
    };
  }

  // Simple Levenshtein distance
  const distance = levenshteinDistance(n1, n2);
  const maxLen = Math.max(n1.length, n2.length);
  const similarity = maxLen > 0 ? (1 - distance / maxLen) * 100 : 0;

  return {
    is_match: similarity >= 70,
    confidence: Math.round(similarity),
    reasoning: `Levenshtein similarity: ${similarity.toFixed(0)}%`,
    normalized_name1: n1,
    normalized_name2: n2,
    match_type:
      similarity >= 90 ? "strong" :
      similarity >= 70 ? "partial" :
      similarity >= 50 ? "weak" : "no_match",
  };
}

function fallbackAddressMatch(address1: string, address2: string): AddressMatchResult {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const a1 = normalize(address1);
  const a2 = normalize(address2);

  // Extract words
  const words1 = new Set(a1.split(" ").filter((w) => w.length > 2));
  const words2 = new Set(a2.split(" ").filter((w) => w.length > 2));

  // Calculate Jaccard similarity
  const intersection = [...words1].filter((w) => words2.has(w));
  const union = new Set([...words1, ...words2]);
  const similarity = union.size > 0 ? (intersection.length / union.size) * 100 : 0;

  // Check for pincode match (6 digits)
  const pincode1 = address1.match(/\d{6}/)?.[0];
  const pincode2 = address2.match(/\d{6}/)?.[0];
  const pincodeMatch = pincode1 && pincode2 && pincode1 === pincode2;

  const adjustedSimilarity = pincodeMatch ? Math.min(similarity + 30, 100) : similarity;

  return {
    is_match: adjustedSimilarity >= 60,
    confidence: Math.round(adjustedSimilarity),
    reasoning: `Word overlap: ${similarity.toFixed(0)}%${pincodeMatch ? ", pincode matches" : ""}`,
    key_matches: intersection,
    key_differences: [],
    match_type:
      adjustedSimilarity >= 90 ? "strong" :
      adjustedSimilarity >= 70 ? "partial" :
      adjustedSimilarity >= 50 ? "weak" : "no_match",
  };
}

function levenshteinDistance(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;
  const dp: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) dp[i][0] = i;
  for (let j = 0; j <= len2; j++) dp[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[len1][len2];
}

// ==============================================
// EXPORTS
// ==============================================

export { callGemini };
