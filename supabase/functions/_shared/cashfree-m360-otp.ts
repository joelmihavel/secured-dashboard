/**
 * Cashfree Mobile 360 OTP API — Shared Module
 *
 * Extracted from verify-identity/index.ts for reuse by both
 * auth-otp (unified OTP routing) and verify-identity (legacy flow).
 *
 * IMPORTANT: Env vars are read lazily per invocation, NOT at module scope.
 * This prevents cold-start failures when importing without needing all env vars.
 */

import { ExternalServiceError } from "./errors.ts";

// ==============================================
// TYPES
// ==============================================

export interface Mobile360SendOtpResponse {
  verification_id: string;
  status: "OTP_GENERATED" | "OTP_GENERATION_FAILED" | "INVALID_MOBILE_NUMBER";
  message?: string;
}

export interface Mobile360VerifyOtpResponse {
  verification_id: string;
  reference_id: string;
  status: "SUCCESS" | "DETAILS_NOT_FOUND" | "OTP_INVALID" | "OTP_EXPIRED" | "VERIFICATION_FAILED";
  message?: string;
  data?: Mobile360IdentityData;
}

export interface Mobile360IdentityData {
  full_name?: string;
  gender?: string;
  dob?: string;
  age?: number;
  occupation?: string;
  total_income?: string;
  relatives?: Array<{ name: string; relation: string }>;
  phone_numbers?: Array<{ number: string; type: string; source: string }>;
  emails?: Array<{ email: string; source: string }>;
  pan_details?: Array<{
    pan: string;
    name: string;
    type: string;
    aadhaar_linked: boolean;
  }>;
  aadhaar_number?: string;
  passport_details?: unknown[];
  driving_license_details?: unknown[];
  voter_details?: unknown[];
  ration_card_details?: unknown[];
  bank_accounts?: Array<{
    account_number: string;
    ifsc: string;
    bank_name: string;
  }>;
  employment_details?: {
    uan?: string;
    epfo?: string;
    establishment?: string;
  };
  addresses?: Array<{
    address: string;
    city: string;
    state: string;
    pincode: string;
    type: string;
    source: string;
  }>;
  credit_score?: number;
  mobile_intelligence?: {
    valid: boolean;
    subscriber_status: string;
    connection_type: string;
    provider: string;
    connection_date?: string;
  };
  risk_intelligence?: {
    safe: boolean;
    risk_level: string;
    reason: string;
    description: string;
  };
  social_profiles?: Array<{
    platform: string;
    url: string;
    username: string;
  }>;
}

export interface SendOtpParams {
  verification_id: string;
  mobile_number: string;
  name: string;
  notification_modes: ("sms" | "whatsapp")[];
  consent_ip: string;
}

export interface VerifyOtpParams {
  verification_id: string;
  otp: string;
}

// ==============================================
// HELPERS
// ==============================================

function getCashfreeConfig() {
  const appId = Deno.env.get("CASHFREE_APP_ID");
  const secretKey = Deno.env.get("CASHFREE_SECRET_KEY");
  const baseUrl = Deno.env.get("CASHFREE_BASE_URL") ?? "https://sandbox.cashfree.com/verification";

  if (!appId || !secretKey) {
    throw new ExternalServiceError("Cashfree", "API credentials not configured");
  }

  return { appId, secretKey, baseUrl };
}

/**
 * Generates Cashfree x-cf-signature header using RSA public key encryption.
 * Encrypts "{clientId}.{unixTimestamp}" with the public key (RSA-OAEP + SHA-256).
 * Returns { signature, timestamp } for use in request headers.
 */
export async function generateCfSignature(
  clientId: string
): Promise<{ signature: string; timestamp: string }> {
  const publicKeyPem = Deno.env.get("CASHFREE_PUBLIC_KEY");
  if (!publicKeyPem) {
    throw new ExternalServiceError("Cashfree", "Public key not configured (CASHFREE_PUBLIC_KEY)");
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payload = `${clientId}.${timestamp}`;

  // Parse PEM → DER
  const pemBody = publicKeyPem
    .replace(/-----BEGIN PUBLIC KEY-----/, "")
    .replace(/-----END PUBLIC KEY-----/, "")
    .replace(/\s+/g, "");
  const binaryDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  // Import RSA public key (Cashfree uses OAEPWithSHA-1AndMGF1Padding)
  const cryptoKey = await crypto.subtle.importKey(
    "spki",
    binaryDer.buffer,
    { name: "RSA-OAEP", hash: "SHA-1" },
    false,
    ["encrypt"]
  );

  // Encrypt payload
  const encoded = new TextEncoder().encode(payload);
  const encrypted = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    cryptoKey,
    encoded
  );

  // Base64 encode
  const signature = btoa(String.fromCharCode(...new Uint8Array(encrypted)));

  return { signature, timestamp };
}

/**
 * Builds the standard Cashfree API headers including x-cf-signature.
 */
