/**
 * Flent Secured v2 - Auth OTP Edge Function (v2)
 *
 * Thin router for Supabase Auth + Cashfree M360 hybrid OTP.
 *
 * Architecture:
 *   Client → auth-otp (route_otp)
 *     ├─ Existing user → triggers GoTrue /otp server-side → { method: "supabase", otp_triggered }
 *     └─ New user ──────→ Cashfree M360 OTP (SMS) → { method: "cashfree", otp_request_id }
 *
 *   Verify:
 *     ├─ Supabase path → client calls supabase.auth.verifyOtp (no edge function needed)
 *     └─ Cashfree path → verify_otp → identity + server-side token exchange → { session }
 *
 *   Resend:
 *     └─ resend_otp → fresh M360 OTP (new verification_id, preserves identity path)
 *        Frontend falls back to Supabase Auth if M360 resend fails
 *
 *   Health: action "health" → { status: "ok" } (for warm-up cron)
 *
 * Supabase Auth handles: Twilio Programmable Messaging, OTP codes, sessions, demo phones.
 * This function handles: M360 identity OTP for new users only.
 *
 * Endpoint: POST /functions/v1/auth-otp
 * Auth: None (creates session on verify)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, recordSession, revokeUserSessions, decodeJwtPayload } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import {
  AppError,
  ValidationError,
  ExternalServiceError,
  handleError,
} from "../_shared/errors.ts";
import { validateSchema, sanitizePhone, formatPhoneWithCountryCode, normalizePhoneE164, isValidE164Phone } from "../_shared/validation.ts";
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
    // Run phone + IP rate limit checks in parallel (independent queries)
    const [phoneResult, ipResult] = await Promise.all([
      supabaseAdmin
        .from("otp_requests")
        .select("*", { count: "exact", head: true })
        .eq("phone", phone)
        .gte("created_at", windowStart),
      (ip && ip !== "unknown")
        ? supabaseAdmin
            .from("otp_requests")
            .select("*", { count: "exact", head: true })
            .eq("ip_address", ip)
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

    // OPT-10: Health check for warm-up cron — keeps isolate warm, avoids cold starts
    if (body.action === "health") {
      return jsonResponse({ status: "ok", ts: Date.now() });
    }

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

  // Fast user existence check (~5ms) — dual-format to handle +91/91 variants
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .or(`phone.eq.${phoneWithCountryCode},phone.eq.${sanitizedPhone}`)
    .maybeSingle();

  // Existing user → trigger Supabase Auth OTP server-side (saves client round-trip)
  if (existingUser) {
    // OPT-1: Call GoTrue /otp directly instead of returning routing info
    // Eliminates client → Supabase round-trip (saves 300-600ms)
    let otpTriggered = false;
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseAnonKey = (Deno.env.get("SB_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY"))!;

      const otpResponse = await fetch(`${supabaseUrl}/auth/v1/otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseAnonKey,
        },
        body: JSON.stringify({ phone: normalizePhoneE164(phoneWithCountryCode), createUser: false }),
      });
      otpTriggered = otpResponse.ok;
      if (!otpTriggered) {
        console.warn("[auth-otp] Server-side OTP trigger failed:", otpResponse.status);
      }
    } catch (triggerErr) {
      console.warn("[auth-otp] Server-side OTP trigger error:", triggerErr instanceof Error ? triggerErr.message : triggerErr);
    }

    // Fire-and-forget audit (non-blocking — saves 15-30ms)
    const auditPromise = audit.logSuccess(
      AuditActions.AUTH_OTP_INITIATED, "auth", "phone", existingUser.id,
      { phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`, method: "supabase", otp_triggered: otpTriggered }
    );
    // @ts-ignore
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) { EdgeRuntime.waitUntil(auditPromise); }

    return jsonResponse({
      success: true,
      data: {
        method: "supabase",
        otp_triggered: otpTriggered,
        phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`,
      },
    });
  }

  // New user → try M360 OTP first, fallback to Supabase Auth if M360 fails
  try {
    return await sendViaCashfreeM360(
      sanitizedPhone, phoneWithCountryCode, name ?? "User", clientIp, supabase, audit
    );
  } catch (m360Error) {
    console.warn("[auth-otp] M360 failed for new user, falling back to Supabase Auth:", m360Error instanceof Error ? m360Error.message : m360Error);

    // Create auth user first so Supabase signInWithOtp works
    const { error: createError } = await supabase.auth.admin.createUser({
      phone: normalizePhoneE164(phoneWithCountryCode),
      phone_confirm: false,
      user_metadata: { full_name: name },
    });

    if (createError && !createError.message?.includes("already")) {
      console.error("[auth-otp] Failed to create user for fallback:", createError);
      throw m360Error; // Re-throw original M360 error if user creation also fails
    }

    await audit.logSuccess(
      AuditActions.AUTH_OTP_INITIATED,
      "auth",
      "phone",
      undefined,
      {
        phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`,
        method: "supabase",
        m360_fallback: true,
        m360_error: (m360Error as { rawMessage?: string }).rawMessage
          ?? (m360Error instanceof Error ? m360Error.message : String(m360Error)),
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
  // OPT-9: Run idempotency check + rate limit in parallel (saves 15-30ms)
  const [idempotencyResult, rateLimit] = await Promise.all([
    supabase
      .from("otp_requests")
      .select("id, expires_at")
      .eq("phone", phoneWithCountryCode)
      .eq("status", "pending")
      .eq("provider", "cashfree_m360")
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
        method: "cashfree",
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
      "auth",
      "RATE_LIMITED",
      "Too many M360 OTP requests",
      "phone"
    );
    return jsonResponse({
      error: true, message: "Too many attempts. Please wait before trying again.", code: "RATE_LIMITED"
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
      ip_address: clientIp || null,
    })
    .select("id")
    .single();

  if (insertError || !otpRequest) {
    console.error("[auth-otp] Failed to insert otp_request:", insertError);
    throw new AppError("Failed to track OTP request", "DB_ERROR", 500);
  }

  // Fire-and-forget audit (non-blocking)
  const auditPromise2 = audit.logSuccess(
    AuditActions.AUTH_OTP_INITIATED, "auth", "phone", undefined,
    { phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`, method: "cashfree" }
  );
  // @ts-ignore
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) { EdgeRuntime.waitUntil(auditPromise2); }

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

  // Rate limit: check attempt count from already-fetched otpRequest row (no extra DB query)
  if ((otpRequest.attempt_count ?? 0) >= 5) {
    await supabase.from("otp_requests").update({ status: "failed" }).eq("id", otp_request_id);
    return jsonResponse({
      error: true, message: "Too many verification attempts. Request a new code.", code: "MAX_ATTEMPTS"
    }, 429);
  }

  // Increment attempt count
  const { error: rpcError } = await supabase.rpc("increment_otp_attempt", { req_id: otp_request_id });
  if (rpcError) {
    console.error("[auth-otp] increment_otp_attempt RPC failed:", rpcError);
    return errorResponse("Verification temporarily unavailable. Please try again.", 500, "RPC_ERROR");
  }

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
  //    No retry — Cashfree M360 consumes the verification_id on first attempt.
  //    A second request returns "already processed" which would mask the real result.
  const m360Result = await callCashfreeVerifyOtp({
    verification_id: verificationId,
    otp,
  });

  // Handle M360 errors
  // OTP_INVALID: allow retry (user mistyped). The attempt_count limit (5 max) prevents abuse.
  // If Cashfree consumed the verification_id, a subsequent "already processed" response
  // is caught by the VERIFICATION_FAILED handler below (Fix 4) — no security bypass.
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

  // 3+4. Generate session and atomic claim in parallel (no data dependency)
  const [session, claimResult] = await Promise.all([
    generateSession(sanitizedPhone, supabase),
    supabase.from("otp_requests")
      .update({ status: "verified", verified_at: new Date().toISOString() })
      .eq("id", otpRequestId)
      .eq("status", "pending")
      .select()
      .single(),
  ]);

  if (!claimResult.data) {
    return jsonResponse({ error: true, message: "OTP already used or expired", code: "OTP_ALREADY_USED" }, 409);
  }

  // 5. Process identity data in background — never blocks auth response.
  //    Identity storage + profile update + risk recomputation run fire-and-forget.
  //    If any step fails, auth still succeeds; identity can be retried via verify-identity.
  const hasIdentityData = (m360Result.status === "SUCCESS" && m360Result.data != null) || m360Result.status === "DETAILS_NOT_FOUND";

  // Background: identity processing + audit log.
  // EdgeRuntime.waitUntil keeps the isolate alive after response is sent.
  const backgroundWork = (async () => {
    try {
      if (hasIdentityData) {
        const verificationData = buildVerificationData(
          m360Result.status,
          m360Result.reference_id,
          m360Result.data,
          m360Result
        );

        // Clean up any stale CONSENT_GIVEN records created by the app's
        // redundant verify-identity consent flow (race condition during auth).
        // These records never progress because auth-otp already handled identity.
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
            m360_full_name: name,
            ...verificationData,
          });

        await processM360IdentityResult(
          userId, m360Result.status, m360Result.data, supabase
        );

        console.log(`[auth-otp] Identity processing completed for user ${userId}`);
      }

      await audit.logSuccess(
        AuditActions.AUTH_OTP_VERIFIED,
        "auth",
        "user",
        userId,
        {
          phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`,
          provider: "cashfree_m360",
          identity_data: hasIdentityData,
          is_new_user: isNewUser,
        }
      );
    } catch (bgError) {
      console.error(`[auth-otp] Background processing failed (non-fatal) for user ${userId}:`, bgError);
    }
  })();

  // Keep isolate alive until background work completes
  // @ts-ignore — EdgeRuntime is a Supabase global, not in Deno types
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(backgroundWork);
  }

  // Session tracking: revoke old sessions, then record new one.
  // MUST be sequential — if parallel, revoke could see the new session
  // (just inserted by recordSession) and revoke it too.
  if ("access_token" in session) {
    try {
      const tokenPayload = decodeJwtPayload(session.access_token);
      const sessionId = (tokenPayload?.session_id as string) ?? null;

      // 1. Revoke old sessions first (blacklists their JTIs)
      await revokeUserSessions(userId, isNewUser ? "First login" : "Re-authenticated");
      // 2. Then record the new session (won't be revoked since revoke already ran)
      await recordSession(userId, sessionId);
    } catch (sessionTrackingErr) {
      console.error("[auth-otp] Session tracking failed (non-fatal):", sessionTrackingErr);
    }
  }

  // OPT-2: Return session tokens if server-side exchange succeeded, else token_hash fallback
  return jsonResponse({
    success: true,
    data: {
      user_id: userId,
      is_new_user: isNewUser,
      identity_status: hasIdentityData ? "pending" : "not_available",
      ...("access_token" in session
        ? { session: { access_token: session.access_token, refresh_token: session.refresh_token } }
        : { token_hash: session.token_hash }),
      otp_request_id: otpRequestId,
      message: "Phone verified successfully. You are now signed in.",
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

  // Look up original request to get phone + name
  const { data: originalRequest, error: lookupError } = await supabase
    .from("otp_requests")
    .select("*")
    .eq("id", otp_request_id)
    .single();

  if (lookupError || !originalRequest) {
    throw new ValidationError("OTP request not found. Please start a new request.");
  }

  // Expire the old request (its verification_id is consumed by Cashfree)
  await supabase.from("otp_requests")
    .update({ status: "expired" })
    .eq("id", otp_request_id);

  const phone = originalRequest.phone;
  const sanitizedPhone = sanitizePhone(phone);

  // Rate limit check
  const rateLimit = await checkM360RateLimit(phone, clientIp, "send", supabase);
  if (!rateLimit.allowed) {
    return jsonResponse({
      error: true, message: "Too many attempts. Please wait before trying again.", code: "RATE_LIMITED"
    }, 429);
  }

  // Send fresh M360 OTP with new verification_id (old one is consumed)
  const newVerificationId = `FLENT_AUTH_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  const result = await callCashfreeSendOtp({
    verification_id: newVerificationId,
    mobile_number: sanitizedPhone,
    notification_modes: ["sms"],
    consent_ip: clientIp,
  });

  if (result.status !== "OTP_GENERATED") {
    throw new ExternalServiceError("Cashfree", result.message ?? "Failed to resend OTP");
  }

  // Create new otp_request record with new verification_id
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
    })
    .select("id")
    .single();

  if (insertError || !newOtpRequest) {
    console.error("[auth-otp] Failed to insert resend otp_request:", insertError);
    throw new AppError("Failed to track OTP request", "DB_ERROR", 500);
  }

  // Fire-and-forget audit (non-blocking)
  const resendAudit = audit.logSuccess(
    AuditActions.AUTH_OTP_INITIATED, "auth", "phone", undefined,
    { phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`, method: "cashfree", resend: true }
  );
  // @ts-ignore
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) { EdgeRuntime.waitUntil(resendAudit); }

  return jsonResponse({
    success: true,
    data: {
      method: "cashfree",
      otp_request_id: newOtpRequest.id,
      expires_in: Math.floor(OTP_EXPIRY_MS / 1000),
      message: "New OTP sent. Please verify to continue.",
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
    phone: normalizePhoneE164(phoneWithCountryCode),
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
    // Try both phone formats: Supabase may store with or without '+' prefix
    let { data: authUserRows } = await supabase
      .rpc("get_auth_user_by_phone", { p_phone: phoneWithCountryCode });

    // RPC returns TABLE → array. If no match with +91, try without +
    if (!authUserRows || (Array.isArray(authUserRows) && authUserRows.length === 0)) {
      const { data: retryRows } = await supabase
        .rpc("get_auth_user_by_phone", { p_phone: sanitizedPhone });
      authUserRows = retryRows;
    }

    const authUser = Array.isArray(authUserRows) ? authUserRows[0] : authUserRows;

    if (!authUser?.id) {
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

  // Update profile + set synthetic email in parallel (independent targets)
  const syntheticEmail = `${sanitizedPhone}@${SYNTHETIC_EMAIL_DOMAIN}`;
  await Promise.all([
    name
      ? (async () => {
          const extracted = extractFirstName(name);
          await supabase.from("users").update({
            full_name: name,
            first_name: extracted.first_name,
            last_name: extracted.last_name,
            name_source: "user_input",
            phone: phoneWithCountryCode,
          }).eq("id", userId);
        })()
      : Promise.resolve(),
    supabase.auth.admin.updateUserById(userId, { email: syntheticEmail }),
  ]);

  return { userId, isNewUser: true };
}

/**
 * Generates a session via admin generateLink, then exchanges token server-side.
 * OPT-2: Server-side exchange saves 200-400ms client round-trip.
 * Falls back to returning token_hash if exchange fails (backward compatible).
 */
async function generateSession(
  sanitizedPhone: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<{ access_token: string; refresh_token: string } | { token_hash: string }> {
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

  // OPT-2: Exchange token_hash server-side via GoTrue /verify
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

    console.warn("[auth-otp] Server-side token exchange failed, returning token_hash fallback");
  } catch (exchangeErr) {
    console.warn("[auth-otp] Server-side token exchange error:", exchangeErr instanceof Error ? exchangeErr.message : exchangeErr);
  }

  // Fallback: return token_hash for client-side exchange
  return { token_hash: tokenHash };
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
