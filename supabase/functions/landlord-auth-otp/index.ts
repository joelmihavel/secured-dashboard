/**
 * Flent Secured v2 - Landlord Auth OTP Edge Function
 *
 * M360-only OTP for landlord identity verification from Framer web page.
 * Handles ONLY authentication — creates/finds landlord user and returns session.
 * Tenancy confirmation is handled separately by landlord-confirm.
 *
 * Actions:
 *   send_otp   → Cashfree M360 OTP (SMS) → { otp_request_id }
 *   verify_otp → M360 verify + create/find landlord user → { session }
 *   resend_otp → Fresh M360 OTP (new verification_id)
 *   health     → { status: "ok" } (warm-up cron)
 *
 * Auth: None (public endpoint). Rate-limited per phone/IP.
 * Keys: Client sends publishable key in apikey header (safe for client-side).
 *       Service operations use server-side SUPABASE_SERVICE_ROLE_KEY.
 * Endpoint: POST /functions/v1/landlord-auth-otp
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, getSupabaseUrl } from "../_shared/supabase.ts";
import { handleCors, getCorsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
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

interface SendOtpRequest {
  action: "send_otp";
  phone_number: string;
}

interface VerifyOtpRequest {
  action: "verify_otp";
  phone_number: string;
  otp: string;
  otp_request_id: string;
}

interface ResendOtpRequest {
  action: "resend_otp";
  otp_request_id: string;
}

// ==============================================
// RATE LIMITING
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
    const [phoneResult, ipResult] = await Promise.all([
      supabaseAdmin
        .from("otp_requests")
        .select("*", { count: "exact", head: true })
        .eq("phone", phone)
        .eq("source", "landlord")
        .gte("created_at", windowStart),
      (ip && ip !== "unknown")
        ? supabaseAdmin
            .from("otp_requests")
            .select("*", { count: "exact", head: true })
            .eq("ip_address", ip)
            .eq("source", "landlord")
            .gte("created_at", windowStart)
        : Promise.resolve({ count: 0 }),
    ]);

    if ((phoneResult.count ?? 0) >= 5) {
      return { allowed: false, retryAfterSeconds: 60 };
    }
    if ((ipResult.count ?? 0) >= 20) {
      return { allowed: false, retryAfterSeconds: 60 };
    }
  }

  if (action === "verify" && otpRequestId) {
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

const sendOtpSchema = {
  action: { required: true, type: "string" as const, enum: ["send_otp"] },
  phone_number: {
    required: true,
    type: "string" as const,
    minLength: 7,
    maxLength: 16,
    custom: (v: unknown) => isValidE164Phone(v as string) || "Invalid phone number",
  },
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

  // Capture origin-aware CORS headers to patch every response
  const corsHeaders = getCorsHeaders(req);
  const withCors = (response: Response): Response => {
    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
    return new Response(response.body, { status: response.status, headers });
  };

  if (req.method !== "POST") {
    return withCors(errorResponse("Method not allowed", 405));
  }

  const supabase = createServiceClient();
  let audit: AuditLogger | null = null;

  try {
    audit = new AuditLogger(supabase, {
      actorType: "service",
      functionName: "landlord-auth-otp",
      requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
    });

    const body = await req.json();

    if (body.action === "health") {
      return withCors(jsonResponse({ status: "ok", ts: Date.now() }));
    }

    if (!body.action) {
      throw new ValidationError("action is required", { action: "Required field" });
    }

    const clientIp = getClientIp(req);

    let response: Response;
    if (body.action === "send_otp") {
      response = await handleSendOtp(body, supabase, audit, clientIp);
    } else if (body.action === "verify_otp") {
      response = await handleVerifyOtp(body, supabase, audit, clientIp);
    } else if (body.action === "resend_otp") {
      response = await handleResendOtp(body, supabase, audit, clientIp);
    } else {
      throw new ValidationError("Invalid action. Use 'send_otp', 'verify_otp', or 'resend_otp'", {
        action: "Must be 'send_otp', 'verify_otp', or 'resend_otp'",
      });
    }
    return withCors(response);
  } catch (error) {
    if (audit) {
      await audit.logFailure(
        AuditActions.AUTH_OTP_FAILED,
        "landlord",
        error instanceof AppError ? error.code : "UNKNOWN_ERROR",
        error instanceof Error ? error.message : "Unknown error",
        "phone"
      );
    }

    return withCors(handleError(error, req.headers.get("x-request-id") ?? undefined));
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
  const validatedBody = validateSchema<SendOtpRequest>(body, sendOtpSchema, true);
  const { phone_number } = validatedBody;

  const sanitizedPhone = sanitizePhone(phone_number);
  const phoneWithCountryCode = formatPhoneWithCountryCode(phone_number);

  const isProduction = Deno.env.get("ENVIRONMENT") === "production";
  if (!isProduction) {
    console.log("[landlord-auth-otp] send_otp - phone:", `XXXXXX${sanitizedPhone.slice(-4)}`);
  }

  // Idempotency check + rate limit in parallel
  const [idempotencyResult, rateLimit] = await Promise.all([
    supabase
      .from("otp_requests")
      .select("id, expires_at")
      .eq("phone", phoneWithCountryCode)
      .eq("status", "pending")
      .eq("provider", "cashfree_m360")
      .eq("source", "landlord")
      .gt("created_at", new Date(Date.now() - IDEMPOTENCY_WINDOW_MS).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    checkM360RateLimit(phoneWithCountryCode, clientIp, "send", supabase),
  ]);

  const recentRequest = idempotencyResult.data;
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

  if (!rateLimit.allowed) {
    await audit.logFailure(
      AuditActions.AUTH_RATE_LIMITED,
      "landlord",
      "RATE_LIMITED",
      "Too many landlord OTP requests",
      "phone"
    );
    return jsonResponse({
      error: true, message: "Too many attempts. Please wait before trying again.", code: "RATE_LIMITED"
    }, 429);
  }

  // Send M360 OTP — no fallback for landlords
  const cashfreeVerificationId = `FLENT_LANDLORD_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  const result = await callCashfreeSendOtp({
    verification_id: cashfreeVerificationId,
    mobile_number: sanitizedPhone,
    name: "",
    notification_modes: ["sms"],
    consent_ip: clientIp,
  });

  if (result.status !== "OTP_GENERATED") {
    throw new ExternalServiceError("Cashfree", result.message ?? "Failed to send OTP");
  }

  // Handle "already sent" soft success
  if (result.message?.includes("already sent")) {
    const { data: existingRequest } = await supabase
      .from("otp_requests")
      .select("id, expires_at")
      .eq("phone", phoneWithCountryCode)
      .eq("status", "pending")
      .eq("provider", "cashfree_m360")
      .eq("source", "landlord")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingRequest) {
      const expiresIn = Math.max(0, Math.floor((new Date(existingRequest.expires_at).getTime() - Date.now()) / 1000));
      return jsonResponse({
        success: true,
        data: {
          otp_request_id: existingRequest.id,
          expires_in: expiresIn,
          phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`,
          message: "OTP already sent. Please check your phone.",
        },
      });
    }
  }

  // Insert otp_request record with source: 'landlord'
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS).toISOString();
  const { data: otpRequest, error: insertError } = await supabase
    .from("otp_requests")
    .insert({
      phone: phoneWithCountryCode,
      provider: "cashfree_m360",
      verification_id: result.verification_id,
      status: "pending",
      expires_at: expiresAt,
      ip_address: clientIp || null,
      source: "landlord",
    })
    .select("id")
    .single();

  if (insertError || !otpRequest) {
    console.error("[landlord-auth-otp] Failed to insert otp_request:", insertError);
    throw new AppError("Failed to track OTP request", "DB_ERROR", 500);
  }

  // Fire-and-forget audit
  const auditPromise = audit.logSuccess(
    AuditActions.LANDLORD_OTP_SENT, "landlord", "phone", undefined,
    { phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`, method: "cashfree" }
  );
  // @ts-ignore
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) { EdgeRuntime.waitUntil(auditPromise); }

  return jsonResponse({
    success: true,
    data: {
      otp_request_id: otpRequest.id,
      expires_in: Math.floor(OTP_EXPIRY_MS / 1000),
      phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`,
      message: "OTP sent. Please verify to continue.",
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
  const validatedBody = validateSchema<VerifyOtpRequest>(body, verifyOtpSchema, true);
  const { phone_number, otp, otp_request_id } = validatedBody;

  const sanitizedPhone = sanitizePhone(phone_number);
  const phoneWithCountryCode = formatPhoneWithCountryCode(phone_number);

  const isProduction = Deno.env.get("ENVIRONMENT") === "production";
  if (!isProduction) {
    console.log("[landlord-auth-otp] verify_otp - phone:", `XXXXXX${sanitizedPhone.slice(-4)}`, "otp_request_id:", otp_request_id);
  }

  // Look up otp_request (any status — we handle verified/failed as recovery cases)
  const { data: otpRequest, error: lookupError } = await supabase
    .from("otp_requests")
    .select("*")
    .eq("id", otp_request_id)
    .eq("phone", phoneWithCountryCode)
    .eq("source", "landlord")
    .single();

  if (lookupError || !otpRequest) {
    throw new ValidationError("OTP request not found. Please request a new OTP.");
  }

  // ── Recovery: OTP already verified (retry after client-side failure) ──
  // If the OTP was already verified on a prior attempt but the client didn't
  // receive/process the response, generate a fresh session and return success.
  if (otpRequest.status === "verified") {
    console.log("[landlord-auth-otp] OTP already verified, generating fresh session (retry recovery)");
    return await recoverVerifiedSession(sanitizedPhone, phoneWithCountryCode, supabase, audit);
  }

  // ── Recovery: OTP marked failed/expired but user was created (M360 consumed on prior attempt) ──
  if (otpRequest.status === "failed" || otpRequest.status === "expired") {
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .or(`phone.eq.${phoneWithCountryCode},phone.eq.${sanitizedPhone}`)
      .maybeSingle();

    if (existingUser) {
      console.log("[landlord-auth-otp] OTP failed/expired but user exists, recovering session");
      return await recoverVerifiedSession(sanitizedPhone, phoneWithCountryCode, supabase, audit);
    }

    throw new ValidationError("OTP expired or failed. Please request a new OTP.");
  }

  if (otpRequest.status !== "pending") {
    throw new ValidationError("OTP request is no longer valid. Please request a new OTP.");
  }

  // Check expiry
  if (new Date(otpRequest.expires_at) < new Date()) {
    await supabase.from("otp_requests").update({ status: "expired" }).eq("id", otp_request_id);
    throw new ValidationError("OTP has expired. Please request a new OTP.");
  }

  // Rate limit: check attempt count
  if ((otpRequest.attempt_count ?? 0) >= 5) {
    await supabase.from("otp_requests").update({ status: "failed" }).eq("id", otp_request_id);
    return jsonResponse({
      error: true, message: "Too many verification attempts. Request a new code.", code: "MAX_ATTEMPTS"
    }, 429);
  }

  // Increment attempt count
  const { error: rpcError } = await supabase.rpc("increment_otp_attempt", { req_id: otp_request_id });
  if (rpcError) {
    console.error("[landlord-auth-otp] increment_otp_attempt RPC failed:", rpcError);
    return errorResponse("Verification temporarily unavailable. Please try again.", 500, "RPC_ERROR");
  }

  // Verify with Cashfree M360
  const verificationId = otpRequest.verification_id;
  if (!verificationId) {
    throw new AppError("Missing Cashfree verification_id", "INVALID_STATE", 500);
  }

  const m360Result = await callCashfreeVerifyOtp({
    verification_id: verificationId,
    otp,
  });

  // Handle M360 errors
  if (m360Result.status === "OTP_INVALID") {
    throw new ValidationError("Invalid OTP. Please try again.", { otp: "Invalid" });
  }
  if (m360Result.status === "OTP_EXPIRED") {
    await supabase.from("otp_requests").update({ status: "expired" }).eq("id", otp_request_id);
    throw new ValidationError("OTP has expired. Please request a new OTP.", { otp: "Expired" });
  }

  // VERIFICATION_FAILED — M360 consumed the verification_id on a prior attempt.
  // Check if the user was already created (first attempt succeeded at M360 level).
  if (m360Result.status === "VERIFICATION_FAILED") {
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .or(`phone.eq.${phoneWithCountryCode},phone.eq.${sanitizedPhone}`)
      .maybeSingle();

    if (existingUser) {
      console.log("[landlord-auth-otp] M360 VERIFICATION_FAILED but user exists, recovering");
      await supabase.from("otp_requests")
        .update({ status: "verified", verified_at: new Date().toISOString() })
        .eq("id", otp_request_id);
      return await recoverVerifiedSession(sanitizedPhone, phoneWithCountryCode, supabase, audit);
    }

    await supabase.from("otp_requests").update({ status: "failed" }).eq("id", otp_request_id);
    throw new AppError("Verification failed. Please request a new OTP.", "VERIFICATION_FAILED", 400);
  }

  // ── M360 SUCCESS — create user and session ──

  // Extract landlord's name from M360 identity data
  const m360Name = m360Result.data?.personal_details?.full_name ?? null;

  // Create or find landlord user
  const { userId, isNewUser } = await createOrFindLandlordUser(
    sanitizedPhone, phoneWithCountryCode, m360Name, supabase
  );

  // Generate session, then mark OTP as verified
  const session = await generateSession(sanitizedPhone, supabase);

  await supabase.from("otp_requests")
    .update({ status: "verified", verified_at: new Date().toISOString() })
    .eq("id", otp_request_id);

  // Background: identity processing + audit
  const hasIdentityData = (m360Result.status === "SUCCESS" && m360Result.data != null) || m360Result.status === "DETAILS_NOT_FOUND";

  const backgroundWork = (async () => {
    try {
      if (hasIdentityData) {
        const verificationData = buildVerificationData(
          m360Result.status,
          m360Result.reference_id,
          m360Result.data,
          m360Result
        );

        await supabase
          .from("identity_verifications")
          .delete()
          .eq("user_id", userId)
          .eq("status", "CONSENT_GIVEN");

        await supabase
          .from("identity_verifications")
          .insert({
            verification_id: verificationId,
            user_id: userId,
            consent_phone: sanitizedPhone,
            consent_ip: clientIp || null,
            consent_timestamp: new Date().toISOString(),
            m360_full_name: m360Name,
            ...verificationData,
          });

        await processM360IdentityResult(
          userId, m360Result.status, m360Result.data, supabase
        );

        console.log(`[landlord-auth-otp] Identity processing completed for landlord ${userId}`);
      }

      await audit.logSuccess(
        AuditActions.LANDLORD_OTP_VERIFIED,
        "landlord",
        "user",
        userId,
        {
          phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`,
          provider: "cashfree_m360",
          identity_data: hasIdentityData,
          is_new_user: isNewUser,
          m360_name: m360Name,
        }
      );
    } catch (bgError) {
      console.error(`[landlord-auth-otp] Background processing failed (non-fatal) for landlord ${userId}:`, bgError);
    }
  })();

  // @ts-ignore
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(backgroundWork);
  }

  return jsonResponse({
    success: true,
    data: {
      user_id: userId,
      is_new_user: isNewUser,
      m360_name: m360Name,
      ...("access_token" in session
        ? { session: { access_token: session.access_token, refresh_token: session.refresh_token } }
        : { token_hash: session.token_hash }),
      otp_request_id: otp_request_id,
      message: "Phone verified successfully.",
    },
  });
}

/**
 * Recovery helper: landlord user already exists (from a prior successful M360 verification).
 * Generates a fresh session and returns success — makes verify_otp idempotent.
 */
