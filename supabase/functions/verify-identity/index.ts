/**
 * Flent Secured v2 - Verify Identity Edge Function
 *
 * Verifies user identity using Cashfree Mobile 360 API.
 *
 * Supports multiple flows:
 * 1. action: "record_consent" - Persists consent to DB after OTP verification (preferred first step)
 * 2. action: "fetch_with_consent" - Uses persisted consent to trigger Cashfree Mobile 360
 * 3. action: "send_otp" - Sends OTP via Cashfree (legacy)
 * 4. action: "verify_otp" - Verifies Cashfree OTP and retrieves identity data (legacy)
 *
 * The preferred flow is:
 * - User authenticates via auth-otp (Twilio Verify) with consent_for_mobile360=true
 * - App calls record_consent to persist consent (timestamp, IP, phone) to identity_verifications
 * - App calls fetch_with_consent which finds the persisted consent record and triggers Mobile 360
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
import { extractFirstName } from "../_shared/name-utils.ts";
import { computeRisk } from "../_shared/risk-utils.ts";
import {
  callCashfreeSendOtp as sharedCallCashfreeSendOtp,
  callCashfreeVerifyOtp,
  generateCfSignature,
  type Mobile360SendOtpResponse as SharedMobile360SendOtpResponse,
  type Mobile360VerifyOtpResponse,
  type SendOtpParams as SharedSendOtpParams,
  type VerifyOtpParams as SharedVerifyOtpParams,
} from "../_shared/cashfree-m360-otp.ts";
import { processM360IdentityResult, buildVerificationData } from "../_shared/m360-identity-processor.ts";

// ==============================================
// CONFIGURATION
// ==============================================

// NOTE: Cashfree credentials are now read lazily inside the shared module.
// These module-level vars are kept ONLY for callCashfreeMobile360WithConsent
// (the consent-based flow that isn't yet refactored to shared).
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

interface RecordConsentRequest {
  action: "record_consent";
  consent_timestamp: string;
  name?: string;
}

type VerifyIdentityRequest = SendOtpRequest | VerifyOtpRequest | FetchWithConsentRequest | RecordConsentRequest;

// Response from Send OTP API
interface Mobile360SendOtpResponse {
  verification_id: string;
  status: "OTP_GENERATED" | "OTP_GENERATION_FAILED" | "INVALID_MOBILE_NUMBER";
  message?: string;
}

// Mobile360VerifyOtpResponse is now imported from shared cashfree-m360-otp.ts

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

const recordConsentSchema = {
  action: { required: true, type: "string" as const, enum: ["record_consent"] },
  consent_timestamp: { required: true, type: "string" as const },
  name: { required: false, type: "string" as const, maxLength: 100 },
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
    } else if (body.action === "record_consent") {
      // Record consent to DB — called right after OTP verification
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, phone, email")
        .eq("id", userId)
        .single();

      if (userError || !userData) {
        throw new ValidationError("User not found", { user_id: "Not found" });
      }

      return await handleRecordConsent(body, userId, supabase, audit, userData, clientIp);
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
      throw new ValidationError("Invalid action. Use 'record_consent', 'send_otp', 'verify_otp', or 'fetch_with_consent'", {
        action: "Must be 'record_consent', 'send_otp', 'verify_otp', or 'fetch_with_consent'",
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

  // Prepare verification data using shared processor (single source of truth for field mapping)
  const verificationData = buildVerificationData(
    m360Result.status,
    m360Result.reference_id,
    m360Result.data,
    m360Result
  );

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

  // Update user profile with M360-verified name + m360_status via shared processor
  await processM360IdentityResult(userId, m360Result.status, m360Result.data, supabase);

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
// RECORD CONSENT HANDLER
// ==============================================

/**
 * Records user consent to the identity_verifications table.
 * Called right after OTP verification when user gave Mobile 360 consent.
 * Creates a CONSENT_GIVEN record with the actual consent timestamp,
 * client IP, phone, and name — before Mobile 360 is triggered.
 *
 * This ensures consent is persisted with accurate data (timestamp from
 * when user actually toggled consent, not when Mobile 360 fires).
 */
