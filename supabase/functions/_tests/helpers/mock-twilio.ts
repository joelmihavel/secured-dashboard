/**
 * Flent Secured v2 - Twilio Mock Utilities
 *
 * Provides mock Twilio responses for OTP and WhatsApp testing.
 * Reference: https://www.twilio.com/docs/verify/api
 */

// ==============================================
// SANDBOX CONFIGURATION
// ==============================================

export const TWILIO_CONFIG = {
  ACCOUNT_SID: Deno.env.get("TWILIO_ACCOUNT_SID") || "AC_test_account_sid",
  AUTH_TOKEN: Deno.env.get("TWILIO_AUTH_TOKEN") || "test_auth_token",
  VERIFY_SERVICE_SID: Deno.env.get("TWILIO_VERIFY_SERVICE_SID") || "VA_test_service_sid",
  // Magic test code (when test mode is enabled in Twilio console)
  TEST_OTP: "123456",
} as const;

// ==============================================
// TEST PHONE NUMBERS
// ==============================================

export const TWILIO_TEST_PHONES = {
  // Standard test numbers (Twilio test credentials)
  SUCCESS: "+15005550006",
  INVALID_NUMBER: "+15005550001",
  CANNOT_ROUTE: "+15005550002",
  // Indian test numbers (for local testing)
  INDIA_SUCCESS: "+919999999901",
  INDIA_FAILURE: "+919999999902",
} as const;

// ==============================================
// VERIFICATION RESPONSES
// ==============================================

interface VerificationResponse {
  sid: string;
  service_sid: string;
  account_sid: string;
  to: string;
  channel: "sms" | "whatsapp" | "call" | "email";
  status: "pending" | "approved" | "canceled" | "max_attempts_reached" | "deleted" | "failed" | "expired";
  valid: boolean;
  date_created: string;
  date_updated: string;
  lookup?: {
    carrier?: {
      name: string;
      type: string;
    };
  };
}

interface VerificationCheckResponse {
  sid: string;
  service_sid: string;
  account_sid: string;
  to: string;
  channel: "sms" | "whatsapp" | "call" | "email";
  status: "pending" | "approved" | "canceled" | "max_attempts_reached" | "deleted" | "failed" | "expired";
  valid: boolean;
  date_created: string;
  date_updated: string;
}

/**
 * Creates a mock verification start response (OTP sent).
 */
export function createMockVerificationStart(
  to: string,
  channel: "sms" | "whatsapp" = "sms"
): VerificationResponse {
  const now = new Date().toISOString();
  return {
    sid: `VE_${Date.now()}`,
    service_sid: TWILIO_CONFIG.VERIFY_SERVICE_SID,
    account_sid: TWILIO_CONFIG.ACCOUNT_SID,
    to,
    channel,
    status: "pending",
    valid: false,
    date_created: now,
    date_updated: now,
    lookup: {
      carrier: {
        name: "Test Carrier",
        type: "mobile",
      },
    },
  };
}

/**
 * Creates a mock verification check response (OTP verified).
 */
export function createMockVerificationCheck(
  to: string,
  valid: boolean,
  channel: "sms" | "whatsapp" = "sms"
): VerificationCheckResponse {
  const now = new Date().toISOString();
  return {
    sid: `VE_${Date.now()}`,
    service_sid: TWILIO_CONFIG.VERIFY_SERVICE_SID,
    account_sid: TWILIO_CONFIG.ACCOUNT_SID,
    to,
    channel,
    status: valid ? "approved" : "pending",
    valid,
    date_created: now,
    date_updated: now,
  };
}

// ==============================================
// ERROR RESPONSES
// ==============================================

interface TwilioError {
  code: number;
  message: string;
  more_info: string;
  status: number;
}

