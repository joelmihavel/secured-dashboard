// ============================================
// UTILITY FUNCTIONS — ported verbatim from process-document/index.ts
// ============================================

/**
 * Helper function to infer state from city name.
 *
 * Ported from: process-document/index.ts inferStateFromCity()
 */
export function inferStateFromCity(city?: string): string | undefined {
  if (!city) return undefined;
  const cityLower = city.toLowerCase();

  // Karnataka cities
  if (cityLower.includes('bangalore') || cityLower.includes('bengaluru') ||
      cityLower.includes('mysore') || cityLower.includes('mysuru') ||
      cityLower.includes('mangalore') || cityLower.includes('hubli')) {
    return 'Karnataka';
  }
  // Maharashtra cities
  if (cityLower.includes('mumbai') || cityLower.includes('pune') ||
      cityLower.includes('nagpur') || cityLower.includes('thane') ||
      cityLower.includes('nashik') || cityLower.includes('aurangabad')) {
    return 'Maharashtra';
  }
  // Delhi
  if (cityLower.includes('delhi') || cityLower.includes('new delhi') ||
      cityLower.includes('noida') || cityLower.includes('gurgaon') ||
      cityLower.includes('gurugram') || cityLower.includes('faridabad') ||
      cityLower.includes('ghaziabad')) {
    return 'Delhi NCR';
  }
  // Tamil Nadu
  if (cityLower.includes('chennai') || cityLower.includes('coimbatore') ||
      cityLower.includes('madurai') || cityLower.includes('tiruchirappalli')) {
    return 'Tamil Nadu';
  }
  // Telangana
  if (cityLower.includes('hyderabad') || cityLower.includes('secunderabad') ||
      cityLower.includes('warangal')) {
    return 'Telangana';
  }
  // West Bengal
  if (cityLower.includes('kolkata') || cityLower.includes('calcutta')) {
    return 'West Bengal';
  }
  // Gujarat
  if (cityLower.includes('ahmedabad') || cityLower.includes('surat') ||
      cityLower.includes('vadodara') || cityLower.includes('rajkot')) {
    return 'Gujarat';
  }

  return undefined;
}

/**
 * Parse amount string to paise (rupees * 100).
 * Returns amount in paise to match _paise column semantics.
 *
 * Ported from: process-document/index.ts parseAmount()
 */
export function parseAmount(value: string): number {
  const cleaned = value.replace(/[^0-9.,]/g, "").replace(/,/g, "");
  const amount = parseFloat(cleaned);
  return isNaN(amount) ? 0 : Math.round(amount * 100);
}

/**
 * Parse date string to YYYY-MM-DD format.
 * Handles Indian date formats with ordinal suffixes.
 *
 * Ported from: process-document/index.ts parseDate()
 */
export function parseDate(value: string): string | undefined {
  try {
    // Strip ordinal suffixes (1st, 2nd, 3rd, 4th, etc.) — common in Indian agreements
    // "1st January 2025" -> "1 January 2025", "15th March 2025" -> "15 March 2025"
    const cleaned = value.replace(/(\d+)(?:st|nd|rd|th)\b/gi, '$1');

    // Handle various Indian date formats
    const formats = [
      /(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/, // DD/MM/YYYY or DD-MM-YYYY
      /(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/, // YYYY-MM-DD
    ];

    for (const format of formats) {
      const match = cleaned.match(format);
      if (match) {
        if (match[3].length === 4) {
          // DD/MM/YYYY
          return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
        } else {
          // YYYY-MM-DD
          return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        }
      }
    }

    // Try natural language parsing (handles "1 January 2025", "January 1, 2025", etc.)
    const date = new Date(cleaned);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  } catch {
    // Return undefined if parsing fails
  }
  return undefined;
}

/**
 * Parse duration string to months.
 *
 * Ported from: process-document/index.ts parseDuration()
 */
export function parseDuration(value: string): number {
  const match = value.match(/(\d+)/);
  if (match) {
    const num = parseInt(match[1]);
    if (value.toLowerCase().includes('year')) {
      return num * 12;
    }
    return num;
  }
  return 11; // Default to 11 months (common in India)
}

/**
 * Extract the first balanced JSON object from text using a brace counter.
 * Handles cases where the greedy regex /\{[\s\S]*\}/ captures too much
 * (e.g., trailing text after the closing brace).
 *
 * Ported from: process-document/index.ts extractBalancedJson()
 */
export function extractBalancedJson(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return text.substring(start, i + 1);
      }
    }
  }

  return null; // Unbalanced braces
}

