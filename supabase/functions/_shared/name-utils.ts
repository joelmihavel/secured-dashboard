/**
 * Flent Secured v2 - Name Extraction Utility
 *
 * Pure deterministic first-name extraction from raw name strings.
 * Handles Indian name conventions: titles, relation prefixes, initials,
 * ALL CAPS normalization, username-style inputs, and honorific suffixes.
 *
 * No AI calls — purely rule-based.
 */

// ==============================================
// TYPES
// ==============================================

export interface ExtractedName {
  first_name: string;
  last_name: string | null;
  cleaned_full_name: string;
}

// ==============================================
// CONSTANTS
// ==============================================

const TITLES = new Set([
  "mr", "mrs", "ms", "miss", "dr", "prof",
  "shri", "smt", "kumari", "sri", "srimati",
  "capt", "col", "maj", "gen", "lt",
]);

const SUFFIXES = new Set([
  "ji", "sahab", "saheb", "saab",
]);

// Relation prefixes — everything after these (and their object) is removed
const RELATION_PREFIX_REGEX = /\b[swd]\/o\b.*/i;

// ==============================================
// HELPERS
// ==============================================

/**
 * Title-cases a single word: "RISHABH" -> "Rishabh", "kumar" -> "Kumar"
 */
function titleCase(word: string): string {
  if (word.length === 0) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Checks if a token is a single-letter initial (optionally with a dot).
 * "R" -> true, "R." -> true, "Ram" -> false
 */
function isInitial(token: string): boolean {
  const cleaned = token.replace(/\./g, "");
  return cleaned.length === 1 && /^[A-Za-z]$/.test(cleaned);
}

/**
 * Extracts only alphabetic characters from a string.
 */
function alphaOnly(s: string): string {
  return s.replace(/[^a-zA-Z]/g, "");
}

// ==============================================
// MAIN EXPORT
// ==============================================

/**
 * Extracts a clean first name (and optional last name) from a raw name string.
 *
 * Handles:
 * - Titles: "Dr. Rishabh Agnihotri" -> first_name: "Rishabh"
 * - Relation prefixes: "Rishabh S/O Ram Kumar" -> first_name: "Rishabh"
 * - Initials pattern: "R K SHARMA" -> first_name: "Sharma"
 * - Single names: "Rishabh" -> first_name: "Rishabh"
 * - Username-style: "rish_2k" -> first_name: "Rish"
 * - Suffixes: "Ramesh Ji" -> first_name: "Ramesh"
 * - ALL CAPS: "RISHABH KUMAR" -> first_name: "Rishabh"
 */
export function extractFirstName(rawName: string): ExtractedName {
  if (!rawName || rawName.trim().length === 0) {
    return { first_name: "User", last_name: null, cleaned_full_name: "" };
  }

  let name = rawName.trim();

  // 1. Strip relation prefixes (S/O, W/O, D/O and everything after)
  name = name.replace(RELATION_PREFIX_REGEX, "").trim();

  // 2. Remove special characters except spaces, dots, and hyphens
  name = name.replace(/[^a-zA-Z\s.\-]/g, " ").trim();

  // 3. If the result is too short or empty after cleanup, treat as username-style
  const alphaContent = alphaOnly(name);
  if (alphaContent.length === 0) {
    // Entirely non-alpha input — extract alpha from original
    const fromOriginal = alphaOnly(rawName);
    if (fromOriginal.length === 0) {
      return { first_name: "User", last_name: null, cleaned_full_name: rawName.trim() };
    }
    const cleaned = titleCase(fromOriginal);
    return { first_name: cleaned, last_name: null, cleaned_full_name: cleaned };
  }

  // 4. Normalize whitespace and split into tokens
  const tokens = name
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((t) => t.length > 0);

  // 5. Strip titles from the beginning
  const stripped: string[] = [];
  let titlesDone = false;
  for (const token of tokens) {
    const lower = token.toLowerCase().replace(/\./g, "");
    if (!titlesDone && TITLES.has(lower)) {
      continue; // Skip title
    }
    titlesDone = true;
    stripped.push(token);
  }

  // 6. Strip suffixes from the end
  while (stripped.length > 1) {
    const lastLower = stripped[stripped.length - 1].toLowerCase().replace(/\./g, "");
    if (SUFFIXES.has(lastLower)) {
      stripped.pop();
    } else {
      break;
    }
  }

  if (stripped.length === 0) {
    // All tokens were titles/suffixes — fallback to first non-title token
    const fallback = titleCase(alphaOnly(rawName));
    return { first_name: fallback || "User", last_name: null, cleaned_full_name: fallback || rawName.trim() };
  }

  // 7. Handle initials pattern: "R K SHARMA" -> first_name = "Sharma"
  //    Find the first non-initial token
  const nonInitialIndex = stripped.findIndex((t) => !isInitial(t));

  if (nonInitialIndex > 0) {
    // There are leading initials — use first non-initial as first_name
    const firstName = titleCase(stripped[nonInitialIndex]);
    const remaining = stripped.slice(nonInitialIndex + 1).map(titleCase);
    const lastName = remaining.length > 0 ? remaining.join(" ") : null;
    const cleanedFull = stripped.map(titleCase).join(" ");
    return { first_name: firstName, last_name: lastName, cleaned_full_name: cleanedFull };
  }

  // 8. All tokens are initials (e.g., "R K") — use the raw alpha content
  if (stripped.every((t) => isInitial(t))) {
    const fallback = titleCase(alphaOnly(rawName));
    return { first_name: fallback || "User", last_name: null, cleaned_full_name: fallback || rawName.trim() };
  }

  // 9. Normal case: first token is first_name, rest is last_name
  const firstName = titleCase(stripped[0]);
  const remaining = stripped.slice(1).map(titleCase);
  const lastName = remaining.length > 0 ? remaining.join(" ") : null;
  const cleanedFull = [firstName, ...(remaining.length > 0 ? remaining : [])].join(" ");

  return { first_name: firstName, last_name: lastName, cleaned_full_name: cleanedFull };
}
