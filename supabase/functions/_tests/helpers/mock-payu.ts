/**
 * Flent Secured v2 - PayU Mock Utilities
 *
 * Provides mock PayU payloads and hash calculation for testing.
 * Reference: https://devguide.payu.in/
 */

// ==============================================
// SANDBOX CREDENTIALS (Safe for testing)
// ==============================================

export const PAYU_SANDBOX = {
  MERCHANT_KEY: Deno.env.get("PAYU_MERCHANT_KEY") || "gtKFFx",
  MERCHANT_SALT: Deno.env.get("PAYU_MERCHANT_SALT") || "eCwWELxi",
  BASE_URL: Deno.env.get("PAYU_BASE_URL") || "https://sandboxsecure.payu.in",
} as const;

// ==============================================
// TEST CARDS AND UPI
// ==============================================

export const PAYU_TEST_CARDS = {
  VISA_SUCCESS: {
    number: "4012001037141112",
    cvv: "123",
    expiry: "12/25",
    name: "Test User",
  },
  MASTERCARD_FAILURE: {
    number: "5123456789012346",
    cvv: "123",
    expiry: "12/25",
    name: "Test User",
  },
} as const;

export const PAYU_TEST_UPI = {
  SUCCESS: "success@payu",
  FAILURE: "failure@payu",
} as const;

// ==============================================
// PAYLOAD GENERATORS
// ==============================================

interface PayUWebhookPayload {
  mihpayid: string;
  status: "success" | "failure" | "pending";
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  lastname?: string;
  email: string;
  phone: string;
  hash: string;
  mode: string;
  bank_ref_num?: string;
  error_Message?: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
}

/**
 * Creates a mock PayU webhook payload.
 * Use for testing payment-webhook Edge Function.
 */
export function createMockPayUWebhook(
  overrides: Partial<PayUWebhookPayload> = {}
): PayUWebhookPayload {
  const defaults: PayUWebhookPayload = {
    mihpayid: `MOCK_${Date.now()}`,
    status: "success",
    txnid: `TEST_TXN_${Date.now()}`,
    amount: "50000.00",
    productinfo: "Rent Payment - February 2024",
    firstname: "Test",
    lastname: "User",
    email: "test@example.com",
    phone: "9999999901",
    hash: "", // Will be calculated
    mode: "UPI",
    bank_ref_num: `REF_${Date.now()}`,
    udf1: "",
    udf2: "",
    udf3: "",
    udf4: "",
    udf5: "",
  };

  const payload = { ...defaults, ...overrides };

  // Calculate hash if not provided
  if (!payload.hash) {
    payload.hash = calculatePayUResponseHash(payload);
  }

  return payload;
}

/**
 * Creates a mock PayU payment initiation response.
 */
export function createMockPayUInitResponse(txnid: string, amount: string) {
  return {
    key: PAYU_SANDBOX.MERCHANT_KEY,
    txnid,
    amount,
    productinfo: "Rent Payment",
    firstname: "Test",
    email: "test@example.com",
    phone: "9999999901",
    surl: "http://localhost:3000/payment/success",
    furl: "http://localhost:3000/payment/failure",
    hash: calculatePayURequestHash({
      txnid,
      amount,
      productinfo: "Rent Payment",
      firstname: "Test",
      email: "test@example.com",
    }),
  };
}

// ==============================================
// HASH CALCULATION
// ==============================================

/**
 * Calculates PayU request hash (for initiating payment).
 * Formula: sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt)
 */
export function calculatePayURequestHash(params: {
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
}): string {
  const hashString = [
    PAYU_SANDBOX.MERCHANT_KEY,
    params.txnid,
    params.amount,
    params.productinfo,
    params.firstname,
    params.email,
    params.udf1 || "",
    params.udf2 || "",
    params.udf3 || "",
    params.udf4 || "",
    params.udf5 || "",
    "", "", "", "", "", // Reserved fields
    PAYU_SANDBOX.MERCHANT_SALT,
  ].join("|");

  return sha512Sync(hashString);
}

/**
 * Calculates PayU response hash (for webhook verification).
 * Formula: sha512(salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
 */
export function calculatePayUResponseHash(payload: PayUWebhookPayload): string {
  const hashString = [
    PAYU_SANDBOX.MERCHANT_SALT,
    payload.status,
    "", "", "", "", "", // Reserved fields
    payload.udf5 || "",
    payload.udf4 || "",
    payload.udf3 || "",
    payload.udf2 || "",
    payload.udf1 || "",
    payload.email,
    payload.firstname,
    payload.productinfo,
    payload.amount,
    payload.txnid,
    PAYU_SANDBOX.MERCHANT_KEY,
  ].join("|");

  return sha512Sync(hashString);
}

/**
 * Calculates hash for verify_payment API.
 */
export function calculatePayUVerifyHash(txnid: string): string {
  const hashString = `${PAYU_SANDBOX.MERCHANT_KEY}|verify_payment|${txnid}|${PAYU_SANDBOX.MERCHANT_SALT}`;
  return sha512Sync(hashString);
}

// ==============================================
// CRYPTO HELPERS
// ==============================================

/**
 * Synchronous SHA-512 hash (for Deno).
 */
function sha512Sync(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);

  // Use Web Crypto API
  const hashBuffer = new Uint8Array(64);
  const hash = crypto.subtle.digestSync
    ? crypto.subtle.digestSync("SHA-512", data)
    : null;

  if (hash) {
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // Fallback for async-only environments (use with await)
  throw new Error("Use calculatePayUHashAsync for this environment");
}

/**
 * Async SHA-512 hash (works everywhere).
 */
export async function sha512Async(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hash = await crypto.subtle.digest("SHA-512", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ==============================================
// VERIFICATION HELPERS
// ==============================================

/**
 * Verifies a PayU webhook hash.
 * Returns true if the hash is valid.
 */
export function verifyPayUWebhookHash(payload: PayUWebhookPayload): boolean {
  const expectedHash = calculatePayUResponseHash({
    ...payload,
    hash: "", // Exclude hash from calculation
  });
  return payload.hash.toLowerCase() === expectedHash.toLowerCase();
}

// ==============================================
// TEST SCENARIO GENERATORS
// ==============================================

/**
 * Generates payloads for common test scenarios.
 */
export const PayUTestScenarios = {
  /** Successful UPI payment */
  successfulUPI: (txnid: string) =>
    createMockPayUWebhook({
      txnid,
      status: "success",
      mode: "UPI",
      bank_ref_num: `UPI_${Date.now()}`,
    }),

  /** Successful card payment */
  successfulCard: (txnid: string) =>
    createMockPayUWebhook({
      txnid,
      status: "success",
      mode: "CC",
      bank_ref_num: `CARD_${Date.now()}`,
    }),

  /** Failed payment (insufficient funds) */
  failedInsufficientFunds: (txnid: string) =>
    createMockPayUWebhook({
      txnid,
      status: "failure",
      error_Message: "Insufficient funds",
    }),

  /** Failed payment (user cancelled) */
  failedUserCancelled: (txnid: string) =>
    createMockPayUWebhook({
      txnid,
      status: "failure",
      error_Message: "User cancelled transaction",
    }),

  /** Pending payment */
  pendingPayment: (txnid: string) =>
    createMockPayUWebhook({
      txnid,
      status: "pending",
    }),

  /** Invalid hash (for testing rejection) */
  invalidHash: (txnid: string) =>
    createMockPayUWebhook({
      txnid,
      status: "success",
      hash: "invalid_hash_12345",
    }),
};
