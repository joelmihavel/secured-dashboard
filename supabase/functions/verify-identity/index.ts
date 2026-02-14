/**
 * Flent Secured v2 - Verify Identity Edge Function
 *
 * Verifies user identity using Cashfree Mobile 360 API.
 *
 * Supports multiple flows:
 * 1. action: "send_otp" - Sends OTP via Cashfree (legacy, if Twilio consent not available)
 * 2. action: "verify_otp" - Verifies Cashfree OTP and retrieves identity data (legacy)
 * 3. action: "fetch_with_consent" - Uses pre-recorded consent from Twilio auth (preferred)
 *
 * The preferred flow is:
 * - User authenticates via auth-otp (Twilio Verify) with consent_for_mobile360=true
 * - User calls verify-identity with action: "fetch_with_consent"
 * - This function uses the pre-recorded consent to fetch Mobile 360 data
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

interface FetchWithConsentRequest {
  action: "fetch_with_consent";
  tenancy_id?: string;
  consent_timestamp?: string;
  name?: string;
}

type VerifyIdentityRequest = SendOtpRequest | VerifyOtpRequest | FetchWithConsentRequest;

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

const fetchWithConsentSchema = {
  action: { required: true, type: "string" as const, enum: ["fetch_with_consent"] },
  tenancy_id: { required: false, type: "string" as const },
  consent_timestamp: { required: false, type: "string" as const },
  name: { required: false, type: "string" as const },
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

    // Get client IP for consent tracking - CRITICAL for compliance
    const clientIp = getClientIp(req);
    if (clientIp === "0.0.0.0" || !clientIp) {
      console.warn("[verify-identity] Unable to determine client IP - compliance risk");
    }

    // Route based on action
    if (body.action === "send_otp") {
      return await handleSendOtp(body, userId, supabase, audit, clientIp);
    } else if (body.action === "verify_otp") {
      return await handleVerifyOtp(body, userId, supabase, audit);
    } else if (body.action === "fetch_with_consent") {
      // Fetch user details for consent-based flow
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, phone, email")
        .eq("id", userId)
        .single();

      if (userError || !userData) {
        throw new ValidationError("User not found", { user_id: "Not found" });
      }

      return await handleFetchWithConsent(body, userId, supabase, audit, userData, clientIp);
    } else {
      throw new ValidationError("Invalid action. Use 'send_otp', 'verify_otp', or 'fetch_with_consent'", {
        action: "Must be 'send_otp', 'verify_otp', or 'fetch_with_consent'",
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
  audit: AuditLogger,
  clientIp: string
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

  // COMPLIANCE FIX: Validate client IP is available for consent tracking
  if (!clientIp || clientIp === "0.0.0.0") {
    throw new ValidationError(
      "Unable to determine your IP address. This is required for consent compliance. Please try again or contact support.",
      { client_ip: "Required for consent tracking" }
    );
  }

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
    consent_ip: clientIp,
  });

  // Store pending verification record
  // BUG FIX: Check if record exists first to avoid constraint violations
  // Also include consent_ip and consent_timestamp for compliance
  const { data: existingRecord } = await supabase
    .from("identity_verifications")
    .select("id")
    .eq("verification_id", otpResult.verification_id)
    .maybeSingle();

  let insertError: Error | null = null;

  if (existingRecord) {
    // Update existing record
    const { error } = await supabase
      .from("identity_verifications")
      .update({
        user_id: userId,
        tenancy_id: tenancy_id ?? null,
        status: "OTP_SENT",
        m360_full_name: name,
        consent_ip: clientIp || null,
        consent_timestamp: new Date().toISOString(),
        otp_sent_at: new Date().toISOString(),
        otp_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      })
      .eq("id", existingRecord.id);
    insertError = error;
  } else {
    // Insert new record
    const { error } = await supabase
      .from("identity_verifications")
      .insert({
        user_id: userId,
        tenancy_id: tenancy_id ?? null,
        verification_id: otpResult.verification_id,
        status: "OTP_SENT",
        m360_full_name: name,
        consent_ip: clientIp || null,
        consent_timestamp: new Date().toISOString(),
        otp_sent_at: new Date().toISOString(),
        otp_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });
    insertError = error;
  }

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
  consent_ip: string;
}

async function callCashfreeSendOtp(
  params: SendOtpParams
): Promise<Mobile360SendOtpResponse> {
  if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    throw new ExternalServiceError("Cashfree", "API credentials not configured");
  }

  // COMPLIANCE FIX: Validate consent_ip is a real IP, not placeholder or empty
  // BUG FIX: Also check for empty string (returned when IP cannot be determined)
  if (!params.consent_ip || params.consent_ip === "0.0.0.0" || params.consent_ip === "") {
    console.error("[verify-identity] Invalid consent_ip for Cashfree API call - compliance violation");
    throw new ExternalServiceError(
      "Cashfree",
      "Valid client IP address is required for consent compliance"
    );
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

// ==============================================
// FETCH WITH CONSENT HANDLER
// ==============================================

/**
 * Fetches Mobile 360 data using pre-recorded consent from Twilio auth.
 * This is the preferred flow when user has already authenticated via auth-otp
 * with consent_for_mobile360=true.
 */