export const TwilioErrors = {
  /** Invalid phone number format */
  INVALID_NUMBER: {
    code: 60033,
    message: "Invalid parameter `To`: +15005550001",
    more_info: "https://www.twilio.com/docs/errors/60033",
    status: 400,
  } as TwilioError,

  /** Cannot route to number */
  CANNOT_ROUTE: {
    code: 60082,
    message: "Cannot send verification to this phone number",
    more_info: "https://www.twilio.com/docs/errors/60082",
    status: 400,
  } as TwilioError,

  /** Rate limit exceeded */
  RATE_LIMIT: {
    code: 60203,
    message: "Max send attempts reached",
    more_info: "https://www.twilio.com/docs/errors/60203",
    status: 429,
  } as TwilioError,

  /** Wrong OTP */
  WRONG_CODE: {
    code: 60022,
    message: "Invalid verification code",
    more_info: "https://www.twilio.com/docs/errors/60022",
    status: 400,
  } as TwilioError,

  /** Verification expired */
  EXPIRED: {
    code: 60023,
    message: "Verification has expired",
    more_info: "https://www.twilio.com/docs/errors/60023",
    status: 400,
  } as TwilioError,

  /** Max attempts reached */
  MAX_ATTEMPTS: {
    code: 60202,
    message: "Max check attempts reached",
    more_info: "https://www.twilio.com/docs/errors/60202",
    status: 400,
  } as TwilioError,
};

// ==============================================
// WHATSAPP MESSAGE RESPONSES
// ==============================================

interface WhatsAppMessageResponse {
  sid: string;
  account_sid: string;
  from: string;
  to: string;
  body: string;
  status: "queued" | "sent" | "delivered" | "read" | "failed" | "undelivered";
  date_created: string;
  date_sent: string | null;
  error_code: number | null;
  error_message: string | null;
}

/**
 * Creates a mock WhatsApp message send response.
 */
export function createMockWhatsAppMessage(
  to: string,
  body: string,
  status: WhatsAppMessageResponse["status"] = "queued"
): WhatsAppMessageResponse {
  const now = new Date().toISOString();
  return {
    sid: `SM_${Date.now()}`,
    account_sid: TWILIO_CONFIG.ACCOUNT_SID,
    from: "whatsapp:+14155238886", // Twilio sandbox number
    to: `whatsapp:${to}`,
    body,
    status,
    date_created: now,
    date_sent: status === "queued" ? null : now,
    error_code: null,
    error_message: null,
  };
}

// ==============================================
// API HELPERS
// ==============================================

/**
 * Creates Basic Auth header for Twilio API.
 */
export function getTwilioAuthHeader(): string {
  return `Basic ${btoa(`${TWILIO_CONFIG.ACCOUNT_SID}:${TWILIO_CONFIG.AUTH_TOKEN}`)}`;
}

// ==============================================
// TEST SCENARIO GENERATORS
// ==============================================

export const TwilioTestScenarios = {
  verification: {
    /** OTP sent successfully via SMS */
    otpSentSMS: (phone: string) => createMockVerificationStart(phone, "sms"),

    /** OTP sent successfully via WhatsApp */
    otpSentWhatsApp: (phone: string) => createMockVerificationStart(phone, "whatsapp"),

    /** OTP verified successfully */
    otpVerified: (phone: string) => createMockVerificationCheck(phone, true),

    /** Wrong OTP entered */
    wrongOtp: (phone: string) => createMockVerificationCheck(phone, false),

    /** Invalid phone number */
    invalidPhone: () => TwilioErrors.INVALID_NUMBER,

    /** Rate limited */
    rateLimited: () => TwilioErrors.RATE_LIMIT,

    /** Verification expired */
    expired: () => TwilioErrors.EXPIRED,
  },

  whatsapp: {
    /** Message queued successfully */
    queued: (to: string, body: string) => createMockWhatsAppMessage(to, body, "queued"),

    /** Message sent */
    sent: (to: string, body: string) => createMockWhatsAppMessage(to, body, "sent"),

    /** Message delivered */
    delivered: (to: string, body: string) => createMockWhatsAppMessage(to, body, "delivered"),

    /** Message failed */
    failed: (to: string, body: string) => ({
      ...createMockWhatsAppMessage(to, body, "failed"),
      error_code: 63003,
      error_message: "Channel could not authenticate the request",
    }),
  },
};

// ==============================================
// OTP VALIDATION HELPER
// ==============================================

/**
 * Validates OTP format (6 digits).
 */
export function isValidOtpFormat(otp: string): boolean {
  return /^\d{6}$/.test(otp);
}

/**
 * Checks if the OTP is the test OTP.
 * Use for bypassing real verification in test environments.
 */
export function isTestOtp(otp: string): boolean {
  return otp === TWILIO_CONFIG.TEST_OTP;
}