/**
 * Strip heavy fields from Document AI response to prevent statement timeouts.
 * Removes base64 page images and caps document text at 100K chars.
 *
 * Ported from: process-document/index.ts slimDocAiData()
 */
export function slimDocAiData(raw: object): object {
  try {
    const data = raw as any;
    if (!data?.document) return raw;
    return {
      ...data,
      document: {
        ...data.document,
        text: data.document.text?.substring(0, 100_000),
        pages: data.document.pages?.map((p: any) => {
          const { image, ...rest } = p;
          return rest;
        }),
      },
    };
  } catch {
    return raw;
  }
}

/**
 * Categorize an error message into an error code.
 *
 * Ported from: process-document/index.ts categorizeError()
 */
export function categorizeError(message: string): string {
  const msg = message.toLowerCase();
  if (message.includes('PDF') || message.includes('file type')) return 'INVALID_FILE_TYPE';
  if (message.includes('download')) return 'FILE_NOT_FOUND';
  if (msg.includes('timed out') || msg.includes('abort')) return 'PROCESSING_TIMEOUT';
  if (msg.includes('safety') || msg.includes('blocked')) return 'SAFETY_FILTER_BLOCKED';
  if (message.includes('RESOURCE_EXHAUSTED') || message.includes('429')) return 'RATE_LIMITED';
  if (message.includes('Document AI')) return 'OCR_FAILED';
  if (message.includes('Gemini')) return 'VERIFICATION_FAILED';
  if (message.includes('store') || message.includes('database')) return 'DATABASE_ERROR';
  return 'UNKNOWN_ERROR';
}

/**
 * Convert ArrayBuffer to base64 string.
 * Uses Node.js Buffer instead of Deno's btoa() for efficient conversion.
 *
 * Ported from: process-document/index.ts arrayBufferToBase64()
 * Note: Original Deno version used chunked String.fromCharCode + btoa().
 * Node.js Buffer.from() handles this natively without chunking.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString('base64');
}

/**
 * Split joint names like "RAMESH AND SEEMA JOSHI" into individual names.
 *
 * Ported from: process-document/index.ts splitJointNames()
 */
export function splitJointNames(names: string[]): string[] {
  const result: string[] = [];
  for (const name of names) {
    // Split on " AND ", " & ", " / " (case-insensitive, surrounded by spaces)
    const parts = name.split(/\s+(?:AND|&|\/)\s+/i);
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.length > 0) result.push(trimmed);
    }
  }
  return result;
}

/**
 * Check if a Gemini error is transient and worth retrying.
 *
 * Ported from: process-document/index.ts isRetryableGeminiError()
 */
export function isRetryableGeminiError(message?: string): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes("no json found")
    || m.includes("empty response")
    || m.includes("empty text content")
    || m.includes("empty json")
    || m.includes("malformed json")
    || m.includes("resource_exhausted")
    || m.includes("429")
    || m.includes("500 ")
    || m.includes("502 ")
    || m.includes("503 ")
    || m.includes("internal server error")
    || m.includes("service unavailable")
    || m.includes("max_tokens")
    || m.includes("blocked by safety filter")
    || m.includes("prompt blocked");
}

/**
 * Parse JSON from a Gemini response text.
 * Tries greedy regex first, then balanced extraction as fallback.
 * Mirrors the JSON parsing pattern used in both extractWithVertexAIGemini()
 * and verifyWithGemini() in the source.
 */
export function parseGeminiJsonResponse(textContent: string, source: string = 'Gemini'): Record<string, unknown> {
  if (!textContent || textContent === '{}') {
    throw new Error(`${source} returned empty response`);
  }

  // Parse JSON from response (handle markdown code blocks if present)
  const jsonMatch = textContent.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    let parsed: any;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      // Greedy regex may have captured too much — try non-greedy balanced extraction
      const balanced = extractBalancedJson(textContent);
      if (balanced) {
        try {
          parsed = JSON.parse(balanced);
        } catch {
          throw new Error(`${source} returned malformed JSON: ${(parseErr as Error).message}. First 200 chars: ${jsonMatch[0].substring(0, 200)}`);
        }
      } else {
        throw new Error(`${source} returned malformed JSON: ${(parseErr as Error).message}. First 200 chars: ${jsonMatch[0].substring(0, 200)}`);
      }
    }
    if (Object.keys(parsed).length === 0) {
      throw new Error(`${source} returned empty JSON`);
    }
    return parsed;
  }

  throw new Error(`No JSON found in ${source} response`);
}