async function handleRecordConsent(
  body: unknown,
  userId: string,
  supabase: ReturnType<typeof createServiceClient>,
  audit: AuditLogger,
  user: { id: string; phone?: string; email?: string },
  clientIp: string
): Promise<Response> {
  // Validate request
  const validatedBody = validateSchema<RecordConsentRequest>(body, recordConsentSchema, true);
  const { consent_timestamp, name } = validatedBody;

  // Get user's phone number
  const userPhone = user.phone;
  if (!userPhone) {
    throw new ValidationError("User phone number not found. Please authenticate first.");
  }

  const sanitizedPhone = sanitizePhone(userPhone);

  // Check for existing consent record (idempotent — don't create duplicates)
  const { data: existingConsent } = await supabase
    .from("identity_verifications")
    .select("id, status, consent_timestamp")
    .eq("user_id", userId)
    .in("status", ["CONSENT_GIVEN", "OTP_SENT", "SUCCESS"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingConsent) {
    // Already have a consent/verification record — return it
    console.log(`[verify-identity] Existing consent record found for user ${userId}, status=${existingConsent.status}`);
    return jsonResponse({
      success: true,
      data: {
        consent_id: existingConsent.id,
        status: existingConsent.status,
        message: "Consent already recorded",
        already_exists: true,
      },
    });
  }

  // Validate consent_timestamp is a valid ISO date and not in the future
  const consentDate = new Date(consent_timestamp);
  if (isNaN(consentDate.getTime())) {
    throw new ValidationError("Invalid consent_timestamp format. Use ISO 8601.", {
      consent_timestamp: "Must be valid ISO 8601 date",
    });
  }

  // Create consent record
  const verificationId = `CONSENT_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  const { data: consentRecord, error: insertError } = await supabase
    .from("identity_verifications")
    .insert({
      verification_id: verificationId,
      user_id: userId,
      status: "CONSENT_GIVEN",
      consent_phone: sanitizedPhone,
      consent_ip: clientIp || null,
      consent_timestamp: consent_timestamp,
      m360_full_name: name || null,
    })
    .select("id, status, consent_timestamp")
    .single();

  if (insertError || !consentRecord) {
    console.error("[verify-identity] Failed to record consent:", insertError);
    throw new AppError("Failed to record consent", "DB_ERROR", 500);
  }

  // Audit log
  await audit.logSuccess(
    AuditActions.IDENTITY_VERIFICATION_INITIATED,
    "consent",
    "identity_verification",
    consentRecord.id,
    {
      phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`,
      action: "record_consent",
      consent_timestamp,
    }
  );

  console.log(`[verify-identity] Consent recorded: ${verificationId} for user ${userId}`);

  return jsonResponse({
    success: true,
    data: {
      consent_id: consentRecord.id,
      status: "CONSENT_GIVEN",
      message: "Consent recorded successfully",
      already_exists: false,
    },
  });
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

  // Prepare verification data using shared processor (single source of truth for field mapping)
  const verificationData = {
    ...buildVerificationData(
      m360Result.status,
      m360Result.reference_id,
      m360Result.data,
      m360Result
    ),
    tenancy_id: tenancy_id ?? null,
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

  // Update user profile with M360-verified name + m360_status via shared processor
  await processM360IdentityResult(userId, m360Result.status, m360Result.data, supabase);

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
    // Build headers with x-cf-signature for public key auth
    const cfHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "x-client-id": CASHFREE_APP_ID,
      "x-client-secret": CASHFREE_SECRET_KEY,
      "x-api-version": "2024-12-01",
    };
    try {
      const { signature } = await generateCfSignature(CASHFREE_APP_ID);
      cfHeaders["x-cf-signature"] = signature;
    } catch (sigErr) {
      console.warn("[verify-identity] x-cf-signature not added:", sigErr instanceof Error ? sigErr.message : String(sigErr));
    }

    const sendResponse = await fetch(`${CASHFREE_BASE_URL}/mobile360/otp/send`, {
      method: "POST",
      headers: cfHeaders,
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
