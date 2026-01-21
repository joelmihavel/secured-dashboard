/**
 * Flent Secured v2 - Cashfree Mock Utilities
 *
 * Provides mock Cashfree responses for Penny Drop and Mobile 360 testing.
 * Reference: https://docs.cashfree.com/
 */

// ==============================================
// SANDBOX CONFIGURATION
// ==============================================

export const CASHFREE_SANDBOX = {
  APP_ID: Deno.env.get("CASHFREE_APP_ID") || "test_app_id",
  SECRET_KEY: Deno.env.get("CASHFREE_SECRET_KEY") || "test_secret",
  BASE_URL: Deno.env.get("CASHFREE_BASE_URL") || "https://sandbox.cashfree.com/verification",
  API_VERSION: "2024-12-01",
} as const;

// ==============================================
// TEST DATA
// ==============================================

export const CASHFREE_TEST_ACCOUNTS = {
  VALID: {
    account: "026291800001191",
    ifsc: "YESB0000262",
    name: "Test Valid User",
  },
  INVALID: {
    account: "1234567890123456",
    ifsc: "SBIN0000001",
    name: "Invalid User",
  },
} as const;

export const CASHFREE_TEST_PHONES = {
  FOUND: "9876543210",
  NOT_FOUND: "9999999999",
} as const;

// ==============================================
// PENNY DROP RESPONSES
// ==============================================

interface PennyDropResponse {
  reference_id: string;
  verification_id: string;
  account_status: "VALID" | "INVALID" | "INDETERMINATE";
  name_at_bank?: string;
  bank_name?: string;
  ifsc?: string;
  account_number_last4?: string;
  utr?: string;
  message?: string;
}

/**
 * Creates a mock successful Penny Drop response.
 */
export function createMockPennyDropSuccess(
  overrides: Partial<PennyDropResponse> = {}
): PennyDropResponse {
  return {
    reference_id: `REF_${Date.now()}`,
    verification_id: `VER_${Date.now()}`,
    account_status: "VALID",
    name_at_bank: "TEST VALID USER",
    bank_name: "Yes Bank",
    ifsc: "YESB0000262",
    account_number_last4: "1191",
    utr: `UTR_${Date.now()}`,
    ...overrides,
  };
}

/**
 * Creates a mock failed Penny Drop response.
 */
export function createMockPennyDropFailure(
  reason: string = "Account does not exist"
): PennyDropResponse {
  return {
    reference_id: `REF_${Date.now()}`,
    verification_id: `VER_${Date.now()}`,
    account_status: "INVALID",
    message: reason,
  };
}

/**
 * Creates a mock indeterminate Penny Drop response.
 */
export function createMockPennyDropIndeterminate(): PennyDropResponse {
  return {
    reference_id: `REF_${Date.now()}`,
    verification_id: `VER_${Date.now()}`,
    account_status: "INDETERMINATE",
    message: "Unable to verify. Please retry.",
  };
}

// ==============================================
// MOBILE 360 RESPONSES
// ==============================================

interface Mobile360OtpResponse {
  verification_id: string;
  status: "OTP_SENT" | "OTP_FAILED";
  message?: string;
}

interface Mobile360VerifyResponse {
  verification_id: string;
  status: "SUCCESS" | "FAILED";
  data?: {
    full_name?: string;
    pan_status?: "VALID" | "INVALID" | "NOT_FOUND";
    aadhaar_linked?: boolean;
    alternate_numbers?: string[];
    address?: string;
  };
  message?: string;
}

/**
 * Creates a mock Mobile 360 OTP send response.
 */
export function createMockMobile360OtpSent(
  verificationId: string
): Mobile360OtpResponse {
  return {
    verification_id: verificationId,
    status: "OTP_SENT",
  };
}

/**
 * Creates a mock Mobile 360 OTP failed response.
 */
export function createMockMobile360OtpFailed(
  verificationId: string,
  reason: string = "Invalid phone number"
): Mobile360OtpResponse {
  return {
    verification_id: verificationId,
    status: "OTP_FAILED",
    message: reason,
  };
}

/**
 * Creates a mock successful Mobile 360 verification response.
 */
export function createMockMobile360Success(
  verificationId: string,
  overrides: Partial<Mobile360VerifyResponse["data"]> = {}
): Mobile360VerifyResponse {
  return {
    verification_id: verificationId,
    status: "SUCCESS",
    data: {
      full_name: "Atri Sharma",
      pan_status: "VALID",
      aadhaar_linked: true,
      alternate_numbers: [],
      address: "123 MG Road, Bangalore",
      ...overrides,
    },
  };
}

/**
 * Creates a mock failed Mobile 360 verification response.
 */
export function createMockMobile360Failure(
  verificationId: string,
  reason: string = "Verification failed"
): Mobile360VerifyResponse {
  return {
    verification_id: verificationId,
    status: "FAILED",
    message: reason,
  };
}

// ==============================================
// API CALL HELPERS
// ==============================================

/**
 * Headers required for Cashfree API calls.
 */
export function getCashfreeHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-client-id": CASHFREE_SANDBOX.APP_ID,
    "x-client-secret": CASHFREE_SANDBOX.SECRET_KEY,
    "x-api-version": CASHFREE_SANDBOX.API_VERSION,
  };
}

// ==============================================
// TEST SCENARIO GENERATORS
// ==============================================

export const CashfreeTestScenarios = {
  pennyDrop: {
    /** Valid bank account verification */
    validAccount: () =>
      createMockPennyDropSuccess({
        name_at_bank: "RAMESH KUMAR",
        bank_name: "HDFC Bank",
      }),

    /** Invalid bank account */
    invalidAccount: () =>
      createMockPennyDropFailure("Account does not exist"),

    /** Name mismatch (partial match) */
    nameMismatch: (nameAtBank: string) =>
      createMockPennyDropSuccess({ name_at_bank: nameAtBank }),

    /** Network error / indeterminate */
    indeterminate: () => createMockPennyDropIndeterminate(),
  },

  mobile360: {
    /** Full data found */
    fullData: (verificationId: string) =>
      createMockMobile360Success(verificationId, {
        full_name: "Atri Sharma",
        pan_status: "VALID",
        aadhaar_linked: true,
      }),

    /** Partial data (no PAN) */
    partialData: (verificationId: string) =>
      createMockMobile360Success(verificationId, {
        full_name: "Atri Sharma",
        pan_status: "NOT_FOUND",
        aadhaar_linked: false,
      }),

    /** No data found */
    notFound: (verificationId: string) =>
      createMockMobile360Failure(verificationId, "No data found for this number"),

    /** OTP verification failed */
    otpFailed: (verificationId: string) =>
      createMockMobile360Failure(verificationId, "Invalid OTP"),
  },
};

// ==============================================
// NAME MATCHING HELPER
// ==============================================

/**
 * Calculates name match percentage (for bank verification).
 * Uses Levenshtein distance normalized to percentage.
 *
 * @param name1 - First name (e.g., from agreement)
 * @param name2 - Second name (e.g., from bank)
 * @returns Match percentage (0-100)
 */
export function calculateNameMatch(name1: string, name2: string): number {
  // Normalize names
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const n1 = normalize(name1);
  const n2 = normalize(name2);

  if (n1 === n2) return 100;
  if (!n1 || !n2) return 0;

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
  return Math.round((1 - distance / maxLen) * 100);
}