async function recoverVerifiedSession(
  sanitizedPhone: string,
  phoneWithCountryCode: string,
  supabase: ReturnType<typeof createServiceClient>,
  audit: AuditLogger
): Promise<Response> {
  const { data: user } = await supabase
    .from("users")
    .select("id, full_name")
    .or(`phone.eq.${phoneWithCountryCode},phone.eq.${sanitizedPhone}`)
    .maybeSingle();

  if (!user) {
    throw new AppError("Account not found. Please request a new OTP.", "USER_NOT_FOUND", 404);
  }

  // Ensure role is set to landlord and synthetic email exists for session generation
  const syntheticEmail = `${sanitizedPhone}@${SYNTHETIC_EMAIL_DOMAIN}`;
  await Promise.all([
    supabase.from("users").update({ role: "landlord" }).eq("id", user.id),
    supabase.auth.admin.updateUserById(user.id, { email: syntheticEmail }),
  ]);

  const session = await generateSession(sanitizedPhone, supabase);

  const auditPromise = audit.logSuccess(
    AuditActions.LANDLORD_OTP_VERIFIED, "landlord", "user", user.id,
    { phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`, recovery: true }
  );
  // @ts-ignore
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) { EdgeRuntime.waitUntil(auditPromise); }

  return jsonResponse({
    success: true,
    data: {
      user_id: user.id,
      is_new_user: false,
      m360_name: user.full_name,
      ...("access_token" in session
        ? { session: { access_token: session.access_token, refresh_token: session.refresh_token } }
        : { token_hash: session.token_hash }),
      message: "Phone verified successfully.",
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

  const { data: originalRequest, error: lookupError } = await supabase
    .from("otp_requests")
    .select("*")
    .eq("id", otp_request_id)
    .eq("source", "landlord")
    .single();

  if (lookupError || !originalRequest) {
    throw new ValidationError("OTP request not found. Please start a new request.");
  }

  // Expire old request
  await supabase.from("otp_requests")
    .update({ status: "expired" })
    .eq("id", otp_request_id);

  const phone = originalRequest.phone;
  const sanitizedPhone = sanitizePhone(phone);

  // Rate limit
  const rateLimit = await checkM360RateLimit(phone, clientIp, "send", supabase);
  if (!rateLimit.allowed) {
    return jsonResponse({
      error: true, message: "Too many attempts. Please wait before trying again.", code: "RATE_LIMITED"
    }, 429);
  }

  // Send fresh M360 OTP
  const newVerificationId = `FLENT_LANDLORD_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  const result = await callCashfreeSendOtp({
    verification_id: newVerificationId,
    mobile_number: sanitizedPhone,
    name: "",
    notification_modes: ["sms"],
    consent_ip: clientIp,
  });

  if (result.status !== "OTP_GENERATED") {
    throw new ExternalServiceError("Cashfree", result.message ?? "Failed to resend OTP");
  }

  // Create new otp_request record
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS).toISOString();
  const { data: newOtpRequest, error: insertError } = await supabase
    .from("otp_requests")
    .insert({
      phone,
      provider: "cashfree_m360",
      verification_id: result.verification_id,
      status: "pending",
      expires_at: expiresAt,
      ip_address: clientIp || null,
      source: "landlord",
    })
    .select("id")
    .single();

  if (insertError || !newOtpRequest) {
    console.error("[landlord-auth-otp] Failed to insert resend otp_request:", insertError);
    throw new AppError("Failed to track OTP request", "DB_ERROR", 500);
  }

  // Fire-and-forget audit
  const resendAudit = audit.logSuccess(
    AuditActions.LANDLORD_OTP_SENT, "landlord", "phone", undefined,
    { phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`, method: "cashfree", resend: true }
  );
  // @ts-ignore
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) { EdgeRuntime.waitUntil(resendAudit); }

  return jsonResponse({
    success: true,
    data: {
      otp_request_id: newOtpRequest.id,
      expires_in: Math.floor(OTP_EXPIRY_MS / 1000),
      message: "New OTP sent. Please verify to continue.",
    },
  });
}

// ==============================================
// SHARED HELPERS
// ==============================================

async function createOrFindLandlordUser(
  sanitizedPhone: string,
  phoneWithCountryCode: string,
  m360Name: string | null,
  supabase: ReturnType<typeof createServiceClient>
): Promise<{ userId: string; isNewUser: boolean }> {
  // Check if landlord user already exists in public.users
  const { data: existingUser } = await supabase
    .from("users")
    .select("id, name_source")
    .or(`phone.eq.${phoneWithCountryCode},phone.eq.${sanitizedPhone}`)
    .maybeSingle();

  if (existingUser) {
    // Update name from M360 if available and not already set from M360
    if (m360Name && existingUser.name_source !== "m360") {
      const extracted = extractFirstName(m360Name);
      await supabase.from("users").update({
        full_name: m360Name,
        first_name: extracted.first_name,
        last_name: extracted.last_name,
        name_source: "m360",
        role: "landlord",
      }).eq("id", existingUser.id);
    }
    return { userId: existingUser.id, isNewUser: false };
  }

  // Create new auth user with landlord role
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    phone: phoneWithCountryCode,
    phone_confirm: true,
    user_metadata: {
      role: "landlord",
      full_name: m360Name,
    },
  });

  if (authError?.message?.includes("already") && authError?.message?.includes("registered")) {
    // Auth user exists but no profile row — look up and create profile
    console.log("[landlord-auth-otp] Auth user exists but no profile found, creating profile...");
    let { data: authUserRows } = await supabase
      .rpc("get_auth_user_by_phone", { p_phone: phoneWithCountryCode });

    if (!authUserRows || (Array.isArray(authUserRows) && authUserRows.length === 0)) {
      const { data: retryRows } = await supabase
        .rpc("get_auth_user_by_phone", { p_phone: sanitizedPhone });
      authUserRows = retryRows;
    }

    const authUser = Array.isArray(authUserRows) ? authUserRows[0] : authUserRows;
    if (!authUser?.id) {
      throw new AppError("User account exists but could not be located", "USER_NOT_FOUND", 404);
    }

    const extracted = m360Name ? extractFirstName(m360Name) : { first_name: null, last_name: null };
    const syntheticEmail = `${sanitizedPhone}@${SYNTHETIC_EMAIL_DOMAIN}`;
    await Promise.all([
      supabase.from("users").upsert({
        id: authUser.id,
        phone: phoneWithCountryCode,
        full_name: m360Name || null,
        first_name: extracted.first_name,
        last_name: extracted.last_name,
        name_source: m360Name ? "m360" : null,
        role: "landlord",
      }, { onConflict: "id" }),
      supabase.auth.admin.updateUserById(authUser.id, { email: syntheticEmail }),
    ]);

    return { userId: authUser.id, isNewUser: true };
  }

  if (authError) {
    console.error("[landlord-auth-otp] Auth error:", authError);
    throw new AppError("Failed to create landlord account", "AUTH_ERROR", 500);
  }

  const userId = authData.user!.id;

  // Create profile + set synthetic email in parallel
  const syntheticEmail = `${sanitizedPhone}@${SYNTHETIC_EMAIL_DOMAIN}`;
  const extracted = m360Name ? extractFirstName(m360Name) : { first_name: null, last_name: null };

  await Promise.all([
    supabase.from("users").upsert({
      id: userId,
      phone: phoneWithCountryCode,
      full_name: m360Name || null,
      first_name: extracted.first_name,
      last_name: extracted.last_name,
      name_source: m360Name ? "m360" : null,
      role: "landlord",
    }, { onConflict: "id" }),
    supabase.auth.admin.updateUserById(userId, { email: syntheticEmail }),
  ]);

  return { userId, isNewUser: true };
}

async function generateSession(
  sanitizedPhone: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<{ access_token: string; refresh_token: string } | { token_hash: string }> {
  const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: `${sanitizedPhone}@${SYNTHETIC_EMAIL_DOMAIN}`,
    options: {
      data: { phone: sanitizedPhone, role: "landlord" },
    },
  });

  if (sessionError) {
    console.error("[landlord-auth-otp] Failed to generate session link:", sessionError);
    throw new AppError(
      "Phone verified but failed to create session. Please try signing in again.",
      "SESSION_GENERATION_FAILED",
      500
    );
  }

  const tokenHash = sessionData?.properties?.hashed_token;
  if (!tokenHash) {
    console.error("[landlord-auth-otp] generateLink returned no hashed_token");
    throw new AppError(
      "Phone verified but session token unavailable. Please try signing in again.",
      "SESSION_TOKEN_MISSING",
      500
    );
  }

  // Server-side token exchange
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = (Deno.env.get("SB_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY"))!;

    const verifyResponse = await fetch(`${supabaseUrl}/auth/v1/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseAnonKey,
      },
      body: JSON.stringify({ token_hash: tokenHash, type: "magiclink" }),
    });

    if (verifyResponse.ok) {
      const result = await verifyResponse.json();
      if (result.access_token && result.refresh_token) {
        return { access_token: result.access_token, refresh_token: result.refresh_token };
      }
    }

    console.warn("[landlord-auth-otp] Server-side token exchange failed, returning token_hash fallback");
  } catch (exchangeErr) {
    console.warn("[landlord-auth-otp] Server-side token exchange error:", exchangeErr instanceof Error ? exchangeErr.message : exchangeErr);
  }

  return { token_hash: tokenHash };
}

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}
