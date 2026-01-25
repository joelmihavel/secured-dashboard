/**
 * Flent Secured v2 - Auth OTP Edge Function
 *
 * Handles phone-based authentication using Twilio Verify API.
 * Also captures consent for Cashfree Mobile 360 during OTP verification.
 *
 * Flow:
 * 1. action: "send_otp" - Sends OTP via Twilio Verify
 * 2. action: "verify_otp" - Verifies OTP, creates auth session, records Mobile 360 consent
 *
 * Endpoint: POST /functions/v1/auth-otp
 * Auth: None for send_otp, None for verify_otp (creates session)
 *
 * Reference: https://www.twilio.com/docs/verify/api
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
import { validateSchema, sanitizePhone, isValidIndianPhone } from "../_shared/validation.ts";
import { AuditLogger, AuditActions } from "../_shared/audit.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_VERIFY_SERVICE_SID = Deno.env.get("TWILIO_VERIFY_SERVICE_SID");

// ==============================================
// TYPES
// ==============================================

interface SendOtpRequest {
  action: "send_otp";
  phone_number: string;
  channel?: "sms" | "whatsapp" | "call";
  consent_for_mobile360?: boolean; // If true, consent is captured on verification
}

interface VerifyOtpRequest {
  action: "verify_otp";
  phone_number: string;
  otp: string;
  name?: string; // User's name for profile creation
  consent_for_mobile360?: boolean; // Record consent for Cashfree Mobile 360
}

type AuthOtpRequest = SendOtpRequest | VerifyOtpRequest;

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
  consent_for_mobile360: { required: false, type: "boolean" as const },
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
    } else {
      throw new ValidationError("Invalid action. Use 'send_otp' or 'verify_otp'", {
        action: "Must be 'send_otp' or 'verify_otp'",
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
// SEND OTP HANDLER
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
    channel = "sms",
    consent_for_mobile360 = true,
  } = validatedBody;

  // Sanitize phone number
  const sanitizedPhone = sanitizePhone(phone_number);
  const phoneWithCountryCode = sanitizedPhone.startsWith("91")
    ? `+${sanitizedPhone}`
    : `+91${sanitizedPhone}`;

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

  // Call Twilio Verify Send API
  const result = await callTwilioSendOtp({
    phone_number: phoneWithCountryCode,
    channel,
  });

  // Store pending consent if requested (will be activated on OTP verification)
  if (consent_for_mobile360) {
    // Check if there's already a pending consent record
    const { data: existingConsent } = await supabase
      .from("identity_verifications")
      .select("id")
      .eq("consent_phone", sanitizedPhone)
      .eq("status", "OTP_SENT")
      .single();

    if (existingConsent) {
      // Update existing record
      await supabase
        .from("identity_verifications")
        .update({
          otp_sent_at: new Date().toISOString(),
          otp_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min expiry
          otp_attempts: 0,
          consent_ip: clientIp,
        })
        .eq("id", existingConsent.id);
    } else {
      // Create new pending consent record
      await supabase
        .from("identity_verifications")
        .insert({
          verification_id: result.sid,
          status: "OTP_SENT",
          consent_phone: sanitizedPhone,
          consent_ip: clientIp,
          otp_sent_at: new Date().toISOString(),
          otp_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          otp_attempts: 0,
        });
    }
  }

  return jsonResponse({
    success: result.status === "pending",
    data: {
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
// VERIFY OTP HANDLER
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
    consent_for_mobile360 = true,
  } = validatedBody;

  // Sanitize phone number
  const sanitizedPhone = sanitizePhone(phone_number);
  const phoneWithCountryCode = sanitizedPhone.startsWith("91")
    ? `+${sanitizedPhone}`
    : `+91${sanitizedPhone}`;

  // Call Twilio Verify Check API
  const result = await callTwilioVerifyOtp({
    phone_number: phoneWithCountryCode,
    otp,
  });

  if (result.status !== "approved" || !result.valid) {
    // Increment attempt counter
    await supabase
      .from("identity_verifications")
      .update({
        otp_attempts: supabase.rpc("increment_otp_attempts", {
          p_phone: sanitizedPhone,
        }),
      })
      .eq("consent_phone", sanitizedPhone)
      .eq("status", "OTP_SENT");

    // Check if max attempts reached
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

  // OTP verified successfully!

  // Sign in or create user with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    phone: phoneWithCountryCode,
    phone_confirm: true,
    user_metadata: {
      full_name: name,
      consent_for_mobile360,
      consent_timestamp: new Date().toISOString(),
      consent_ip: clientIp,
    },
  });

  // If user already exists, sign them in
  let userId: string;
  if (authError?.message?.includes("already been registered")) {
    // User exists, generate magic link or session
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("phone", sanitizedPhone)
      .single();

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Edge case: auth user exists but profile doesn't
      throw new AppError("User account exists but profile not found", "USER_NOT_FOUND", 404);
    }
  } else if (authError) {
    console.error("Auth error:", authError);
    throw new AppError("Failed to create user account", "AUTH_ERROR", 500);
  } else {
    userId = authData.user!.id;

    // Update user profile with name
    if (name) {
      await supabase
        .from("users")
        .update({
          full_name: name,
          phone: sanitizedPhone,
        })
        .eq("id", userId);
    }
  }

  // Record Mobile 360 consent if requested
  let consentVerificationId: string | null = null;
  if (consent_for_mobile360) {
    // Update pending consent record to CONSENT_GIVEN
    const { data: consentRecord, error: consentError } = await supabase
      .from("identity_verifications")
      .update({
        user_id: userId,
        status: "CONSENT_GIVEN",
        consent_timestamp: new Date().toISOString(),
        consent_ip: clientIp,
        m360_full_name: name,
      })
      .eq("consent_phone", sanitizedPhone)
      .eq("status", "OTP_SENT")
      .select("id")
      .single();

    if (!consentError && consentRecord) {
      consentVerificationId = consentRecord.id;
    } else {
      // Create new consent record if pending one doesn't exist
      const { data: newConsent } = await supabase
        .from("identity_verifications")
        .insert({
          user_id: userId,
          verification_id: `CONSENT_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
          status: "CONSENT_GIVEN",
          consent_phone: sanitizedPhone,
          consent_timestamp: new Date().toISOString(),
          consent_ip: clientIp,
          m360_full_name: name,
        })
        .select("id")
        .single();

      if (newConsent) {
        consentVerificationId = newConsent.id;
      }
    }
  }

  // Generate session token for the user
  const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: `${sanitizedPhone}@phone.flentsecured.com`, // Pseudo-email for phone users
    options: {
      data: {
        phone: sanitizedPhone,
      },
    },
  });

  // Log success
  await audit.logSuccess(
    AuditActions.AUTH_SUCCESS,
    "authentication",
    "auth",
    userId,
    {
      phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`,
      consent_recorded: !!consentVerificationId,
      is_new_user: !authError,
    }
  );

  return jsonResponse({
    success: true,
    data: {
      user_id: userId,
      is_new_user: !authError?.message?.includes("already been registered"),
      consent_verification_id: consentVerificationId,
      consent_status: consentVerificationId ? "CONSENT_GIVEN" : null,
      message: "Phone verified successfully. You are now signed in.",
      // In production, return a proper access token
      // For now, client should use Supabase auth with phone
      next_steps: consentVerificationId
        ? ["identity_verification_ready"]
        : ["identity_verification_requires_separate_consent"],
    },
  });
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
      console.error("Twilio Send OTP error:", data);

      // Handle specific Twilio error codes
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

    console.error("Twilio Send OTP failed:", error);
    throw new ExternalServiceError(
      "Twilio",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

interface TwilioVerifyOtpParams {
  phone_number: string;
  otp: string;
}

async function callTwilioVerifyOtp(
  params: TwilioVerifyOtpParams
): Promise<TwilioVerificationCheckResponse> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_VERIFY_SERVICE_SID) {
    throw new ExternalServiceError("Twilio", "API credentials not configured");
  }

  try {
    const url = `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`;

    const response = await fetch(url, {
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

    const data = await response.json();

    if (!response.ok) {
      console.error("Twilio Verify OTP error:", data);

      // Handle specific error codes
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
        return {
          sid: "",
          service_sid: TWILIO_VERIFY_SERVICE_SID,
          account_sid: TWILIO_ACCOUNT_SID,
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

    console.error("Twilio Verify OTP failed:", error);
    throw new ExternalServiceError(
      "Twilio",
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
 */
function getClientIp(req: Request): string {
  // Check common headers in order of priority
  const headers = [
    "cf-connecting-ip", // Cloudflare
    "x-real-ip", // Nginx
    "x-forwarded-for", // Standard proxy header
    "x-client-ip",
    "true-client-ip",
  ];

  for (const header of headers) {
    const value = req.headers.get(header);
    if (value) {
      // x-forwarded-for can contain multiple IPs, take the first
      const ip = value.split(",")[0].trim();
      if (ip && ip !== "unknown") {
        return ip;
      }
    }
  }

  // Fallback - in Deno Deploy, we might not have direct access to IP
  return "0.0.0.0";
}
