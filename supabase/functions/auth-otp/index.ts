/**
 * Flent Secured v2 - Auth OTP Edge Function
 *
 * Unified OTP routing: sends OTP via Twilio (existing users) or Cashfree M360
 * (new users needing identity verification), combining auth + identity in one step.
 *
 * Routing:
 *   Client → auth-otp (thin router)
 *     ├─ Twilio path: callTwilioSendOtp → callTwilioVerifyOtp → GoTrue session
 *     └─ Cashfree path: callCashfreeSendOtp → callCashfreeVerifyOtp → identity + admin session
 *
 * Client is provider-agnostic. Single coordination token: otp_request_id.
 *
 * Feature-flagged: When EXPO_PUBLIC_USE_OTP_ROUTING is off, the client still uses
 * the GoTrue SDK directly. This function serves both legacy and new paths.
 *
 * Actions:
 *   send_otp    — Routes to Twilio or Cashfree, returns { otp_request_id, expires_in }
 *   verify_otp  — Looks up otp_request to determine provider, verifies accordingly
 *   resend_otp  — Server-side resend via same provider (no force_provider)
 *
 * Endpoint: POST /functions/v1/auth-otp
 * Auth: None (creates session on verify)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import {
  AppError,
  ValidationError,
  ExternalServiceError,
  handleError,
} from "../_shared/errors.ts";
import { validateSchema, sanitizePhone, formatPhoneWithCountryCode, isValidIndianPhone } from "../_shared/validation.ts";
import { AuditLogger, AuditActions } from "../_shared/audit.ts";
import { extractFirstName } from "../_shared/name-utils.ts";
import { callCashfreeSendOtp, callCashfreeVerifyOtp } from "../_shared/cashfree-m360-otp.ts";
import { processM360IdentityResult, buildVerificationData, markM360Pending } from "../_shared/m360-identity-processor.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_VERIFY_SERVICE_SID = Deno.env.get("TWILIO_VERIFY_SERVICE_SID");

// OTP expires in 10 minutes
const OTP_EXPIRY_MS = 10 * 60 * 1000;
// Idempotency window: 30 seconds
const IDEMPOTENCY_WINDOW_MS = 30_000;

// Demo phone numbers for testing (Apple Review + dev Quick Login)
// Format: "+919999900001:123456,+919999900002:654321"
const ALLOW_DEMO = Deno.env.get("ALLOW_DEMO_AUTH") === "true";
const DEMO_PHONES_RAW = Deno.env.get("DEMO_PHONES");
const DEMO_PHONES: Record<string, string> = {};
if (DEMO_PHONES_RAW) {
  DEMO_PHONES_RAW.split(",").forEach((pair) => {
    const [phone, otp] = pair.split(":");
    if (phone && otp) DEMO_PHONES[phone.trim()] = otp.trim();
  });
}

// ==============================================
// TYPES
// ==============================================

interface SendOtpRequest {
  action: "send_otp";
  phone_number: string;
  name?: string;
  channel?: "sms" | "whatsapp" | "call";
  consent_for_mobile360?: boolean;
}

interface VerifyOtpRequest {
  action: "verify_otp";
  phone_number: string;
  otp: string;
  name?: string;
  otp_request_id?: string;       // New: opaque server ref
  verification_sid?: string;     // Legacy: Twilio SID
  consent_for_mobile360?: boolean;
}

interface ResendOtpRequest {
  action: "resend_otp";
  otp_request_id: string;
}

type AuthOtpRequest = SendOtpRequest | VerifyOtpRequest | ResendOtpRequest;

// Twilio Verify API responses
interface TwilioVerificationResponse {
  sid: string;
  service_sid: string;
  account_sid: string;
  to: string;
  channel: string;
  status: "pending" | "approved" | "canceled" | "max_attempts_reached" | "deleted" | "failed" | "expired";
  valid: boolean;
  date_created: string;
  date_updated: string;
  lookup?: {
    carrier?: {
      name: string;
      type: string;
      mobile_country_code: string;
      mobile_network_code: string;
    };
  };
  send_code_attempts?: Array<{
    time: string;
    channel: string;
    attempt_sid: string;
  }>;
}

interface TwilioVerificationCheckResponse {
  sid: string;
  service_sid: string;
  account_sid: string;
  to: string;
  channel: string;
  status: "pending" | "approved" | "canceled" | "max_attempts_reached" | "deleted" | "failed" | "expired";
  valid: boolean;
  date_created: string;
  date_updated: string;
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
    custom: (v: unknown) => isValidIndianPhone(v as string) || "Invalid Indian phone number",
  },
  name: {
    required: false,
    type: "string" as const,
    minLength: 2,
    maxLength: 100,
  },
  channel: {
    required: false,
    type: "string" as const,
    enum: ["sms", "whatsapp", "call"],
  },
  consent_for_mobile360: { required: false, type: "boolean" as const },
};

const verifyOtpSchema = {
  action: { required: true, type: "string" as const, enum: ["verify_otp"] },
  phone_number: {
    required: true,
    type: "string" as const,
    minLength: 10,
    maxLength: 15,
    custom: (v: unknown) => isValidIndianPhone(v as string) || "Invalid Indian phone number",
  },
  otp: {
    required: true,
    type: "string" as const,
    minLength: 4,
    maxLength: 8,
  },
  name: {
    required: false,
    type: "string" as const,
    minLength: 2,
    maxLength: 100,
  },
  otp_request_id: {
    required: false,
    type: "string" as const,
  },
  verification_sid: {
    required: false,
    type: "string" as const,
    minLength: 10,
    maxLength: 100,
  },
  consent_for_mobile360: { required: false, type: "boolean" as const },
};

const resendOtpSchema = {
  action: { required: true, type: "string" as const, enum: ["resend_otp"] },
  otp_request_id: {
    required: true,
    type: "string" as const,
    minLength: 1,
  },
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

  try {
    // Initialize audit logger (no user auth yet, system action)
    audit = new AuditLogger(supabase, {
      actorType: "service",
      functionName: "auth-otp",
      requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
    });

    // Parse request body to determine action
    const body = await req.json();

    if (!body.action) {
      throw new ValidationError("action is required", { action: "Required field" });
    }

    // Get client IP for consent tracking
    const clientIp = getClientIp(req);

    // Route based on action
    if (body.action === "send_otp") {
      return await handleSendOtp(body, supabase, audit, clientIp);
    } else if (body.action === "verify_otp") {
      return await handleVerifyOtp(body, supabase, audit, clientIp);
    } else if (body.action === "resend_otp") {
      return await handleResendOtp(body, supabase, audit, clientIp);
    } else {
      throw new ValidationError("Invalid action. Use 'send_otp', 'verify_otp', or 'resend_otp'", {
        action: "Must be 'send_otp', 'verify_otp', or 'resend_otp'",
      });
    }
  } catch (error) {
    // Log failure if audit logger initialized
    if (audit) {
      await audit.logFailure(
        "AUTH_OTP_FAILED",
        "authentication",
        error instanceof AppError ? error.code : "UNKNOWN_ERROR",
        error instanceof Error ? error.message : "Unknown error",
        "auth"
      );
    }

    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});

// ==============================================
// SEND OTP HANDLER (with routing)
// ==============================================

async function handleSendOtp(
  body: unknown,
  supabase: ReturnType<typeof createServiceClient>,
  audit: AuditLogger,
  clientIp: string
): Promise<Response> {
  // Validate request
  const validatedBody = validateSchema<SendOtpRequest>(body, sendOtpSchema, true);
  const {
    phone_number,
    name,
    channel = "sms",
    consent_for_mobile360 = true,
  } = validatedBody;

  // Sanitize phone number and format with country code
  const sanitizedPhone = sanitizePhone(phone_number);
  const phoneWithCountryCode = formatPhoneWithCountryCode(phone_number);

  const isProduction = Deno.env.get("ENVIRONMENT") === "production";
  if (!isProduction) {
    console.log("[auth-otp] send_otp - phone:", `XXXXXX${sanitizedPhone.slice(-4)}`, "channel:", channel);
  }

  // Idempotency check: reuse existing pending otp_request within 30s
  const { data: recentRequest } = await supabase
    .from("otp_requests")
    .select("id, expires_at")
    .eq("phone", sanitizedPhone)
    .eq("status", "pending")
    .gt("created_at", new Date(Date.now() - IDEMPOTENCY_WINDOW_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentRequest) {
    const expiresIn = Math.max(0, Math.floor((new Date(recentRequest.expires_at).getTime() - Date.now()) / 1000));
    return jsonResponse({
      success: true,
      data: {
        otp_request_id: recentRequest.id,
        expires_in: expiresIn,
        phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`,
        message: "OTP already sent. Please check your phone.",
      },
    });
  }

  // Demo phone bypass — skip real SMS provider, create a demo otp_request
  if (ALLOW_DEMO && DEMO_PHONES[sanitizedPhone]) {
    const { data: otpRequest, error: insertError } = await supabase
      .from("otp_requests")
      .insert({
        phone: sanitizedPhone,
        provider: "demo",
        verification_id: `demo_${Date.now()}`,
        status: "pending",
        expires_at: new Date(Date.now() + OTP_EXPIRY_MS).toISOString(),
        client_ip: clientIp || null,
      })
      .select()
      .single();

    if (insertError || !otpRequest) {
      throw new AppError("Failed to create demo OTP request", "DEMO_OTP_INSERT_FAILED", 500);
    }

    await audit.logSuccess(
      "AUTH_OTP_INITIATED",
      "auth",
      "authentication",
      undefined,
      {
        phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`,
        provider: "demo",
      }
    );

    return jsonResponse({
      success: true,
      data: {
        otp_request_id: otpRequest.id,
        expires_in: 600,
        phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`,
        message: "Demo OTP sent.",
      },
    });
  }

  // Log OTP initiation
  await audit.logSuccess(
    "AUTH_OTP_INITIATED",
    "authentication",
    "auth",
    undefined,
    {
      phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`,
      channel,
      consent_for_mobile360,
    }
  );

  // Determine provider
  const provider = await chooseOtpProvider(sanitizedPhone, phoneWithCountryCode, clientIp, supabase);

  if (!isProduction) {
    console.log("[auth-otp] Chosen provider:", provider, "for phone:", `XXXXXX${sanitizedPhone.slice(-4)}`);
  }

  if (provider === "cashfree_m360") {
    try {
      return await sendViaCashfree(
        sanitizedPhone, phoneWithCountryCode, name ?? "User", clientIp,
        channel, consent_for_mobile360, supabase, audit
      );
    } catch (error) {
      console.error("[auth-otp] M360 send failed, falling back to Twilio:", error instanceof Error ? error.message : error);
      // Synchronous fallback — user gets Twilio OTP seamlessly
      return await sendViaTwilio(
        sanitizedPhone, phoneWithCountryCode, channel, name,
        consent_for_mobile360, clientIp, supabase, audit
      );
    }
  }

  return await sendViaTwilio(
    sanitizedPhone, phoneWithCountryCode, channel, name,
    consent_for_mobile360, clientIp, supabase, audit
  );
}

// ==============================================
// PROVIDER ROUTING
// ==============================================

async function chooseOtpProvider(
  phone: string,
  phoneFormatted: string,
  clientIp: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<"twilio" | "cashfree_m360"> {
  // Rule 0: No IP → Twilio (Cashfree requires IP for consent compliance)
  if (!clientIp) return "twilio";

  // Rule 1: Test numbers (env-gated to non-production)
  const isProduction = Deno.env.get("ENVIRONMENT") === "production";
  const TEST_PHONES = ["9876543210", "9999999999"];
  if (!isProduction && TEST_PHONES.includes(phone)) return "twilio";

  // Rule 2: Check user's M360 status
  const { data: user } = await supabase
    .from("users")
    .select("id, m360_status, m360_status_updated_at")
    .or(`phone.eq.${phoneFormatted},phone.eq.${phone}`)
    .maybeSingle();

  // Rule 3: New user → Cashfree M360
  if (!user) return "cashfree_m360";

  // Rule 4: Already has M360 data or M360 failed → Twilio
  if (user.m360_status === "fetched" || user.m360_status === "not_available" || user.m360_status === "failed") {
    return "twilio";
  }

  // Rule 5: Active M360 in progress (< 15 min old) → Twilio (avoid concurrent)
  if (user.m360_status === "pending" && user.m360_status_updated_at) {
    const age = Date.now() - new Date(user.m360_status_updated_at).getTime();
    if (age < 15 * 60 * 1000) return "twilio";
    // Stale pending (> 15 min) → eligible for retry via Cashfree
  }

  // Rule 6: NULL m360_status on existing user → Cashfree M360
  return "cashfree_m360";
}

// ==============================================
// SEND VIA TWILIO
// ==============================================

async function sendViaTwilio(
  sanitizedPhone: string,
  phoneWithCountryCode: string,
  channel: "sms" | "whatsapp" | "call",
  name: string | undefined,
  consentForMobile360: boolean,
  clientIp: string,
  supabase: ReturnType<typeof createServiceClient>,
  audit: AuditLogger
): Promise<Response> {
  // Call Twilio Verify Send API
  const result = await callTwilioSendOtp({
    phone_number: phoneWithCountryCode,
    channel,
  });

  // Insert otp_request record
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS).toISOString();
  const { data: otpRequest, error: insertError } = await supabase
    .from("otp_requests")
    .insert({
      phone: sanitizedPhone,
      provider: "twilio",
      verification_id: result.sid,
      status: "pending",
      expires_at: expiresAt,
      client_ip: clientIp || null,
    })
    .select("id")
    .single();

  if (insertError || !otpRequest) {
    console.error("[auth-otp] Failed to insert otp_request:", insertError);
    throw new AppError("Failed to track OTP request", "DB_ERROR", 500);
  }

  // Store pending consent if requested (for post-auth M360 flow)
  if (consentForMobile360) {
    await storePendingConsent(sanitizedPhone, result.sid, clientIp, supabase);
  }

  const expiresIn = Math.floor(OTP_EXPIRY_MS / 1000);
  return jsonResponse({
    success: result.status === "pending",
    data: {
      otp_request_id: otpRequest.id,
      expires_in: expiresIn,
      // Legacy fields for backward compatibility
      verification_sid: result.sid,
      status: result.status,
      channel: result.channel,
      phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`,
      message:
        result.status === "pending"
          ? `OTP sent via ${channel.toUpperCase()}. Please verify to continue.`
          : "Failed to send OTP. Please try again.",
    },
  });
}

// ==============================================
// SEND VIA CASHFREE M360
// ==============================================

async function sendViaCashfree(
  sanitizedPhone: string,
  phoneWithCountryCode: string,
  name: string,
  clientIp: string,
  channel: "sms" | "whatsapp" | "call",
  consentForMobile360: boolean,
  supabase: ReturnType<typeof createServiceClient>,
  audit: AuditLogger
): Promise<Response> {
  // Generate a verification ID for Cashfree
  const cashfreeVerificationId = `FLENT_AUTH_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  // Strip +91 prefix for Cashfree (expects 10-digit)
  const mobileNumber = sanitizedPhone;

  const result = await callCashfreeSendOtp({
    verification_id: cashfreeVerificationId,
    mobile_number: mobileNumber,
    name,
    notification_modes: channel === "call" ? ["sms"] : [channel === "whatsapp" ? "whatsapp" : "sms"],
    consent_ip: clientIp,
  });

  if (result.status !== "OTP_GENERATED") {
    throw new ExternalServiceError("Cashfree", result.message ?? "Failed to send OTP");
  }

  // Insert otp_request record
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS).toISOString();
  const { data: otpRequest, error: insertError } = await supabase
    .from("otp_requests")
    .insert({
      phone: sanitizedPhone,
      provider: "cashfree_m360",
      verification_id: result.verification_id,
      status: "pending",
      expires_at: expiresAt,
      client_ip: clientIp || null,
    })
    .select("id")
    .single();

  if (insertError || !otpRequest) {
    console.error("[auth-otp] Failed to insert otp_request:", insertError);
    throw new AppError("Failed to track OTP request", "DB_ERROR", 500);
  }

  const expiresIn = Math.floor(OTP_EXPIRY_MS / 1000);
  return jsonResponse({
    success: true,
    data: {
      otp_request_id: otpRequest.id,
      expires_in: expiresIn,
      phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`,
      message: "OTP sent. Please verify to continue.",
    },
  });
}

// ==============================================
// VERIFY OTP HANDLER (routes by otp_request_id)
// ==============================================

async function handleVerifyOtp(
  body: unknown,
  supabase: ReturnType<typeof createServiceClient>,
  audit: AuditLogger,
  clientIp: string
): Promise<Response> {
  // Validate request
  const validatedBody = validateSchema<VerifyOtpRequest>(body, verifyOtpSchema, true);
  const {
    phone_number,
    otp,
    name,
    otp_request_id,
    verification_sid,
    consent_for_mobile360 = true,
  } = validatedBody;

  // Sanitize phone number and format with country code
  const sanitizedPhone = sanitizePhone(phone_number);
  const phoneWithCountryCode = formatPhoneWithCountryCode(phone_number);

  const isProduction = Deno.env.get("ENVIRONMENT") === "production";
  if (!isProduction) {
    console.log("[auth-otp] verify_otp - phone:", `XXXXXX${sanitizedPhone.slice(-4)}`, "otp_request_id:", otp_request_id ?? "LEGACY");
  }

  // New path: route by otp_request_id
  if (otp_request_id) {
    return await verifyViaOtpRequest(
      otp_request_id, sanitizedPhone, phoneWithCountryCode, otp, name,
      consent_for_mobile360, clientIp, supabase, audit
    );
  }

  // Legacy path: Twilio verify (backward compatible with old client)
  return await verifyViaTwilioLegacy(
    sanitizedPhone, phoneWithCountryCode, otp, name, verification_sid,
    consent_for_mobile360, clientIp, supabase, audit
  );
}

// ==============================================
// VERIFY VIA OTP REQUEST (new unified path)
// ==============================================

async function verifyViaOtpRequest(
  otpRequestId: string,
  sanitizedPhone: string,
  phoneWithCountryCode: string,
  otp: string,
  name: string | undefined,
  consentForMobile360: boolean,
  clientIp: string,
  supabase: ReturnType<typeof createServiceClient>,
  audit: AuditLogger
): Promise<Response> {
  // Look up otp_request to determine provider
  const { data: otpRequest, error: lookupError } = await supabase
    .from("otp_requests")
    .select("*")
    .eq("id", otpRequestId)
    .eq("phone", sanitizedPhone)
    .eq("status", "pending")
    .single();

  if (lookupError || !otpRequest) {
    throw new ValidationError("OTP request not found or expired. Please request a new OTP.");
  }

  // Check expiry
  if (new Date(otpRequest.expires_at) < new Date()) {
    await supabase.from("otp_requests").update({ status: "expired" }).eq("id", otpRequestId);
    throw new ValidationError("OTP has expired. Please request a new OTP.");
  }

  // Demo provider — verify OTP against DEMO_PHONES map
  if (otpRequest.provider === "demo") {
    if (!ALLOW_DEMO || !DEMO_PHONES[sanitizedPhone]) {
      throw new ValidationError("Demo authentication is not available.");
    }
    if (otp !== DEMO_PHONES[sanitizedPhone]) {
      throw new ValidationError("Invalid OTP.", { otp: "Invalid" });
    }

    // OTP verified — create/find user and session (same as Twilio/Cashfree paths)
    const { userId, isNewUser } = await createOrFindUser(
      sanitizedPhone, phoneWithCountryCode, name, consentForMobile360, clientIp, supabase
    );

    // Generate session token
    const tokenHash = await generateSessionToken(sanitizedPhone, supabase);

    // Mark otp_request as verified
    await supabase.from("otp_requests")
      .update({ status: "verified", verified_at: new Date().toISOString() })
      .eq("id", otpRequestId);

    // Log success
    await audit.logSuccess(
      AuditActions.AUTH_SUCCESS,
      "auth",
      "authentication",
      userId,
      {
        phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`,
        provider: "demo",
        is_new_user: isNewUser,
      }
    );

    return jsonResponse({
      success: true,
      data: {
        user_id: userId,
        is_new_user: isNewUser,
        identity_status: "not_applicable",
        token_hash: tokenHash,
        otp_request_id: otpRequestId,
        message: "Demo phone verified successfully. You are now signed in.",
      },
    });
  }

  if (otpRequest.provider === "twilio") {
    return await verifyTwilioPath(
      otpRequestId, otpRequest.verification_id, sanitizedPhone, phoneWithCountryCode,
      otp, name, consentForMobile360, clientIp, supabase, audit
    );
  } else {
    return await verifyCashfreePath(
      otpRequestId, otpRequest.verification_id, sanitizedPhone, phoneWithCountryCode,
      otp, name, clientIp, supabase, audit
    );
  }
}

// ==============================================
// TWILIO VERIFY PATH
// ==============================================

async function verifyTwilioPath(
  otpRequestId: string,
  verificationId: string | null,
  sanitizedPhone: string,
  phoneWithCountryCode: string,
  otp: string,
  name: string | undefined,
  consentForMobile360: boolean,
  clientIp: string,
  supabase: ReturnType<typeof createServiceClient>,
  audit: AuditLogger
): Promise<Response> {
  // Call Twilio Verify Check API
  const result = await callTwilioVerifyOtp({
    phone_number: phoneWithCountryCode,
    otp,
    verification_sid: verificationId ?? undefined,
  });

  if (result.status !== "approved" || !result.valid) {
    const errorMessage =
      result.status === "max_attempts_reached"
        ? "Maximum OTP attempts reached. Please request a new OTP."
        : result.status === "expired"
        ? "OTP has expired. Please request a new OTP."
        : "Invalid OTP. Please try again.";

    if (result.status === "expired" || result.status === "max_attempts_reached") {
      await supabase.from("otp_requests").update({ status: "failed" }).eq("id", otpRequestId);
    }

    throw new ValidationError(errorMessage, {
      otp: result.status === "max_attempts_reached" ? "Max attempts" : "Invalid",
    });
  }

  // OTP verified — create/find user and session
  const { userId, isNewUser } = await createOrFindUser(
    sanitizedPhone, phoneWithCountryCode, name, consentForMobile360, clientIp, supabase
  );

  // Record consent for post-auth M360 flow
  let consentVerificationId: string | null = null;
  if (consentForMobile360) {
    consentVerificationId = await recordMobile360Consent(
      userId, sanitizedPhone, name, clientIp, supabase
    );
  }

  // Generate session token
  const tokenHash = await generateSessionToken(sanitizedPhone, supabase);

  // Mark otp_request as verified
  await supabase.from("otp_requests")
    .update({ status: "verified", verified_at: new Date().toISOString() })
    .eq("id", otpRequestId);

  // Log success
  await audit.logSuccess(
    AuditActions.AUTH_SUCCESS,
    "authentication",
    "auth",
    userId,
    {
      phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`,
      provider: "twilio",
      consent_recorded: !!consentVerificationId,
      is_new_user: isNewUser,
    }
  );

  return jsonResponse({
    success: true,
    data: {
      user_id: userId,
      is_new_user: isNewUser,
      identity_status: "pending",  // Twilio path: identity not yet fetched
      token_hash: tokenHash,
      otp_request_id: otpRequestId,
      // Legacy fields
      consent_verification_id: consentVerificationId,
      consent_status: consentVerificationId ? "CONSENT_GIVEN" : null,
      message: "Phone verified successfully. You are now signed in.",
    },
  });
}

// ==============================================
// CASHFREE M360 VERIFY PATH
// ==============================================

async function verifyCashfreePath(
  otpRequestId: string,
  verificationId: string | null,
  sanitizedPhone: string,
  phoneWithCountryCode: string,
  otp: string,
  name: string | undefined,
  clientIp: string,
  supabase: ReturnType<typeof createServiceClient>,
  audit: AuditLogger
): Promise<Response> {
  if (!verificationId) {
    throw new AppError("Missing Cashfree verification_id", "INVALID_STATE", 500);
  }

  // 1. Verify OTP with Cashfree → get identity data
  const m360Result = await callCashfreeVerifyOtp({
    verification_id: verificationId,
    otp,
  });

  // Handle M360 errors
  if (m360Result.status === "OTP_INVALID") {
    throw new ValidationError("Invalid OTP. Please try again.", { otp: "Invalid" });
  }
  if (m360Result.status === "OTP_EXPIRED") {
    await supabase.from("otp_requests").update({ status: "expired" }).eq("id", otpRequestId);
    throw new ValidationError("OTP has expired. Please request a new OTP.", { otp: "Expired" });
  }
  if (m360Result.status === "VERIFICATION_FAILED") {
    await supabase.from("otp_requests").update({ status: "failed" }).eq("id", otpRequestId);
    throw new AppError("Verification failed. Please try again.", "VERIFICATION_FAILED", 400);
  }

  // 2. Create/find Supabase auth user
  const { userId, isNewUser } = await createOrFindUser(
    sanitizedPhone, phoneWithCountryCode, name, true, clientIp, supabase
  );

  // 3. Process identity data + update m360_status
  let identityStatus: "completed" | "not_available" | "pending" = "pending";

  if (m360Result.status === "SUCCESS" || m360Result.status === "DETAILS_NOT_FOUND") {
    // Store verification data in identity_verifications
    const verificationData = buildVerificationData(
      m360Result.status,
      m360Result.reference_id,
      m360Result.data,
      m360Result
    );

    await supabase
      .from("identity_verifications")
      .insert({
        verification_id: verificationId,
        user_id: userId,
        consent_phone: sanitizedPhone,
        consent_ip: clientIp || null,
        consent_timestamp: new Date().toISOString(),
        m360_full_name: name,
        ...verificationData,
      });

    // Process identity: update user profile, risk, m360_status
    identityStatus = await processM360IdentityResult(
      userId, m360Result.status, m360Result.data, supabase
    );
  }

  // 4. Generate session token
  const tokenHash = await generateSessionToken(sanitizedPhone, supabase);

  // 5. Mark otp_request as verified
  await supabase.from("otp_requests")
    .update({ status: "verified", verified_at: new Date().toISOString() })
    .eq("id", otpRequestId);

  // 6. Log success
  await audit.logSuccess(
    AuditActions.AUTH_SUCCESS,
    "authentication",
    "auth",
    userId,
    {
      phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`,
      provider: "cashfree_m360",
      identity_status: identityStatus,
      is_new_user: isNewUser,
    }
  );

  return jsonResponse({
    success: true,
    data: {
      user_id: userId,
      is_new_user: isNewUser,
      identity_status: identityStatus,
      token_hash: tokenHash,
      otp_request_id: otpRequestId,
      message: identityStatus === "completed"
        ? "Phone verified and identity data retrieved successfully."
        : "Phone verified successfully. You are now signed in.",
    },
  });
}

// ==============================================
// RESEND OTP HANDLER
// ==============================================

async function handleResendOtp(
  body: unknown,
  supabase: ReturnType<typeof createServiceClient>,
  audit: AuditLogger,
  clientIp: string
): Promise<Response> {
  const validatedBody = validateSchema<ResendOtpRequest>(body, resendOtpSchema, true);
  const { otp_request_id } = validatedBody;

  // Look up original request
  const { data: originalRequest, error: lookupError } = await supabase
    .from("otp_requests")
    .select("*")
    .eq("id", otp_request_id)
    .single();

  if (lookupError || !originalRequest) {
    throw new ValidationError("OTP request not found. Please start a new request.");
  }

  const sanitizedPhone = originalRequest.phone;
  const phoneWithCountryCode = formatPhoneWithCountryCode(sanitizedPhone);

  // Expire the old request
  await supabase.from("otp_requests")
    .update({ status: "expired" })
    .eq("id", otp_request_id);

  // Resend via the same provider
  if (originalRequest.provider === "demo") {
    // Demo resend — just create a new demo otp_request (no real SMS)
    if (!ALLOW_DEMO || !DEMO_PHONES[sanitizedPhone]) {
      throw new ValidationError("Demo authentication is not available.");
    }

    const { data: otpRequest, error: insertError } = await supabase
      .from("otp_requests")
      .insert({
        phone: sanitizedPhone,
        provider: "demo",
        verification_id: `demo_${Date.now()}`,
        status: "pending",
        expires_at: new Date(Date.now() + OTP_EXPIRY_MS).toISOString(),
        client_ip: clientIp || null,
      })
      .select()
      .single();

    if (insertError || !otpRequest) {
      throw new AppError("Failed to create demo OTP request", "DEMO_OTP_INSERT_FAILED", 500);
    }

    return jsonResponse({
      success: true,
      data: {
        otp_request_id: otpRequest.id,
        expires_in: 600,
        phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`,
        message: "Demo OTP re-sent.",
      },
    });
  }

  if (originalRequest.provider === "cashfree_m360") {
    try {
      return await sendViaCashfree(
        sanitizedPhone, phoneWithCountryCode, "User", clientIp,
        "sms", true, supabase, audit
      );
    } catch (error) {
      console.error("[auth-otp] M360 resend failed, falling back to Twilio:", error instanceof Error ? error.message : error);
      return await sendViaTwilio(
        sanitizedPhone, phoneWithCountryCode, "sms", undefined,
        true, clientIp, supabase, audit
      );
    }
  }

  return await sendViaTwilio(
    sanitizedPhone, phoneWithCountryCode, "sms", undefined,
    true, clientIp, supabase, audit
  );
}

// ==============================================
// LEGACY TWILIO VERIFY (backward compatible)
// ==============================================

async function verifyViaTwilioLegacy(
  sanitizedPhone: string,
  phoneWithCountryCode: string,
  otp: string,
  name: string | undefined,
  verificationSid: string | undefined,
  consentForMobile360: boolean,
  clientIp: string,
  supabase: ReturnType<typeof createServiceClient>,
  audit: AuditLogger
): Promise<Response> {
  // Call Twilio Verify Check API
  const result = await callTwilioVerifyOtp({
    phone_number: phoneWithCountryCode,
    otp,
    verification_sid: verificationSid,
  });

  if (!Deno.env.get("ENVIRONMENT") || Deno.env.get("ENVIRONMENT") !== "production") {
    console.log("[auth-otp] verify_otp (legacy) - Twilio result:", result.status, result.valid);
  }

  if (result.status !== "approved" || !result.valid) {
    // Increment attempt counter on identity_verifications
    await supabase
      .from("identity_verifications")
      .update({
        otp_attempts: supabase.rpc("increment_otp_attempts", {
          p_phone: sanitizedPhone,
        }),
      })
      .eq("consent_phone", sanitizedPhone)
      .eq("status", "OTP_SENT");

    const errorMessage =
      result.status === "max_attempts_reached"
        ? "Maximum OTP attempts reached. Please request a new OTP."
        : result.status === "expired"
        ? "OTP has expired. Please request a new OTP."
        : "Invalid OTP. Please try again.";

    throw new ValidationError(errorMessage, {
      otp: result.status === "max_attempts_reached" ? "Max attempts" : "Invalid",
    });
  }

  // OTP verified — create/find user and session
  const { userId, isNewUser } = await createOrFindUser(
    sanitizedPhone, phoneWithCountryCode, name, consentForMobile360, clientIp, supabase
  );

  // Record consent
  let consentVerificationId: string | null = null;
  if (consentForMobile360) {
    consentVerificationId = await recordMobile360Consent(
      userId, sanitizedPhone, name, clientIp, supabase
    );
  }

  // Generate session token
  const tokenHash = await generateSessionToken(sanitizedPhone, supabase);

  // Log success
  await audit.logSuccess(
    AuditActions.AUTH_SUCCESS,
    "authentication",
    "auth",
    userId,
    {
      phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`,
      consent_recorded: !!consentVerificationId,
      is_new_user: isNewUser,
    }
  );

  return jsonResponse({
    success: true,
    data: {
      user_id: userId,
      is_new_user: isNewUser,
      token_hash: tokenHash,
      consent_verification_id: consentVerificationId,
      consent_status: consentVerificationId ? "CONSENT_GIVEN" : null,
      message: "Phone verified successfully. You are now signed in.",
      next_steps: consentVerificationId
        ? ["identity_verification_ready"]
        : ["identity_verification_requires_separate_consent"],
    },
  });
}

// ==============================================
// SHARED HELPERS
// ==============================================

/**
 * Creates a new Supabase auth user or finds existing one.
 * Returns userId and isNewUser flag.
 */
