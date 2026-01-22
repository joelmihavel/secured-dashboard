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
// MOBILE 360 RESPONSES (OTP Flow)
// ==============================================

interface Mobile360SendOtpResponse {
  verification_id: string;
  status: "OTP_GENERATED" | "OTP_GENERATION_FAILED" | "INVALID_MOBILE_NUMBER";
  message?: string;
}

interface Mobile360VerifyOtpResponse {
  verification_id: string;
  reference_id: string;
  status: "SUCCESS" | "DETAILS_NOT_FOUND" | "OTP_INVALID" | "OTP_EXPIRED" | "VERIFICATION_FAILED";
  data?: {
    full_name?: string;
    gender?: string;
    dob?: string;
    age?: number;
    occupation?: string;
    total_income?: string;
    pan_details?: Array<{
      pan: string;
      name: string;
      type: string;
      aadhaar_linked: boolean;
    }>;
    aadhaar_number?: string;
    addresses?: Array<{
      address: string;
      city: string;
      state: string;
      pincode: string;
    }>;
    credit_score?: number;
    risk_intelligence?: {
      safe: boolean;
      risk_level: string;
    };
  };
  message?: string;
}

/**
 * Creates a mock Mobile 360 OTP generated response.
 */
export function createMockMobile360OtpGenerated(
  verificationId: string
): Mobile360SendOtpResponse {
  return {
    verification_id: verificationId,
    status: "OTP_GENERATED",
  };
}

/**
 * Creates a mock Mobile 360 OTP failed response.
 */
export function createMockMobile360OtpFailed(
  verificationId: string,
  reason: string = "Invalid phone number"
): Mobile360SendOtpResponse {
  return {
    verification_id: verificationId,
    status: "OTP_GENERATION_FAILED",
    message: reason,
  };
}

/**
 * Creates a mock successful Mobile 360 verification response.
 */
export function createMockMobile360Success(
  verificationId: string,
  overrides: Partial<Mobile360VerifyOtpResponse["data"]> = {}
): Mobile360VerifyOtpResponse {
  return {
    verification_id: verificationId,
    reference_id: `REF_${Date.now()}`,
    status: "SUCCESS",
    data: {
      full_name: "Atri Sharma",
      gender: "Male",
      dob: "1990-01-15",
      age: 35,
      occupation: "Software Engineer",
      total_income: "1500000",
      pan_details: [{
        pan: "ABCDE1234F",
        name: "ATRI SHARMA",
        type: "Individual",
        aadhaar_linked: true,
      }],
      aadhaar_number: "123456789012",
      addresses: [{
        address: "123 MG Road",
        city: "Bangalore",
        state: "Karnataka",
        pincode: "560001",
      }],
      credit_score: 750,
      risk_intelligence: {
        safe: true,
        risk_level: "LOW",
      },
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
): Mobile360VerifyOtpResponse {
  return {
    verification_id: verificationId,
    reference_id: `REF_${Date.now()}`,
    status: "VERIFICATION_FAILED",
    message: reason,
  };
}

/**
 * Creates a mock OTP invalid response.
 */
export function createMockMobile360OtpInvalid(
  verificationId: string
): Mobile360VerifyOtpResponse {
  return {
    verification_id: verificationId,
    reference_id: `REF_${Date.now()}`,
    status: "OTP_INVALID",
    message: "Invalid OTP. Please try again.",
  };
}

/**
 * Creates a mock OTP expired response.
 */
export function createMockMobile360OtpExpired(
  verificationId: string
): Mobile360VerifyOtpResponse {
  return {
    verification_id: verificationId,
    reference_id: `REF_${Date.now()}`,
    status: "OTP_EXPIRED",
    message: "OTP has expired. Please request a new one.",
  };
}

/**
 * Creates a mock details not found response.
 */
export function createMockMobile360DetailsNotFound(
  verificationId: string
): Mobile360VerifyOtpResponse {
  return {
    verification_id: verificationId,
    reference_id: `REF_${Date.now()}`,
    status: "DETAILS_NOT_FOUND",
    message: "No identity data found for this phone number",
  };
}

// Backward compatibility alias
export const createMockMobile360OtpSent = createMockMobile360OtpGenerated;

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
    /** OTP generated successfully */
    otpGenerated: (verificationId: string) =>
      createMockMobile360OtpGenerated(verificationId),

    /** OTP generation failed */
    otpGenerationFailed: (verificationId: string) =>
      createMockMobile360OtpFailed(verificationId, "Failed to send OTP"),

    /** Full data found after OTP verification */
    fullData: (verificationId: string) =>
      createMockMobile360Success(verificationId, {
        full_name: "Atri Sharma",
        credit_score: 750,
      }),

    /** Partial data (no PAN) */
    partialData: (verificationId: string) =>
      createMockMobile360Success(verificationId, {
        full_name: "Atri Sharma",
        pan_details: undefined,
        aadhaar_number: undefined,
      }),

    /** No data found */
    notFound: (verificationId: string) =>
      createMockMobile360DetailsNotFound(verificationId),

    /** Invalid OTP */
    otpInvalid: (verificationId: string) =>
      createMockMobile360OtpInvalid(verificationId),

    /** OTP expired */
    otpExpired: (verificationId: string) =>
      createMockMobile360OtpExpired(verificationId),

    /** Verification failed */
    verificationFailed: (verificationId: string) =>
      createMockMobile360Failure(verificationId, "Verification failed"),
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
