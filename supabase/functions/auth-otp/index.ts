/**
 * Flent Secured v2 - Auth OTP Edge Function (v2)
 *
 * Thin router for Supabase Auth + Cashfree M360 hybrid OTP.
 *
 * Architecture:
 *   Client → auth-otp (route_otp)
 *     ├─ Existing user → { method: "supabase" }  → client calls signInWithOtp directly
 *     └─ New user ──────→ Cashfree M360 OTP (SMS) → { method: "cashfree", otp_request_id }
 *
 *   Verify:
 *     ├─ Supabase path → client calls supabase.auth.verifyOtp (no edge function needed)
 *     └─ Cashfree path → verify_otp → identity data + generateLink → token_hash
 *
 *   Resend:
 *     └─ Client ALWAYS switches to Supabase Auth (signInWithOtp)
 *        M360 resend_otp provided only for edge cases (expires old request)
 *
 * Supabase Auth handles: Twilio Programmable Messaging, OTP codes, sessions, demo phones.
 * This function handles: M360 identity OTP for new users only.
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
import { validateSchema, sanitizePhone, formatPhoneWithCountryCode, isValidE164Phone } from "../_shared/validation.ts";
import { AuditLogger, AuditActions } from "../_shared/audit.ts";
import { extractFirstName } from "../_shared/name-utils.ts";
import { callCashfreeSendOtp, callCashfreeVerifyOtp } from "../_shared/cashfree-m360-otp.ts";
import { processM360IdentityResult, buildVerificationData } from "../_shared/m360-identity-processor.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const IDEMPOTENCY_WINDOW_MS = 30_000;  // 30 seconds
const SYNTHETIC_EMAIL_DOMAIN = "phone.flentsecured.com";

// ==============================================
// TYPES
// ==============================================

interface RouteOtpRequest {
  action: "route_otp" | "send_otp"; // send_otp kept for backward compat
  phone_number: string;
  name?: string;
  consent_for_mobile360?: boolean;
}

interface VerifyOtpRequest {
  action: "verify_otp";
  phone_number: string;
  otp: string;
  name?: string;
  otp_request_id: string;
}

interface ResendOtpRequest {
  action: "resend_otp";
  otp_request_id: string;
}

// ==============================================
// RATE LIMITING (M360 path only)
// ==============================================

async function checkM360RateLimit(
  phone: string,
  ip: string,
  action: "send" | "verify",
  supabaseAdmin: ReturnType<typeof createServiceClient>,
  otpRequestId?: string
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const now = new Date();
  const windowMs = 10 * 60 * 1000;
  const windowStart = new Date(now.getTime() - windowMs).toISOString();

  if (action === "send") {
    // Per-phone: max 5 M360 sends per 10 minutes
    const { count } = await supabaseAdmin
      .from("otp_requests")
      .select("*", { count: "exact", head: true })
      .eq("phone", phone)
      .gte("created_at", windowStart);

    if ((count ?? 0) >= 5) {
      return { allowed: false, retryAfterSeconds: 60 };
    }

    // Per-IP: max 20 sends per 10 minutes
    if (ip && ip !== "unknown") {
      const { count: ipCount } = await supabaseAdmin
        .from("otp_requests")
        .select("*", { count: "exact", head: true })
        .eq("ip_address", ip)
        .gte("created_at", windowStart);

      if ((ipCount ?? 0) >= 20) {
        return { allowed: false, retryAfterSeconds: 60 };
      }
    }
  }

  if (action === "verify" && otpRequestId) {
    // Per-request: max 5 verify attempts
    const { data: request } = await supabaseAdmin
      .from("otp_requests")
      .select("attempt_count")
      .eq("id", otpRequestId)
      .single();

    if ((request?.attempt_count ?? 0) >= 5) {
      await supabaseAdmin
        .from("otp_requests")
        .update({ status: "failed" })
        .eq("id", otpRequestId);
      return { allowed: false, retryAfterSeconds: 0 };
    }
  }

  return { allowed: true };
}

// ==============================================
// VALIDATION SCHEMAS
// ==============================================

const routeOtpSchema = {
  action: { required: true, type: "string" as const, enum: ["route_otp", "send_otp"] },
  phone_number: {
    required: true,
    type: "string" as const,
    minLength: 7,
    maxLength: 16,
    custom: (v: unknown) => isValidE164Phone(v as string) || "Invalid phone number",
  },
  name: {
    required: false,
    type: "string" as const,
    minLength: 2,
    maxLength: 100,
  },
  consent_for_mobile360: { required: false, type: "boolean" as const },
};

const verifyOtpSchema = {
  action: { required: true, type: "string" as const, enum: ["verify_otp"] },
  phone_number: {
    required: true,
    type: "string" as const,
    minLength: 7,
    maxLength: 16,
    custom: (v: unknown) => isValidE164Phone(v as string) || "Invalid phone number",
  },
  otp: {
    required: true,
    type: "string" as const,
    minLength: 6,
    maxLength: 6,
    pattern: /^\d{6}$/,
  },
  name: {
    required: false,
    type: "string" as const,
    minLength: 2,
    maxLength: 100,
  },
  otp_request_id: {
    required: true,
    type: "string" as const,
    minLength: 1,
  },
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
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const supabase = createServiceClient();
  let audit: AuditLogger | null = null;

  try {
    audit = new AuditLogger(supabase, {
      actorType: "service",
      functionName: "auth-otp",
      requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
    });

    const body = await req.json();

    if (!body.action) {
      throw new ValidationError("action is required", { action: "Required field" });
    }

    const clientIp = getClientIp(req);

    if (body.action === "route_otp" || body.action === "send_otp") {
      return await handleRouteOtp(body, supabase, audit, clientIp);
    } else if (body.action === "verify_otp") {
      return await handleVerifyOtp(body, supabase, audit, clientIp);
    } else if (body.action === "resend_otp") {
      return await handleResendOtp(body, supabase, audit, clientIp);
    } else {
      throw new ValidationError("Invalid action. Use 'route_otp', 'verify_otp', or 'resend_otp'", {
        action: "Must be 'route_otp', 'verify_otp', or 'resend_otp'",
      });
    }
  } catch (error) {
    if (audit) {
      await audit.logFailure(
        AuditActions.AUTH_OTP_FAILED,
        "auth",
        error instanceof AppError ? error.code : "UNKNOWN_ERROR",
        error instanceof Error ? error.message : "Unknown error",
        "phone"
      );
    }

    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});

// ==============================================
// ROUTE OTP HANDLER (replaces send_otp)
// ==============================================

async function handleRouteOtp(
  body: unknown,
  supabase: ReturnType<typeof createServiceClient>,
  audit: AuditLogger,
  clientIp: string
): Promise<Response> {
  const validatedBody = validateSchema<RouteOtpRequest>(body, routeOtpSchema, true);
  const { phone_number, name } = validatedBody;

  const sanitizedPhone = sanitizePhone(phone_number);
  const phoneWithCountryCode = formatPhoneWithCountryCode(phone_number);

  const isProduction = Deno.env.get("ENVIRONMENT") === "production";
  if (!isProduction) {
    console.log("[auth-otp] route_otp - phone:", `XXXXXX${sanitizedPhone.slice(-4)}`);
  }

  // Fast user existence check (~5ms)
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("phone", phoneWithCountryCode)
    .maybeSingle();

  // Existing user → Supabase Auth handles everything (client calls signInWithOtp directly)
  if (existingUser) {
    await audit.logSuccess(
      AuditActions.AUTH_OTP_INITIATED,
      "auth",
      "phone",
      existingUser.id,
      {
        phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`,
        method: "supabase",
      }
    );

    return jsonResponse({
      success: true,
      data: {
        method: "supabase",
        phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`,
      },
    });
  }

  // New user → M360 OTP (consent is mandatory, always present)
  return await sendViaCashfreeM360(
    sanitizedPhone, phoneWithCountryCode, name ?? "User", clientIp, supabase, audit
  );
}

// ==============================================
// SEND VIA CASHFREE M360 (new users only)
// ==============================================

async function sendViaCashfreeM360(
  sanitizedPhone: string,
  phoneWithCountryCode: string,
  name: string,
  clientIp: string,
  supabase: ReturnType<typeof createServiceClient>,
  audit: AuditLogger
): Promise<Response> {
  // Idempotency check: reuse existing pending M360 otp_request within 30s
  const { data: recentRequest } = await supabase
    .from("otp_requests")
    .select("id, expires_at")
    .eq("phone", phoneWithCountryCode)
    .eq("status", "pending")
    .eq("provider", "cashfree_m360")
    .gt("created_at", new Date(Date.now() - IDEMPOTENCY_WINDOW_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentRequest) {
    const expiresIn = Math.max(0, Math.floor((new Date(recentRequest.expires_at).getTime() - Date.now()) / 1000));
    return jsonResponse({
      success: true,
      data: {
        method: "cashfree",
        otp_request_id: recentRequest.id,
        expires_in: expiresIn,
        phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`,
        message: "OTP already sent. Please check your phone.",
      },
    });
  }

  // Rate limit check (M360 path only)
  const rateLimit = await checkM360RateLimit(phoneWithCountryCode, clientIp, "send", supabase);
  if (!rateLimit.allowed) {
    await audit.logFailure(
      AuditActions.AUTH_RATE_LIMITED,
      "auth",
      "RATE_LIMITED",
      "Too many M360 OTP requests",
      "phone"
    );
    return jsonResponse({
      error: { message: "Too many attempts. Please wait before trying again.", code: "RATE_LIMITED" }
    }, 429);
  }

  // Generate verification ID for Cashfree
  const cashfreeVerificationId = `FLENT_AUTH_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  const result = await callCashfreeSendOtp({
    verification_id: cashfreeVerificationId,
    mobile_number: sanitizedPhone,
    name,
    notification_modes: ["sms"],
    consent_ip: clientIp,
  });

  if (result.status !== "OTP_GENERATED") {
    throw new ExternalServiceError("Cashfree", result.message ?? "Failed to send OTP");
  }

  // If Cashfree returned soft success (OTP already active), reuse existing otp_request
  if (result.message?.includes("already sent")) {
    const { data: existingRequest } = await supabase
      .from("otp_requests")
      .select("id, expires_at")
      .eq("phone", phoneWithCountryCode)
      .eq("status", "pending")
      .eq("provider", "cashfree_m360")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingRequest) {
      const expiresIn = Math.max(0, Math.floor((new Date(existingRequest.expires_at).getTime() - Date.now()) / 1000));
      return jsonResponse({
        success: true,
        data: {
          method: "cashfree",
          otp_request_id: existingRequest.id,
          expires_in: expiresIn,
          phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`,
          message: "OTP already sent. Please check your phone.",
        },
      });
    }
  }

  // Insert otp_request record
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS).toISOString();
  const { data: otpRequest, error: insertError } = await supabase
    .from("otp_requests")
    .insert({
      phone: phoneWithCountryCode,
      provider: "cashfree_m360",
      verification_id: result.verification_id,
      status: "pending",
      expires_at: expiresAt,
      client_ip: clientIp || null,
      ip_address: clientIp || null,
    })
    .select("id")
    .single();

  if (insertError || !otpRequest) {
    console.error("[auth-otp] Failed to insert otp_request:", insertError);
    throw new AppError("Failed to track OTP request", "DB_ERROR", 500);
  }

  await audit.logSuccess(
    AuditActions.AUTH_OTP_INITIATED,
    "auth",
    "phone",
    undefined,
    {
      phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`,
      method: "cashfree",
    }
  );

  return jsonResponse({
    success: true,
    data: {
      method: "cashfree",
      otp_request_id: otpRequest.id,
      expires_in: Math.floor(OTP_EXPIRY_MS / 1000),
      phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`,
      message: "OTP sent. Please verify to continue.",
    },
  });
}

// ==============================================
// VERIFY OTP HANDLER (M360 path only)
// ==============================================

async function handleVerifyOtp(
  body: unknown,
  supabase: ReturnType<typeof createServiceClient>,
  audit: AuditLogger,
  clientIp: string
): Promise<Response> {
  const validatedBody = validateSchema<VerifyOtpRequest>(body, verifyOtpSchema, true);
  const { phone_number, otp, name, otp_request_id } = validatedBody;

  const sanitizedPhone = sanitizePhone(phone_number);
  const phoneWithCountryCode = formatPhoneWithCountryCode(phone_number);

  const isProduction = Deno.env.get("ENVIRONMENT") === "production";
  if (!isProduction) {
    console.log("[auth-otp] verify_otp - phone:", `XXXXXX${sanitizedPhone.slice(-4)}`, "otp_request_id:", otp_request_id);
  }

  // Look up otp_request (M360 only)
  const { data: otpRequest, error: lookupError } = await supabase
    .from("otp_requests")
    .select("*")
    .eq("id", otp_request_id)
    .eq("phone", phoneWithCountryCode)
    .eq("status", "pending")
    .single();

  if (lookupError || !otpRequest) {
    throw new ValidationError("OTP request not found or expired. Please request a new OTP.");
  }

  // Check expiry
  if (new Date(otpRequest.expires_at) < new Date()) {
    await supabase.from("otp_requests").update({ status: "expired" }).eq("id", otp_request_id);
    throw new ValidationError("OTP has expired. Please request a new OTP.");
  }

  // Rate limit: check attempt count
  const rateLimit = await checkM360RateLimit(sanitizedPhone, clientIp, "verify", supabase, otp_request_id);
  if (!rateLimit.allowed) {
    return jsonResponse({
      error: { message: "Too many verification attempts. Request a new code.", code: "MAX_ATTEMPTS" }
    }, 429);
  }

  // Increment attempt count
  await supabase.rpc("increment_otp_attempt", { req_id: otp_request_id });

  // Verify with Cashfree M360
  return await verifyCashfreePath(
    otp_request_id, otpRequest.verification_id, sanitizedPhone, phoneWithCountryCode,
    otp, name, clientIp, supabase, audit
  );
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
    sanitizedPhone, phoneWithCountryCode, name, clientIp, supabase
  );

  // 3. Process identity data + update m360_status
  let identityStatus: "completed" | "not_available" | "pending" = "pending";

  if (m360Result.status === "SUCCESS" || m360Result.status === "DETAILS_NOT_FOUND") {
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

    identityStatus = await processM360IdentityResult(
      userId, m360Result.status, m360Result.data, supabase
    );
  }

  // 4. Generate session token
  const tokenHash = await generateSessionToken(sanitizedPhone, supabase);

  // 5. Mark otp_request as verified (atomic claim)
  const { data: claimed } = await supabase.from("otp_requests")
    .update({ status: "verified", verified_at: new Date().toISOString() })
    .eq("id", otpRequestId)
    .eq("status", "pending")
    .select()
    .single();

  if (!claimed) {
    return jsonResponse({ error: { message: "OTP already used or expired", code: "OTP_ALREADY_USED" } }, 409);
  }

  // 6. Log success
  await audit.logSuccess(
    AuditActions.AUTH_OTP_VERIFIED,
    "auth",
    "user",
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
// RESEND OTP HANDLER (M360 only — client uses Supabase Auth for resend)
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

  // Expire the old request
  await supabase.from("otp_requests")
    .update({ status: "expired" })
    .eq("id", otp_request_id);

  // M360 has ~45s cooldown — tell client to use Supabase Auth instead
  return jsonResponse({
    success: true,
    data: {
      fallback: "supabase",
      message: "Please use Supabase Auth for resend. M360 request expired.",
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
  clientIp: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<{ userId: string; isNewUser: boolean }> {
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    phone: phoneWithCountryCode,
    phone_confirm: true,
    user_metadata: {
      full_name: name,
      consent_for_mobile360: true,
      consent_timestamp: new Date().toISOString(),
      consent_ip: clientIp,
    },
  });

  if (authError?.message?.includes("already") && authError?.message?.includes("registered")) {
    // User exists in auth — find their profile in public.users
    const { data: existingUser } = await supabase
      .from("users")
      .select("id, name_source")
      .or(`phone.eq.${phoneWithCountryCode},phone.eq.${sanitizedPhone}`)
      .single();

    if (existingUser) {
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

    // Auth user exists but no profile row — look up auth user and create profile
    console.log("[auth-otp] Auth user exists but no profile found, creating profile...");
    const { data: authUser } = await supabase
      .rpc("get_auth_user_by_phone", { p_phone: phoneWithCountryCode });

    if (!authUser) {
      throw new AppError("User account exists but could not be located", "USER_NOT_FOUND", 404);
    }

    const extracted = name ? extractFirstName(name) : { first_name: null, last_name: null };
    const { error: insertError } = await supabase.from("users").upsert({
      id: authUser.id,
      phone: phoneWithCountryCode,
      full_name: name || null,
      first_name: extracted.first_name,
      last_name: extracted.last_name,
      name_source: name ? "user_input" : null,
    }, { onConflict: "id" });

    if (insertError) {
      console.error("[auth-otp] Failed to create profile:", insertError);
      throw new AppError("Failed to create user profile", "PROFILE_ERROR", 500);
    }

    return { userId: authUser.id, isNewUser: true };
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

  // Set synthetic email for generateLink compatibility
  const syntheticEmail = `${sanitizedPhone}@${SYNTHETIC_EMAIL_DOMAIN}`;
  await supabase.auth.admin.updateUserById(userId, { email: syntheticEmail });

  return { userId, isNewUser: true };
}

/**
 * Generates a session token via admin generateLink.
 * Used for M360 path only (Supabase Auth path creates sessions automatically).
 */
async function generateSessionToken(
  sanitizedPhone: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<string> {
  const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: `${sanitizedPhone}@${SYNTHETIC_EMAIL_DOMAIN}`,
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

/**
 * Extracts client IP from request headers.
 */
function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}