async function createOrFindUser(
  sanitizedPhone: string,
  phoneWithCountryCode: string,
  name: string | undefined,
  consentForMobile360: boolean,
  clientIp: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<{ userId: string; isNewUser: boolean }> {
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    phone: phoneWithCountryCode,
    phone_confirm: true,
    user_metadata: {
      full_name: name,
      consent_for_mobile360: consentForMobile360,
      consent_timestamp: new Date().toISOString(),
      consent_ip: clientIp,
    },
  });

  if (authError?.message?.includes("already been registered")) {
    // User exists — find their profile
    const { data: existingUser } = await supabase
      .from("users")
      .select("id, name_source")
      .or(`phone.eq.${phoneWithCountryCode},phone.eq.${sanitizedPhone}`)
      .single();

    if (!existingUser) {
      throw new AppError("User account exists but profile not found", "USER_NOT_FOUND", 404);
    }

    // Update phone + name for returning users
    const updatePayload: Record<string, unknown> = { phone: phoneWithCountryCode };
    if (name && existingUser.name_source !== "m360") {
      const extracted = extractFirstName(name);
      updatePayload.full_name = name;
      updatePayload.first_name = extracted.first_name;
      updatePayload.last_name = extracted.last_name;
      updatePayload.name_source = "user_input";
    }
    await supabase.from("users").update(updatePayload).eq("id", existingUser.id);

    return { userId: existingUser.id, isNewUser: false };
  }

  if (authError) {
    console.error("[auth-otp] Auth error:", authError);
    throw new AppError("Failed to create user account", "AUTH_ERROR", 500);
  }

  const userId = authData.user!.id;

  // Update user profile with extracted name
  if (name) {
    const extracted = extractFirstName(name);
    await supabase
      .from("users")
      .update({
        full_name: name,
        first_name: extracted.first_name,
        last_name: extracted.last_name,
        name_source: "user_input",
        phone: phoneWithCountryCode,
      })
      .eq("id", userId);
  }

  return { userId, isNewUser: true };
}

