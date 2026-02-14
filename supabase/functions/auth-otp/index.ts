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
import { validateSchema, sanitizePhone, formatPhoneWithCountryCode, isValidIndianPhone } from "../_shared/validation.ts";
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
  verification_sid?: string; // SID from send_otp for reliable verification
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
  verification_sid: {
    required: false,
    type: "string" as const,
    minLength: 10,
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

  // Sanitize phone number and format with country code
  const sanitizedPhone = sanitizePhone(phone_number);
  const phoneWithCountryCode = formatPhoneWithCountryCode(phone_number);

  // Debug logging for troubleshooting
  console.log("[DEBUG] send_otp - Raw phone_number:", phone_number);
  console.log("[DEBUG] send_otp - sanitizedPhone:", sanitizedPhone);
  console.log("[DEBUG] send_otp - phoneWithCountryCode:", phoneWithCountryCode);

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
      // BUG FIX: Only store consent_ip if we have a valid IP (not empty)
      await supabase
        .from("identity_verifications")
        .update({
          otp_sent_at: new Date().toISOString(),
          otp_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min expiry
          otp_attempts: 0,
          ...(clientIp ? { consent_ip: clientIp } : {}),
        })
        .eq("id", existingConsent.id);
    } else {
      // Create new pending consent record
      // BUG FIX: Only include consent_ip if valid, otherwise let it be null
      await supabase
        .from("identity_verifications")
        .insert({
          verification_id: result.sid,
          status: "OTP_SENT",
          consent_phone: sanitizedPhone,
          ...(clientIp ? { consent_ip: clientIp } : {}),
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
    verification_sid,
    consent_for_mobile360 = true,
  } = validatedBody;

  // Sanitize phone number and format with country code
  const sanitizedPhone = sanitizePhone(phone_number);
  const phoneWithCountryCode = formatPhoneWithCountryCode(phone_number);

  // Debug logging for troubleshooting verify issues
  console.log("[DEBUG] verify_otp - Raw phone_number:", phone_number);
  console.log("[DEBUG] verify_otp - sanitizedPhone:", sanitizedPhone);
  console.log("[DEBUG] verify_otp - phoneWithCountryCode:", phoneWithCountryCode);
  console.log("[DEBUG] verify_otp - OTP length:", otp.length);
  console.log("[DEBUG] verify_otp - verification_sid:", verification_sid ?? "NOT PROVIDED");

  // Call Twilio Verify Check API
  // Prefer VerificationSid (more reliable) over phone number lookup
  const result = await callTwilioVerifyOtp({
    phone_number: phoneWithCountryCode,
    otp,
    verification_sid,
  });

  console.log("[DEBUG] verify_otp - Twilio result:", JSON.stringify({
    status: result.status,
    valid: result.valid,
    to: result.to,
    channel: result.channel,
    sid: result.sid,
  }));

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
    // Query with both formats for backward compatibility
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .or(`phone.eq.${phoneWithCountryCode},phone.eq.${sanitizedPhone}`)
      .single();

    if (existingUser) {
      userId = existingUser.id;
      // Update phone to consistent format if using old format
      await supabase
        .from("users")
        .update({ phone: phoneWithCountryCode })
        .eq("id", userId);
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
          phone: phoneWithCountryCode,
        })
        .eq("id", userId);
    }
  }

  // Record Mobile 360 consent if requested
  let consentVerificationId: string | null = null;
  if (consent_for_mobile360) {
    // BUG FIX: Only store consent_ip if valid, otherwise omit it (will be captured later)
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
          ...consentIpData,
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

  if (sessionError) {
    console.error("Failed to generate session link:", sessionError);
    throw new AppError(
      "Phone verified but failed to create session. Please try signing in again.",
      "SESSION_GENERATION_FAILED",
      500
    );
  }

  // Extract hashed_token from generateLink response for client-side session exchange
  const tokenHash = sessionData?.properties?.hashed_token;
  if (!tokenHash) {
    console.error("generateLink returned no hashed_token. sessionData:", JSON.stringify(sessionData));
    throw new AppError(
      "Phone verified but session token unavailable. Please try signing in again.",
      "SESSION_TOKEN_MISSING",
      500
    );
  }

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

    // Build form params: prefer VerificationSid (direct lookup) over To (phone lookup)
    // VerificationSid is more reliable as it targets the exact verification instance
    const formParams: Record<string, string> = {
      Code: params.otp,
    };
    if (params.verification_sid) {
      formParams.VerificationSid = params.verification_sid;
      console.log("[DEBUG] Twilio VerificationCheck - Using VerificationSid:", params.verification_sid);
    } else {
      formParams.To = params.phone_number;
      console.log("[DEBUG] Twilio VerificationCheck - Using To (phone):", params.phone_number);
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

    console.log("[DEBUG] Twilio VerificationCheck - HTTP status:", response.status);
    console.log("[DEBUG] Twilio VerificationCheck - Response:", JSON.stringify(data));

    if (!response.ok) {
      console.error("Twilio Verify OTP error:", data);
      console.error("[DEBUG] Twilio error code:", data.code, "message:", data.message);

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
        // 20404 = "Resource not found" — the verification doesn't exist.
        // This happens when: verification expired, was already checked, or phone number mismatch.
        console.error("[DEBUG] Twilio 20404 - Verification not found. Params:", {
          usedSid: !!params.verification_sid,
          phone: params.phone_number,
          sid: params.verification_sid ?? "none",
        });

        // If we used VerificationSid and got 20404, retry with phone number as fallback
        if (params.verification_sid) {
          console.log("[DEBUG] Retrying VerificationCheck with phone number fallback...");
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
          console.log("[DEBUG] Twilio retry response:", JSON.stringify(retryData));

          if (retryResponse.ok) {
            return retryData as TwilioVerificationCheckResponse;
          }
          // If retry also fails, fall through to the expired status below
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

  // BUG FIX: Return empty string instead of "0.0.0.0" to indicate IP not available
  // This allows callers to handle missing IP appropriately for compliance
  // "0.0.0.0" was being stored and later passed to Cashfree, violating compliance
  console.warn("[auth-otp] Could not determine client IP from headers");
  return "";
}
