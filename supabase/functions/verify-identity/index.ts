/**
 * Flent Secured v2 - Verify Identity Edge Function
 *
 * Verifies user identity using Cashfree Mobile 360 API with OTP flow.
 *
 * Two-step process:
 * 1. action: "send_otp" - Sends OTP to user's mobile
 * 2. action: "verify_otp" - Verifies OTP and retrieves identity data
 *
 * Endpoint: POST /functions/v1/verify-identity
 * Auth: Required (JWT)
 *
 * Reference: https://www.cashfree.com/docs/api-reference/vrs/v2/mobile-360-otp-flow
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  createServiceClient,
  createAuthenticatedClient,
} from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import {
  AppError,
  ValidationError,
  ExternalServiceError,
  handleError,
} from "../_shared/errors.ts";
import { validateSchema, sanitizePhone, maskAadhaar, maskPan } from "../_shared/validation.ts";
import { AuditLogger, AuditActions } from "../_shared/audit.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const CASHFREE_APP_ID = Deno.env.get("CASHFREE_APP_ID");
const CASHFREE_SECRET_KEY = Deno.env.get("CASHFREE_SECRET_KEY");
const CASHFREE_BASE_URL =
  Deno.env.get("CASHFREE_BASE_URL") ?? "https://sandbox.cashfree.com/verification";

// ==============================================
// TYPES
// ==============================================

interface SendOtpRequest {
  action: "send_otp";
  phone_number: string;
  name: string;
  tenancy_id?: string;
  consent_given?: boolean;
  notification_modes?: ("sms" | "whatsapp")[];
}

interface VerifyOtpRequest {
  action: "verify_otp";
  verification_id: string;
  otp: string;
  tenancy_id?: string;
}

type VerifyIdentityRequest = SendOtpRequest | VerifyOtpRequest;

// Response from Send OTP API
interface Mobile360SendOtpResponse {
  verification_id: string;
  status: "OTP_GENERATED" | "OTP_GENERATION_FAILED" | "INVALID_MOBILE_NUMBER";
  message?: string;
}

// Response from Verify OTP API
interface Mobile360VerifyOtpResponse {
  verification_id: string;
  reference_id: string;
  status: "SUCCESS" | "DETAILS_NOT_FOUND" | "OTP_INVALID" | "OTP_EXPIRED" | "VERIFICATION_FAILED";
  message?: string;
  data?: {
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
  };
}

// ==============================================
// VALIDATION SCHEMAS
// ==============================================

const sendOtpSchema = {
  action: { required: true, type: "string" as const, enum: ["send_otp"] },
  phone_number: {
    required: true,
    type: "string" as const,
    minLength: 10,
    maxLength: 15,
  },
  name: {
    required: true,
    type: "string" as const,
    minLength: 2,
    maxLength: 100,
  },
  tenancy_id: { required: false, type: "string" as const },
  consent_given: { required: false, type: "boolean" as const },
  notification_modes: { required: false, type: "array" as const },
};

const verifyOtpSchema = {
  action: { required: true, type: "string" as const, enum: ["verify_otp"] },
  verification_id: {
    required: true,
    type: "string" as const,
    minLength: 1,
    maxLength: 50,
  },
  otp: {
    required: true,
    type: "string" as const,
    minLength: 4,
    maxLength: 6,
  },
  tenancy_id: { required: false, type: "string" as const },
};

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Only allow POST
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const supabase = createServiceClient();
  let audit: AuditLogger | null = null;
  let userId: string | null = null;

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const { userId: uid } = await createAuthenticatedClient(authHeader);
    userId = uid;

    // Initialize audit logger
    audit = AuditLogger.fromRequest(supabase, req, userId, "verify-identity");

    // Parse request body to determine action
    const body = await req.json();

    if (!body.action) {
      throw new ValidationError("action is required", { action: "Required field" });
    }

    // Route based on action
    if (body.action === "send_otp") {
      return await handleSendOtp(body, userId, supabase, audit);
    } else if (body.action === "verify_otp") {
      return await handleVerifyOtp(body, userId, supabase, audit);
    } else {
      throw new ValidationError("Invalid action. Use 'send_otp' or 'verify_otp'", {
        action: "Must be 'send_otp' or 'verify_otp'",
      });
    }
  } catch (error) {
    // Log failure if audit logger initialized
    if (audit && userId) {
      await audit.logFailure(
        AuditActions.IDENTITY_VERIFICATION_FAILED,
        "verification",
        error instanceof AppError ? error.code : "UNKNOWN_ERROR",
        error instanceof Error ? error.message : "Unknown error",
        "identity_verification"
      );
    }

    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});

// ==============================================
// SEND OTP HANDLER
// ==============================================

async function handleSendOtp(
  body: unknown,
  userId: string,
  supabase: ReturnType<typeof createServiceClient>,
  audit: AuditLogger
): Promise<Response> {
  // Validate request
  const validatedBody = validateSchema<SendOtpRequest>(body, sendOtpSchema, true);
  const {
    phone_number,
    name,
    tenancy_id,
    consent_given = true,
    notification_modes = ["sms"],
  } = validatedBody;

  // Sanitize phone number
  const sanitizedPhone = sanitizePhone(phone_number);

  // Verify consent
  if (!consent_given) {
    throw new ValidationError("User consent is required for identity verification");
  }

  // Generate verification ID
  const verificationId = `FLENT_M360_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  // Log OTP initiation
  await audit.logSuccess(
    AuditActions.IDENTITY_VERIFICATION_INITIATED,
    "verification",
    "identity_verification",
    undefined,
    {
      phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`,
      tenancy_id,
      action: "send_otp",
    }
  );

  // Call Cashfree Send OTP API
  const otpResult = await callCashfreeSendOtp({
    verification_id: verificationId,
    mobile_number: sanitizedPhone,
    name,
    notification_modes,
  });

  // Store pending verification record
  const { error: insertError } = await supabase
    .from("identity_verifications")
    .insert({
      user_id: userId,
      tenancy_id: tenancy_id ?? null,
      verification_id: otpResult.verification_id,
      status: "OTP_SENT",
      m360_full_name: name, // Store provided name for reference
    });

  if (insertError) {
    console.error("Failed to insert identity verification:", insertError);
    // Don't fail - OTP was already sent
  }

  return jsonResponse({
    success: true,
    data: {
      verification_id: otpResult.verification_id,
      status: otpResult.status,
      message:
        otpResult.status === "OTP_GENERATED"
          ? "OTP sent successfully. Please verify to complete identity check."
          : otpResult.message ?? "Failed to send OTP",
    },
  });
}

// ==============================================
// VERIFY OTP HANDLER
// ==============================================

async function handleVerifyOtp(
  body: unknown,
  userId: string,
  supabase: ReturnType<typeof createServiceClient>,
  audit: AuditLogger
): Promise<Response> {
  // Validate request
  const validatedBody = validateSchema<VerifyOtpRequest>(body, verifyOtpSchema, true);
  const { verification_id, otp, tenancy_id } = validatedBody;

  // Verify the pending verification exists and belongs to user
  const { data: pendingVerification, error: fetchError } = await supabase
    .from("identity_verifications")
    .select("id, user_id, status")
    .eq("verification_id", verification_id)
    .eq("user_id", userId)
    .single();

  if (fetchError || !pendingVerification) {
    throw new ValidationError("Verification not found or expired", {
      verification_id: "Not found",
    });
  }

  if (pendingVerification.status !== "OTP_SENT") {
    throw new ValidationError("Verification already completed or invalid state", {
      status: pendingVerification.status,
    });
  }

  // Call Cashfree Verify OTP API
  const m360Result = await callCashfreeVerifyOtp({
    verification_id,
    otp,
  });

  // Prepare verification data
  const verificationData = {
    reference_id: m360Result.reference_id,
    status: m360Result.status === "SUCCESS" ? "SUCCESS" : m360Result.status,
    verified_at: m360Result.status === "SUCCESS" ? new Date().toISOString() : null,

    // Personal details
    m360_full_name: m360Result.data?.full_name,
    m360_gender: m360Result.data?.gender,
    m360_date_of_birth: m360Result.data?.dob,
    m360_age: m360Result.data?.age,
    m360_occupation: m360Result.data?.occupation,
    m360_total_income: m360Result.data?.total_income,
    m360_relatives: m360Result.data?.relatives,

    // Contact info
    m360_phone_numbers: m360Result.data?.phone_numbers,
    m360_emails: m360Result.data?.emails,

    // Identity documents (masked)
    m360_pan_details: m360Result.data?.pan_details?.map((p) => ({
      ...p,
      pan: maskPan(p.pan),
    })),
    m360_aadhaar_masked: m360Result.data?.aadhaar_number
      ? maskAadhaar(m360Result.data.aadhaar_number)
      : null,
    m360_passport_details: m360Result.data?.passport_details,
    m360_driving_license_details: m360Result.data?.driving_license_details,
    m360_voter_details: m360Result.data?.voter_details,
    m360_ration_card_details: m360Result.data?.ration_card_details,

    // Financial data (masked)
    m360_bank_accounts: m360Result.data?.bank_accounts?.map((b) => ({
      account_masked: `XXXX${b.account_number.slice(-4)}`,
      ifsc: b.ifsc,
      bank_name: b.bank_name,
    })),
    m360_employment_details: m360Result.data?.employment_details,

    // Addresses
    m360_addresses: m360Result.data?.addresses,

    // Intelligence scores
    m360_credit_score: m360Result.data?.credit_score,
    m360_mobile_intelligence: m360Result.data?.mobile_intelligence,
    m360_risk_intelligence: m360Result.data?.risk_intelligence,

    // Social profiles
    m360_social_profiles: m360Result.data?.social_profiles,

    // Raw response (for audit, will be encrypted at rest)
    raw_response: m360Result,
  };

  // Update verification record
  const { data: verification, error: updateError } = await supabase
    .from("identity_verifications")
    .update(verificationData)
    .eq("id", pendingVerification.id)
    .select()
    .single();

  if (updateError) {
    console.error("Failed to update identity verification:", updateError);
    throw new AppError("Failed to save verification result", "DB_ERROR", 500);
  }

  // Update user profile with verified name if successful
  if (m360Result.status === "SUCCESS" && m360Result.data?.full_name) {
    const nameParts = m360Result.data.full_name.split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ");

    await supabase
      .from("users")
      .update({
        first_name: firstName,
        last_name: lastName || null,
        full_name: m360Result.data.full_name,
      })
      .eq("id", userId);
  }

  // Log result
  if (m360Result.status === "SUCCESS") {
    await audit.logSuccess(
      AuditActions.IDENTITY_VERIFICATION_SUCCESS,
      "verification",
      "identity_verification",
      verification.id,
      {
        has_name: !!m360Result.data?.full_name,
        has_credit_score: !!m360Result.data?.credit_score,
        risk_level: m360Result.data?.risk_intelligence?.risk_level,
      }
    );
  } else {
    await audit.logFailure(
      AuditActions.IDENTITY_VERIFICATION_FAILED,
      "verification",
      m360Result.status,
      m360Result.message ?? "Verification failed",
      "identity_verification",
      verification.id
    );
  }

  // Return sanitized response
  return jsonResponse({
    success: m360Result.status === "SUCCESS",
    data: {
      verification_id: verification.id,
      status: verification.status,
      name: m360Result.data?.full_name,
      has_pan: !!m360Result.data?.pan_details?.length,
      has_aadhaar: !!m360Result.data?.aadhaar_number,
      credit_score: m360Result.data?.credit_score,
      risk_safe: m360Result.data?.risk_intelligence?.safe ?? true,
      message:
        m360Result.status === "SUCCESS"
          ? "Identity verified successfully"
          : m360Result.status === "DETAILS_NOT_FOUND"
          ? "No identity data found for this phone number"
          : m360Result.message ?? "Verification failed",
    },
  });
}

// ==============================================
// CASHFREE MOBILE 360 SEND OTP API
// ==============================================

interface SendOtpParams {
  verification_id: string;
  mobile_number: string;
  name: string;
  notification_modes: ("sms" | "whatsapp")[];
}

async function callCashfreeSendOtp(
  params: SendOtpParams
): Promise<Mobile360SendOtpResponse> {
  if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    throw new ExternalServiceError("Cashfree", "API credentials not configured");
  }

  try {
    const response = await fetch(`${CASHFREE_BASE_URL}/mobile360/otp/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
        "x-api-version": "2024-12-01",
      },
      body: JSON.stringify({
        verification_id: params.verification_id,
        mobile_number: params.mobile_number,
        name: params.name,
        user_consent: {
          consent_given: true,
          consent_timestamp: new Date().toISOString(),
          consent_ip: "0.0.0.0", // Will be replaced by actual IP in production
        },
        notification_modes: params.notification_modes.map((m) => m.toUpperCase()),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Cashfree Send OTP API error:", data);

      // Handle specific error cases
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

    console.error("Cashfree Send OTP failed:", error);
    throw new ExternalServiceError(
      "Cashfree",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

// ==============================================
// CASHFREE MOBILE 360 VERIFY OTP API
// ==============================================

interface VerifyOtpParams {
  verification_id: string;
  otp: string;
}

async function callCashfreeVerifyOtp(
  params: VerifyOtpParams
): Promise<Mobile360VerifyOtpResponse> {
  if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    throw new ExternalServiceError("Cashfree", "API credentials not configured");
  }

  try {
    const response = await fetch(`${CASHFREE_BASE_URL}/mobile360/otp/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
        "x-api-version": "2024-12-01",
      },
      body: JSON.stringify({
        verification_id: params.verification_id,
        otp: params.otp,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Cashfree Verify OTP API error:", data);

      // Handle specific error cases
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

      // No data found is a valid response
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

    // Map Cashfree response to our interface
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

    console.error("Cashfree Verify OTP failed:", error);
    throw new ExternalServiceError(
      "Cashfree",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}