async function getCashfreeHeaders(
  appId: string,
  secretKey: string
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-client-id": appId,
    "x-client-secret": secretKey,
    "x-api-version": "2024-12-01",
  };

  try {
    const { signature } = await generateCfSignature(appId);
    headers["x-cf-signature"] = signature;
  } catch (err) {
    // If public key isn't configured, proceed without signature (backwards compat)
    console.warn("[cashfree-m360-otp] x-cf-signature not added:", err instanceof Error ? err.message : String(err));
  }

  return headers;
}

// ==============================================
// SEND OTP
// ==============================================

/**
 * Sends OTP via Cashfree Mobile 360 API.
 * Requires a valid client IP for consent compliance.
 */
export async function callCashfreeSendOtp(
  params: SendOtpParams
): Promise<Mobile360SendOtpResponse> {
  const { appId, secretKey, baseUrl } = getCashfreeConfig();

  // Validate consent_ip
  if (!params.consent_ip || params.consent_ip === "0.0.0.0" || params.consent_ip === "") {
    throw new ExternalServiceError(
      "Cashfree",
      "Valid client IP address is required for consent compliance"
    );
  }

  try {
    const headers = await getCashfreeHeaders(appId, secretKey);
    const response = await fetch(`${baseUrl}/mobile360/otp/send`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        verification_id: params.verification_id,
        mobile_number: params.mobile_number,
        name: params.name,
        user_consent: {
          obtained: true,
          type: "EXPLICIT",
          timestamp: new Date().toISOString(),
          purpose: "Identity verification for rental services",
          network_details: {
            ip: params.consent_ip,
          },
        },
        notification_modes: params.notification_modes.map((m) => m.toUpperCase()),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[cashfree-m360-otp] Send OTP API error:", data);

      if (data.code === "invalid_mobile_number") {
        return {
          verification_id: params.verification_id,
          status: "INVALID_MOBILE_NUMBER",
          message: "Invalid mobile number format",
        };
      }

      throw new ExternalServiceError(
        "Cashfree",
        data.message ?? `HTTP ${response.status}`
      );
    }

    return {
      verification_id: data.verification_id ?? params.verification_id,
      status: data.status ?? "OTP_GENERATED",
      message: data.message,
    };
  } catch (error) {
    if (error instanceof ExternalServiceError) throw error;

    console.error("[cashfree-m360-otp] Send OTP failed:", error);
    throw new ExternalServiceError(
      "Cashfree",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

// ==============================================
// VERIFY OTP
// ==============================================

/**
 * Verifies OTP via Cashfree Mobile 360 API.
 * Returns identity data on success.
 */
export async function callCashfreeVerifyOtp(
  params: VerifyOtpParams
): Promise<Mobile360VerifyOtpResponse> {
  const { appId, secretKey, baseUrl } = getCashfreeConfig();

  try {
    const headers = await getCashfreeHeaders(appId, secretKey);
    const response = await fetch(`${baseUrl}/mobile360/otp/verify`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        verification_id: params.verification_id,
        otp: params.otp,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[cashfree-m360-otp] Verify OTP API error:", data);

      if (data.code === "otp_invalid" || data.status === "OTP_INVALID") {
        return {
          verification_id: params.verification_id,
          reference_id: data.reference_id ?? params.verification_id,
          status: "OTP_INVALID",
          message: "Invalid OTP. Please try again.",
        };
      }

      if (data.code === "otp_expired" || data.status === "OTP_EXPIRED") {
        return {
          verification_id: params.verification_id,
          reference_id: data.reference_id ?? params.verification_id,
          status: "OTP_EXPIRED",
          message: "OTP has expired. Please request a new one.",
        };
      }

      if (data.status === "DETAILS_NOT_FOUND") {
        return {
          verification_id: params.verification_id,
          reference_id: data.reference_id ?? params.verification_id,
          status: "DETAILS_NOT_FOUND",
          message: "No identity data found for this phone number",
        };
      }

      throw new ExternalServiceError(
        "Cashfree",
        data.message ?? `HTTP ${response.status}`
      );
    }

    return {
      verification_id: data.verification_id ?? params.verification_id,
      reference_id: data.reference_id ?? params.verification_id,
      status: data.status ?? "SUCCESS",
      data: {
        full_name: data.full_name ?? data.name,
        gender: data.gender,
        dob: data.dob,
        age: data.age,
        occupation: data.occupation,
        total_income: data.total_income,
        relatives: data.relatives,
        phone_numbers: data.phone_numbers,
        emails: data.emails,
        pan_details: data.pan_details,
        aadhaar_number: data.aadhaar_number,
        passport_details: data.passport_details,
        driving_license_details: data.driving_license_details,
        voter_details: data.voter_details,
        ration_card_details: data.ration_card_details,
        bank_accounts: data.bank_accounts,
        employment_details: data.employment_details,
        addresses: data.addresses,
        credit_score: data.credit_score,
        mobile_intelligence: data.mobile_intelligence,
        risk_intelligence: data.risk_intelligence,
        social_profiles: data.social_profiles,
      },
    };
  } catch (error) {
    if (error instanceof ExternalServiceError) throw error;

    console.error("[cashfree-m360-otp] Verify OTP failed:", error);
    throw new ExternalServiceError(
      "Cashfree",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}