async function handleFetchWithConsent(
  body: unknown,
  userId: string,
  supabase: ReturnType<typeof createServiceClient>,
  audit: AuditLogger,
  user: { id: string; phone?: string; email?: string },
  clientIp: string
): Promise<Response> {
  // Validate request
  const validatedBody = validateSchema<FetchWithConsentRequest>(body, fetchWithConsentSchema, true);
  const { tenancy_id } = validatedBody;

  // Get user's phone number
  const userPhone = user.phone;
  if (!userPhone) {
    throw new ValidationError("User phone number not found. Please authenticate first.");
  }

  const sanitizedPhone = sanitizePhone(userPhone);

  // Check for existing consent record
  let consentRecord: Record<string, unknown> | null = null;
  const { data: existingConsent, error: consentError } = await supabase
    .from("identity_verifications")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "CONSENT_GIVEN")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (consentError || !existingConsent) {
    // Auto-create consent record from request data
    const now = new Date().toISOString();
    const consentTimestamp = validatedBody.consent_timestamp || now;
    const consentName = validatedBody.name || "User";
    const verificationId = `CONSENT_AUTO_${Date.now()}_${crypto.randomUUID()}`;

    const { data: newConsent, error: insertError } = await supabase
      .from("identity_verifications")
      .insert({
        verification_id: verificationId,
        user_id: userId,
        status: "CONSENT_GIVEN",
        consent_phone: sanitizedPhone,
        consent_ip: clientIp || "0.0.0.0",
        consent_timestamp: consentTimestamp,
        m360_full_name: consentName,
      })
      .select()
      .single();

    if (insertError || !newConsent) {
      console.error("[verify-identity] Failed to auto-create consent record:", insertError);
      throw new ValidationError(
        "Failed to create consent record. Please try again.",
        { consent: "Auto-creation failed" }
      );
    }

    consentRecord = newConsent;
    console.log(`[verify-identity] Auto-created consent record ${verificationId} for user ${userId}`);
  } else {
    consentRecord = existingConsent;
  }

  // Check if consent is still valid (within 24 hours)
  const consentAge = Date.now() - new Date(consentRecord.consent_timestamp || consentRecord.created_at).getTime();
  const maxConsentAge = 24 * 60 * 60 * 1000; // 24 hours

  if (consentAge > maxConsentAge) {
    throw new ValidationError(
      "Consent has expired. Please re-authenticate to give fresh consent.",
      { consent: "Expired" }
    );
  }

  // Log verification initiation
  await audit.logSuccess(
    AuditActions.IDENTITY_VERIFICATION_INITIATED,
    "verification",
    "identity_verification",
    consentRecord.id,
    {
      phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`,
      tenancy_id,
      action: "fetch_with_consent",
      consent_record_id: consentRecord.id,
    }
  );

  // Call Cashfree Mobile 360 with consent (non-OTP flow)
  // Note: Cashfree Mobile 360 consent-based API
  // COMPLIANCE FIX: Use current client IP if stored consent_ip is missing or invalid
  // Prioritize: stored consent IP > current request IP > fail with error
  // BUG FIX: Also check for empty string (returned when IP cannot be determined)
  const isValidIpValue = (ip: string | null | undefined): ip is string =>
    !!ip && ip !== "0.0.0.0" && ip !== "";

  const consentIpToUse = isValidIpValue(consentRecord.consent_ip)
    ? consentRecord.consent_ip
    : isValidIpValue(clientIp)
    ? clientIp
    : null;

  if (!consentIpToUse) {
    console.error("[verify-identity] Cannot determine client IP for consent - compliance violation");
    throw new ValidationError(
      "Unable to determine client IP address. This is required for consent compliance.",
      { consent_ip: "Required for compliance" }
    );
  }

  const m360Result = await callCashfreeMobile360WithConsent({
    mobile_number: sanitizedPhone,
    name: consentRecord.m360_full_name || "User",
    consent_timestamp: consentRecord.consent_timestamp || consentRecord.created_at,
    consent_ip: consentIpToUse,
  });

  // Handle OTP_GENERATED (Cashfree OTP sent, pending verification)
  if (m360Result.status === "OTP_GENERATED") {
    // Update consent record with Cashfree verification_id for later OTP verify
    await supabase
      .from("identity_verifications")
      .update({
        verification_id: m360Result.verification_id,
        status: "OTP_SENT",
        tenancy_id: tenancy_id ?? null,
      })
      .eq("id", consentRecord.id);

    await audit.logSuccess(
      AuditActions.IDENTITY_VERIFICATION_INITIATED,
      "verification",
      "identity_verification",
      consentRecord.id,
      {
        phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`,
        cashfree_verification_id: m360Result.verification_id,
        action: "otp_sent_for_consent",
      }
    );

    return jsonResponse({
      success: true,
      data: {
        verification_id: consentRecord.id,
        cashfree_verification_id: m360Result.verification_id,
        status: "OTP_SENT",
        message: "Cashfree OTP sent. Verify to complete identity fetch.",
      },
    });
  }

  // Prepare verification data (for SUCCESS or other terminal statuses)
  const verificationData = {
    reference_id: m360Result.reference_id,
    status: m360Result.status === "SUCCESS" ? "SUCCESS" : m360Result.status,
    verified_at: m360Result.status === "SUCCESS" ? new Date().toISOString() : null,
    tenancy_id: tenancy_id ?? null,

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
    m360_pan_details: m360Result.data?.pan_details?.map((p: { pan: string }) => ({
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
    m360_bank_accounts: m360Result.data?.bank_accounts?.map((b: { account_number: string; ifsc: string; bank_name: string }) => ({
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

    // Raw response (for audit)
    raw_response: m360Result,
  };

  // Update the consent record with Mobile 360 data
  const { data: verification, error: updateError } = await supabase
    .from("identity_verifications")
    .update(verificationData)
    .eq("id", consentRecord.id)
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
// CASHFREE MOBILE 360 WITH CONSENT (NON-OTP)
// ==============================================

interface Mobile360ConsentParams {
  mobile_number: string;
  name: string;
  consent_timestamp: string;
  consent_ip: string;
}

/**
 * Calls Cashfree Mobile 360 API using the OTP flow server-side.
 *
 * Since Cashfree has no consent-only data endpoint, we use the 2-step OTP flow:
 * 1. Send OTP via /mobile360/otp/send (OTP goes to user's phone silently)
 * 2. The OTP is NOT auto-verified here — we store the verification_id and
 *    the user can verify later, OR the caller can handle it.
 *
 * For the consent-based post-auth flow, this sends the OTP and returns
 * the verification_id so the data can be fetched after OTP verification.
 *
 * NOTE: The user has already verified their phone via Supabase Auth (Twilio).
 * This Cashfree OTP is a separate requirement for Mobile 360 data access.
 */
async function callCashfreeMobile360WithConsent(
  params: Mobile360ConsentParams
): Promise<Mobile360VerifyOtpResponse> {
  if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    throw new ExternalServiceError("Cashfree", "API credentials not configured");
  }

  const verificationId = `FLENT_CONSENT_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const mobileNumber = params.mobile_number.startsWith("+91")
    ? params.mobile_number.slice(3)
    : params.mobile_number;

  try {
    // Step 1: Send OTP via Cashfree Mobile 360
    const sendResponse = await fetch(`${CASHFREE_BASE_URL}/mobile360/otp/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
        "x-api-version": "2024-12-01",
      },
      body: JSON.stringify({
        verification_id: verificationId,
        mobile_number: mobileNumber,
        name: params.name,
        user_consent: {
          obtained: true,
          type: "EXPLICIT",
          timestamp: params.consent_timestamp,
          purpose: "Identity verification for rental services",
          network_details: {
            ip: params.consent_ip,
          },
        },
        notification_modes: ["SMS"],
      }),
    });

    const sendData = await sendResponse.json();

    if (!sendResponse.ok || sendData.status === "OTP_GENERATION_FAILED" || sendData.status === "INVALID_MOBILE_NUMBER") {
      console.error("Cashfree Mobile 360 OTP send failed:", JSON.stringify(sendData));
      const errDetail = sendResponse.status === 404
        ? "Mobile 360 product may not be activated on your Cashfree account"
        : sendData.message ?? sendData.status ?? `HTTP ${sendResponse.status}`;
      throw new ExternalServiceError("Cashfree", `OTP send failed: ${errDetail}`);
    }

    console.log(`[verify-identity] Cashfree OTP sent for consent flow, verification_id=${sendData.verification_id ?? verificationId}`);

    // Return a pending status — the OTP was sent but not yet verified.
    // The consent record will be updated when the user verifies the Cashfree OTP
    // via a separate verify_otp call.
    return {
      verification_id: sendData.verification_id ?? verificationId,
      reference_id: verificationId,
      status: "OTP_GENERATED" as Mobile360VerifyOtpResponse["status"],
      message: "Cashfree OTP sent to phone. Verify to fetch identity data.",
    };
  } catch (error) {
    if (error instanceof ExternalServiceError || error instanceof AppError) throw error;

    console.error("Cashfree Mobile 360 consent call failed:", error);
    throw new ExternalServiceError(
      "Cashfree",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

// ==============================================
// HELPER FUNCTIONS
// ==============================================

/**
 * Extracts client IP from request headers.
 * Handles various proxy/CDN headers.
 *
 * COMPLIANCE NOTE: For consent tracking, a valid client IP is required.
 * Returns empty string if no valid IP can be determined, allowing caller
 * to handle the compliance requirement appropriately.
 */
function getClientIp(req: Request): string {
  // Check common headers in order of priority
  const headers = [
    "cf-connecting-ip", // Cloudflare
    "x-real-ip", // Nginx
    "x-forwarded-for", // Standard proxy header
    "x-client-ip",
    "true-client-ip",
    "x-envoy-external-address", // Envoy proxy
    "fastly-client-ip", // Fastly CDN
  ];

  for (const header of headers) {
    const value = req.headers.get(header);
    if (value) {
      // x-forwarded-for can contain multiple IPs, take the first (original client)
      const ip = value.split(",")[0].trim();
      // Validate it's a real IP (not placeholder or localhost for production)
      if (ip && ip !== "unknown" && ip !== "0.0.0.0" && isValidIp(ip)) {
        return ip;
      }
    }
  }

  // COMPLIANCE FIX: Return empty string instead of placeholder
  // Caller must handle this appropriately for consent requirements
  console.warn("[verify-identity] Could not determine client IP from headers:",
    Array.from(req.headers.entries())
      .filter(([k]) => k.toLowerCase().includes("ip") || k.toLowerCase().includes("forward"))
      .map(([k, v]) => `${k}: ${v}`)
  );

  return "";
}

/**
 * Basic IP validation - checks if string looks like a valid IPv4 or IPv6 address
 */
function isValidIp(ip: string): boolean {
  // IPv4 pattern
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv6 pattern (simplified)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

  if (ipv4Regex.test(ip)) {
    // Additional validation for IPv4 - each octet should be 0-255
    const octets = ip.split(".").map(Number);
    return octets.every(o => o >= 0 && o <= 255);
  }

  return ipv6Regex.test(ip);
}