/**
 * Records Mobile 360 consent in identity_verifications table.
 */
async function recordMobile360Consent(
  userId: string,
  sanitizedPhone: string,
  name: string | undefined,
  clientIp: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<string | null> {
  const consentIpData = clientIp ? { consent_ip: clientIp } : {};

  // Update pending consent record to CONSENT_GIVEN
  const { data: consentRecord, error: consentError } = await supabase
    .from("identity_verifications")
    .update({
      user_id: userId,
      status: "CONSENT_GIVEN",
      consent_timestamp: new Date().toISOString(),
      ...consentIpData,
      m360_full_name: name,
    })
    .eq("consent_phone", sanitizedPhone)
    .eq("status", "OTP_SENT")
    .select("id")
    .single();

  if (!consentError && consentRecord) {
    return consentRecord.id;
  }

  // Create new consent record if pending one doesn't exist
  const { data: newConsent } = await supabase
    .from("identity_verifications")
    .insert({
      user_id: userId,
      verification_id: `CONSENT_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      status: "CONSENT_GIVEN",
      consent_phone: sanitizedPhone,
      consent_timestamp: new Date().toISOString(),
      ...consentIpData,
      m360_full_name: name,
    })
    .select("id")
    .single();

  return newConsent?.id ?? null;
}

/**
 * Stores a pending consent record during send_otp (for post-auth M360 flow).
 */
async function storePendingConsent(
  sanitizedPhone: string,
  verificationSid: string,
  clientIp: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<void> {
  const { data: existingConsent } = await supabase
    .from("identity_verifications")
    .select("id")
    .eq("consent_phone", sanitizedPhone)
    .eq("status", "OTP_SENT")
    .single();

  if (existingConsent) {
    await supabase
      .from("identity_verifications")
      .update({
        otp_sent_at: new Date().toISOString(),
        otp_expires_at: new Date(Date.now() + OTP_EXPIRY_MS).toISOString(),
        otp_attempts: 0,
        ...(clientIp ? { consent_ip: clientIp } : {}),
      })
      .eq("id", existingConsent.id);
  } else {
    await supabase
      .from("identity_verifications")
      .insert({
        verification_id: verificationSid,
        status: "OTP_SENT",
        consent_phone: sanitizedPhone,
        ...(clientIp ? { consent_ip: clientIp } : {}),
        otp_sent_at: new Date().toISOString(),
        otp_expires_at: new Date(Date.now() + OTP_EXPIRY_MS).toISOString(),
        otp_attempts: 0,
      });
  }
}

/**
 * Generates a session token via admin generateLink.
 */
async function generateSessionToken(
  sanitizedPhone: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<string> {
  const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: `${sanitizedPhone}@phone.flentsecured.com`,
    options: {
      data: { phone: sanitizedPhone },
    },
  });

  if (sessionError) {
    console.error("[auth-otp] Failed to generate session link:", sessionError);
    throw new AppError(
      "Phone verified but failed to create session. Please try signing in again.",
      "SESSION_GENERATION_FAILED",
      500
    );
  }

  const tokenHash = sessionData?.properties?.hashed_token;
  if (!tokenHash) {
    console.error("[auth-otp] generateLink returned no hashed_token");
    throw new AppError(
      "Phone verified but session token unavailable. Please try signing in again.",
      "SESSION_TOKEN_MISSING",
      500
    );
  }

  return tokenHash;
}

// ==============================================
// TWILIO VERIFY API CALLS
// ==============================================

interface TwilioSendOtpParams {
  phone_number: string;
  channel: "sms" | "whatsapp" | "call";
}

async function callTwilioSendOtp(
  params: TwilioSendOtpParams
): Promise<TwilioVerificationResponse> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_VERIFY_SERVICE_SID) {
    throw new ExternalServiceError("Twilio", "API credentials not configured");
  }

  try {
    const url = `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/Verifications`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
      },
      body: new URLSearchParams({
        To: params.phone_number,
        Channel: params.channel,
      }).toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[auth-otp] Twilio Send OTP error:", data);

      if (data.code === 60200) {
        throw new ValidationError("Invalid phone number format");
      }
      if (data.code === 60203) {
        throw new AppError("Max send attempts reached. Please wait before trying again.", "RATE_LIMITED", 429);
      }
      if (data.code === 60212) {
        throw new AppError("Phone number is invalid for this country", "INVALID_PHONE", 400);
      }

      throw new ExternalServiceError(
        "Twilio",
        data.message ?? `HTTP ${response.status}`
      );
    }

    return data as TwilioVerificationResponse;
  } catch (error) {
    if (error instanceof ExternalServiceError || error instanceof ValidationError || error instanceof AppError) {
      throw error;
    }

    console.error("[auth-otp] Twilio Send OTP failed:", error);
    throw new ExternalServiceError(
      "Twilio",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

interface TwilioVerifyOtpParams {
  phone_number: string;
  otp: string;
  verification_sid?: string;
}

async function callTwilioVerifyOtp(
  params: TwilioVerifyOtpParams
): Promise<TwilioVerificationCheckResponse> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_VERIFY_SERVICE_SID) {
    throw new ExternalServiceError("Twilio", "API credentials not configured");
  }

  try {
    const url = `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`;

    const formParams: Record<string, string> = {
      Code: params.otp,
    };
    if (params.verification_sid) {
      formParams.VerificationSid = params.verification_sid;
    } else {
      formParams.To = params.phone_number;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
      },
      body: new URLSearchParams(formParams).toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[auth-otp] Twilio Verify OTP error:", data);

      if (data.code === 60202) {
        return {
          sid: "",
          service_sid: TWILIO_VERIFY_SERVICE_SID,
          account_sid: TWILIO_ACCOUNT_SID,
          to: params.phone_number,
          channel: "sms",
          status: "max_attempts_reached",
          valid: false,
          date_created: new Date().toISOString(),
          date_updated: new Date().toISOString(),
        };
      }
      if (data.code === 20404) {
        // Verification not found — retry with phone number if we used SID
        if (params.verification_sid) {
          const retryResponse = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
            },
            body: new URLSearchParams({
              To: params.phone_number,
              Code: params.otp,
            }).toString(),
          });
          const retryData = await retryResponse.json();

          if (retryResponse.ok) {
            return retryData as TwilioVerificationCheckResponse;
          }
        }

        return {
          sid: "",
          service_sid: TWILIO_VERIFY_SERVICE_SID!,
          account_sid: TWILIO_ACCOUNT_SID!,
          to: params.phone_number,
          channel: "sms",
          status: "expired",
          valid: false,
          date_created: new Date().toISOString(),
          date_updated: new Date().toISOString(),
        };
      }

      throw new ExternalServiceError(
        "Twilio",
        data.message ?? `HTTP ${response.status}`
      );
    }

    return data as TwilioVerificationCheckResponse;
  } catch (error) {
    if (error instanceof ExternalServiceError) throw error;

    console.error("[auth-otp] Twilio Verify OTP failed:", error);
    throw new ExternalServiceError(
      "Twilio",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

// ==============================================
// UTILITY FUNCTIONS
// ==============================================

/**
 * Extracts client IP from request headers.
 */
function getClientIp(req: Request): string {
  const headers = [
    "cf-connecting-ip",
    "x-real-ip",
    "x-forwarded-for",
    "x-client-ip",
    "true-client-ip",
  ];

  for (const header of headers) {
    const value = req.headers.get(header);
    if (value) {
      const ip = value.split(",")[0].trim();
      if (ip && ip !== "unknown") {
        return ip;
      }
    }
  }

  console.warn("[auth-otp] Could not determine client IP from headers");
  return "";
}
