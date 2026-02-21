/**
 * Flent Secured v2 - Gemini AI Helper
 *
 * Uses Google's Vertex AI Gemini 2.5 Flash for intelligent matching and verification.
 * Used for semantic name matching and address verification.
 */

// ==============================================
// CONFIGURATION
// ==============================================

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY_SECURED") || Deno.env.get("GEMINI_API_KEY");
const VERTEX_AI_PROJECT_ID = Deno.env.get("VERTEX_AI_PROJECT_ID") || "flent-ai-project-2";
const VERTEX_AI_LOCATION = Deno.env.get("VERTEX_AI_LOCATION") || "us-central1";

// Gemini API endpoints
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

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

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
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
  context: "landlord_verification" | "tenant_verification" | "bank_verification" = "landlord_verification"
): Promise<NameMatchResult> {
  const prompt = `You are an expert at matching Indian names for ${context.replace("_", " ")}.
Your task is to determine if these two names refer to the same person.

Name 1 (from user input): "${name1}"
Name 2 (from official document/bill): "${name2}"

Consider these Indian name variations:
1. Initials: "R K SHARMA" = "RAMESH KUMAR SHARMA" = "R KUMAR SHARMA"
2. Titles: "MR", "MRS", "DR", "SHRI", "SMT", "KUMARI" should be ignored
3. Suffixes: "JI", "SAHAB", "(HUF)", "S/O", "W/O", "D/O", "C/O" and what follows should be handled appropriately
4. Common variations: "KUMAR" = "KR" = "K", "MOHAMMED" = "MOHAMMAD" = "MD" = "MOHD"
5. Spelling variations: "SINGH" = "SINGHJI", "DEVI" as suffix for women
6. Joint names: "RAMESH / SEEMA SHARMA" matches either "RAMESH SHARMA" or "SEEMA SHARMA"
7. Middle names may be omitted or abbreviated
8. Name order might be different (SHARMA RAMESH vs RAMESH SHARMA)

Return a JSON object with:
{
  "is_match": boolean (true if same person, false otherwise),
  "confidence": number (0-100, how confident you are),
  "reasoning": string (brief explanation),
  "normalized_name1": string (the name1 cleaned up),
  "normalized_name2": string (the name2 cleaned up),
  "match_type": "exact" | "strong" | "partial" | "weak" | "no_match"
}

Rules for match_type:
- "exact": Names are identical after normalization
- "strong": High confidence same person (initials expand correctly, common variations)
- "partial": Likely same person but some uncertainty (partial name match)
- "weak": Possibly same person but significant differences
- "no_match": Clearly different people

Context-specific guidance:
- For landlord_verification: confirm the electricity bill holder is the landlord. Be reasonably lenient as real-world documents have variations.
- For bank_verification: confirm the electricity bill consumer is the same person as the bank account holder. Bank records often have abbreviated or formally different name formats (e.g. "RAMESH K" in bank vs "RAMESH KUMAR SHARMA" on bill). Be lenient — only reject if the names clearly refer to different people. Partial matches, missing middle names, initials vs full names, and minor spelling differences should all PASS. The goal is to catch fraud (completely different person), NOT penalize formatting differences.
- For tenant_verification: confirm the tenant identity matches. Apply standard matching rules.`;

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
