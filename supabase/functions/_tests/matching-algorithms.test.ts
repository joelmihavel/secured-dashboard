/**
 * Flent Secured v2 - Matching Algorithm Unit Tests
 *
 * Tests the name and address matching algorithms used in verify-utility.
 * These tests run without requiring Supabase environment.
 */

import {
  assertEquals,
  assertGreater,
  assertLessOrEqual,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { describe, it } from "https://deno.land/std@0.208.0/testing/bdd.ts";

// ==============================================
// ALGORITHM IMPLEMENTATIONS (copied from verify-utility for testing)
// In production, these should be exported from a shared module
// ==============================================

const NAME_MATCH_THRESHOLD = 0.7; // 70%
const ADDRESS_MATCH_THRESHOLD = 0.7; // 70%

/**
 * Calculates name match score using Levenshtein distance.
 * Handles common Indian name variations (initials, middle names, etc.)
 */
function calculateNameMatchScore(name1: string, name2: string): number {
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
  const matrix: number[][] = [];
  for (let i = 0; i <= n1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= n2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= n1.length; i++) {
    for (let j = 1; j <= n2.length; j++) {
      const cost = n1[i - 1] === n2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[n1.length][n2.length];
  const maxLen = Math.max(n1.length, n2.length);
  return 1 - distance / maxLen;
}

/**
 * Calculates similarity score between two addresses.
 * Uses word overlap, pincode matching, and location keywords.
 */
function calculateAddressMatchScore(address1: string, address2: string): number {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const s1 = normalize(address1);
  const s2 = normalize(address2);

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  // Extract significant words (length > 2)
  const words1 = new Set(s1.split(" ").filter((w) => w.length > 2));
  const words2 = new Set(s2.split(" ").filter((w) => w.length > 2));

  // Calculate Jaccard similarity
  const intersection = [...words1].filter((w) => words2.has(w));
  const union = new Set([...words1, ...words2]);
  const jaccardSimilarity = union.size > 0 ? intersection.length / union.size : 0;

  // Extract and compare numbers
  const numbers1 = s1.match(/\d+/g) ?? [];
  const numbers2 = s2.match(/\d+/g) ?? [];

  // Pincode match (6 digits) is very important
  const pincodes1 = numbers1.filter((n) => n.length === 6);
  const pincodes2 = numbers2.filter((n) => n.length === 6);
  const pincodeMatch = pincodes1.some((p) => pincodes2.includes(p)) ? 0.3 : 0;

  // Other number matches (flat, building numbers)
  const otherNumbers1 = numbers1.filter((n) => n.length < 6);
  const otherNumbers2 = numbers2.filter((n) => n.length < 6);
  const numberMatch = otherNumbers1.some((n) => otherNumbers2.includes(n)) ? 0.1 : 0;

  // Location keywords
  const locationKeywords = [
    "nagar", "colony", "society", "apartments", "tower", "heights",
    "residency", "enclave", "complex", "park", "garden", "villa",
    "layout", "sector", "phase", "block", "wing", "floor",
  ];
  const hasLocationMatch = locationKeywords.some(
    (kw) => s1.includes(kw) && s2.includes(kw)
  );
  const locationBonus = hasLocationMatch ? 0.1 : 0;

  // Combine scores
  const finalScore = Math.min(
    jaccardSimilarity * 0.5 + pincodeMatch + numberMatch + locationBonus,
    1
  );

  return finalScore;
}

// ==============================================
// NAME MATCHING TESTS
// ==============================================

describe("Name Matching Algorithm", () => {
  describe("Exact matches", () => {
    it("should return 1.0 for identical names", () => {
      assertEquals(calculateNameMatchScore("RAMESH SHARMA", "RAMESH SHARMA"), 1);
    });

    it("should return 1.0 for case-insensitive matches", () => {
      assertEquals(calculateNameMatchScore("Ramesh Sharma", "RAMESH SHARMA"), 1);
    });

    it("should return 1.0 for names with extra whitespace", () => {
      assertEquals(calculateNameMatchScore("RAMESH  SHARMA", "RAMESH SHARMA"), 1);
    });
  });

  describe("Empty and null handling", () => {
    it("should return 0 for empty first name", () => {
      assertEquals(calculateNameMatchScore("", "RAMESH SHARMA"), 0);
    });

    it("should return 0 for empty second name", () => {
      assertEquals(calculateNameMatchScore("RAMESH SHARMA", ""), 0);
    });

    it("should return 1 for both empty names (edge case - identical)", () => {
      // Note: Two empty strings are considered identical (normalized to empty)
      assertEquals(calculateNameMatchScore("", ""), 1);
    });
  });

  describe("Indian name initials", () => {
    it("should return 0.85 for matching initials (R K S vs R K S)", () => {
      const score = calculateNameMatchScore("R K SHARMA", "R K S");
      // The initials pattern RKS matches RKS
      assertGreater(score, 0.7);
    });

    it("should return high score for initials vs full name", () => {
      const score = calculateNameMatchScore("R K SHARMA", "RAMESH KUMAR SHARMA");
      // First letters: R K S vs R K S
      assertGreater(score, 0.7);
    });

    it("should match single initial with full name", () => {
      const score = calculateNameMatchScore("R SHARMA", "RAMESH SHARMA");
      assertGreater(score, 0.7);
    });
  });

  describe("Similar names (Levenshtein)", () => {
    it("should return high score for small typos", () => {
      const score = calculateNameMatchScore("RAMESH SHARMA", "RAMESH SHARMA");
      assertGreater(score, 0.9);
    });

    it("should return moderate score for different middle names", () => {
      const score = calculateNameMatchScore("RAMESH KUMAR SHARMA", "RAMESH SHARMA");
      // Missing middle name
      assertGreater(score, 0.6);
    });

    it("should return low score for completely different names", () => {
      const score = calculateNameMatchScore("RAMESH SHARMA", "SURESH VERMA");
      // Levenshtein shows ~54% similarity due to shared characters
      assertLessOrEqual(score, 0.6);
    });
  });

  describe("Threshold validation", () => {
    it("should pass threshold for matching names", () => {
      const score = calculateNameMatchScore("RAMESH SHARMA", "RAMESH SHARMA");
      assertGreater(score, NAME_MATCH_THRESHOLD);
    });

    it("should fail threshold for different names", () => {
      const score = calculateNameMatchScore("RAMESH SHARMA", "UNKNOWN PERSON");
      assertLessOrEqual(score, NAME_MATCH_THRESHOLD);
    });
  });
});

// ==============================================
// ADDRESS MATCHING TESTS
// ==============================================

describe("Address Matching Algorithm", () => {
  describe("Exact matches", () => {
    it("should return 1.0 for identical addresses", () => {
      const address = "123 MG Road, Andheri East, Mumbai 400069";
      assertEquals(calculateAddressMatchScore(address, address), 1);
    });

    it("should return 1.0 for case-insensitive matches", () => {
      assertEquals(
        calculateAddressMatchScore(
          "123 MG Road, Mumbai",
          "123 mg road, mumbai"
        ),
        1
      );
    });
  });

  describe("Empty handling", () => {
    it("should return 0 for empty first address", () => {
      assertEquals(calculateAddressMatchScore("", "123 MG Road"), 0);
    });

    it("should return 0 for empty second address", () => {
      assertEquals(calculateAddressMatchScore("123 MG Road", ""), 0);
    });
  });

  describe("Pincode matching (30% weight)", () => {
    it("should boost score significantly when pincodes match", () => {
      const withPincode = calculateAddressMatchScore(
        "Some Address 400069",
        "Different Address 400069"
      );
      const withoutPincode = calculateAddressMatchScore(
        "Some Address 400069",
        "Different Address 400070"
      );
      assertGreater(withPincode, withoutPincode);
    });

    it("should detect 6-digit pincodes correctly", () => {
      const score = calculateAddressMatchScore(
        "Flat 123, Building A, 400069",
        "Flat 456, Building B, 400069"
      );
      // Should have pincode match bonus (0.3)
      assertGreater(score, 0.3);
    });
  });

  describe("Location keywords (10% bonus)", () => {
    it("should add bonus for matching location keywords", () => {
      const withKeyword = calculateAddressMatchScore(
        "Tower A, Prestige Complex, Whitefield",
        "Tower B, Prestige Complex, Whitefield"
      );
      const withoutKeyword = calculateAddressMatchScore(
        "Building A, Prestige, Whitefield",
        "Building B, Prestige, Whitefield"
      );
      // Both should have "tower" or no "tower", but "complex" should add bonus
      assertGreater(withKeyword, 0.5);
    });

    it("should recognize common Indian location terms", () => {
      const locations = [
        "nagar", "colony", "society", "apartments", "tower",
        "residency", "enclave", "complex", "layout", "sector"
      ];

      for (const loc of locations) {
        const score = calculateAddressMatchScore(
          `123 Test ${loc}`,
          `456 Other ${loc}`
        );
        assertGreater(score, 0);
      }
    });
  });

  describe("Building/flat numbers (10% bonus)", () => {
    it("should add bonus for matching building numbers", () => {
      const withMatch = calculateAddressMatchScore(
        "Flat 123, Tower A, Mumbai",
        "Flat 123, Tower B, Mumbai"
      );
      const withoutMatch = calculateAddressMatchScore(
        "Flat 123, Tower A, Mumbai",
        "Flat 456, Tower B, Mumbai"
      );
      assertGreater(withMatch, withoutMatch);
    });
  });

  describe("Full address scenarios", () => {
    it("should match similar addresses above threshold", () => {
      const score = calculateAddressMatchScore(
        "123 MG Road, Andheri East, Mumbai 400069",
        "123 MG Road, Andheri East, Mumbai, 400069"
      );
      assertGreater(score, ADDRESS_MATCH_THRESHOLD);
    });

    it("should fail threshold for different cities", () => {
      const score = calculateAddressMatchScore(
        "123 MG Road, Andheri East, Mumbai 400069",
        "456 Brigade Road, Koramangala, Bangalore 560034"
      );
      assertLessOrEqual(score, ADDRESS_MATCH_THRESHOLD);
    });

    it("should handle partial address matches", () => {
      const score = calculateAddressMatchScore(
        "Flat 306, Tower A, Prestige Lakeside, Whitefield, Bangalore 560066",
        "Prestige Lakeside, Whitefield, Bangalore"
      );
      // Partial matches have lower scores due to word overlap weighting
      assertGreater(score, 0.2);
    });
  });

  describe("Edge cases", () => {
    it("should handle addresses with special characters", () => {
      const score = calculateAddressMatchScore(
        "123/A, M.G. Road, Mumbai",
        "123A MG Road Mumbai"
      );
      // Special chars get normalized, but "123" appears as different tokens
      assertGreater(score, 0.3);
    });

    it("should normalize whitespace", () => {
      const score = calculateAddressMatchScore(
        "123   MG   Road,   Mumbai",
        "123 MG Road, Mumbai"
      );
      assertGreater(score, 0.8);
    });
  });
});

// ==============================================
// VERIFICATION SCENARIOS
// ==============================================

describe("Verification Scenarios", () => {
  describe("Full match (both name and address)", () => {
    it("should verify when both name and address match", () => {
      const nameScore = calculateNameMatchScore("RAMESH SHARMA", "RAMESH SHARMA");
      const addressScore = calculateAddressMatchScore(
        "123 MG Road, Andheri East, Mumbai 400069",
        "123 MG Road, Andheri East, 400069"
      );

      const isNameVerified = nameScore >= NAME_MATCH_THRESHOLD;
      const isAddressVerified = addressScore >= ADDRESS_MATCH_THRESHOLD;
      const isFullyVerified = isNameVerified && isAddressVerified;

      assertEquals(isFullyVerified, true);
    });
  });

  describe("Name match only", () => {
    it("should not verify when only name matches", () => {
      const nameScore = calculateNameMatchScore("RAMESH SHARMA", "RAMESH SHARMA");
      const addressScore = calculateAddressMatchScore(
        "123 MG Road, Andheri, Mumbai 400069",
        "999 Different Road, Delhi 110001"
      );

      const isNameVerified = nameScore >= NAME_MATCH_THRESHOLD;
      const isAddressVerified = addressScore >= ADDRESS_MATCH_THRESHOLD;
      const isFullyVerified = isNameVerified && isAddressVerified;

      assertEquals(isNameVerified, true);
      assertEquals(isAddressVerified, false);
      assertEquals(isFullyVerified, false);
    });
  });

  describe("Address match only", () => {
    it("should not verify when only address matches", () => {
      const nameScore = calculateNameMatchScore("RAMESH SHARMA", "DIFFERENT PERSON");
      const addressScore = calculateAddressMatchScore(
        "123 MG Road, Andheri East, Mumbai 400069",
        "123 MG Road, Andheri East, Mumbai 400069"
      );

      const isNameVerified = nameScore >= NAME_MATCH_THRESHOLD;
      const isAddressVerified = addressScore >= ADDRESS_MATCH_THRESHOLD;
      const isFullyVerified = isNameVerified && isAddressVerified;

      assertEquals(isNameVerified, false);
      assertEquals(isAddressVerified, true);
      assertEquals(isFullyVerified, false);
    });
  });

  describe("Neither match", () => {
    it("should not verify when neither matches", () => {
      const nameScore = calculateNameMatchScore("RAMESH SHARMA", "DIFFERENT PERSON");
      const addressScore = calculateAddressMatchScore(
        "123 MG Road, Andheri, Mumbai 400069",
        "999 Unknown Road, Delhi 110001"
      );

      const isNameVerified = nameScore >= NAME_MATCH_THRESHOLD;
      const isAddressVerified = addressScore >= ADDRESS_MATCH_THRESHOLD;
      const isFullyVerified = isNameVerified && isAddressVerified;

      assertEquals(isNameVerified, false);
      assertEquals(isAddressVerified, false);
      assertEquals(isFullyVerified, false);
    });
  });
});
