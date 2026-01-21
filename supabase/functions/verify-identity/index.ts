/**
 * Flent Secured v2 - Verify Identity Edge Function
 *
 * Verifies user identity using Cashfree Mobile 360 API.
 * Called after OTP verification during onboarding.
 *
 * Endpoint: POST /functions/v1/verify-identity
 * Auth: Required (JWT)
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

interface VerifyIdentityRequest {
  phone_number: string;
  tenancy_id?: string;
  consent_given?: boolean;
}

interface Mobile360Response {
  verification_id: string;
  reference_id: string;
  status: string;
  data?: {
    name?: string;
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
// VALIDATION SCHEMA
// ==============================================

const requestSchema = {
  phone_number: {
    required: true,
    type: "string" as const,
    minLength: 10,
    maxLength: 15,
  },
  tenancy_id: { required: false, type: "string" as const },
  consent_given: { required: false, type: "boolean" as const },
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
    const { userId: uid, user } = await createAuthenticatedClient(authHeader);
    userId = uid;

    // Initialize audit logger
    audit = AuditLogger.fromRequest(supabase, req, userId, "verify-identity");

    // Parse and validate request body
    const body = await req.json();
    const validatedBody = validateSchema<VerifyIdentityRequest>(
      body,
      requestSchema,
      true
    );

    const { phone_number, tenancy_id, consent_given = true } = validatedBody;

    // Sanitize phone number
    const sanitizedPhone = sanitizePhone(phone_number);

    // Verify consent
    if (!consent_given) {
      throw new ValidationError("User consent is required for identity verification");
    }

    // Log verification initiation
    await audit.logSuccess(
      AuditActions.IDENTITY_VERIFICATION_INITIATED,
      "verification",
      "identity_verification",
      undefined,
      {
        phone_masked: `XXXXXX${sanitizedPhone.slice(-4)}`,
        tenancy_id,
      }
    );

    // Call Cashfree Mobile 360 API
    const m360Result = await callCashfreeMobile360(sanitizedPhone);

    // Store verification result
    const verificationData = {
      user_id: userId,
      tenancy_id: tenancy_id ?? null,
      verification_id: m360Result.verification_id,
      reference_id: m360Result.reference_id,
      status: m360Result.status === "SUCCESS" ? "SUCCESS" : "DETAILS_NOT_FOUND",
      verified_at: m360Result.status === "SUCCESS" ? new Date().toISOString() : null,

      // Personal details
      m360_full_name: m360Result.data?.name,
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

    const { data: verification, error: insertError } = await supabase
      .from("identity_verifications")
      .insert(verificationData)
      .select()
      .single();

    if (insertError) {
      console.error("Failed to insert identity verification:", insertError);
      throw new AppError("Failed to save verification result", "DB_ERROR", 500);
    }

    // Update user profile with verified name if successful
    if (m360Result.status === "SUCCESS" && m360Result.data?.name) {
      const nameParts = m360Result.data.name.split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ");

      await supabase
        .from("users")
        .update({
          first_name: firstName,
          last_name: lastName || null,
          full_name: m360Result.data.name,
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
          has_name: !!m360Result.data?.name,
          has_credit_score: !!m360Result.data?.credit_score,
          risk_level: m360Result.data?.risk_intelligence?.risk_level,
        }
      );
    } else {
      await audit.logFailure(
        AuditActions.IDENTITY_VERIFICATION_FAILED,
        "verification",
        "NO_DATA_FOUND",
        "No identity data found for this phone number",
        "identity_verification",
        verification.id
      );
    }

    // Return sanitized response (don't expose raw API data)
    return jsonResponse({
      success: true,
      data: {
        verification_id: verification.id,
        status: verification.status,
        name: m360Result.data?.name,
        has_pan: !!m360Result.data?.pan_details?.length,
        has_aadhaar: !!m360Result.data?.aadhaar_number,
        credit_score: m360Result.data?.credit_score,
        risk_safe: m360Result.data?.risk_intelligence?.safe ?? true,
        message:
          m360Result.status === "SUCCESS"
            ? "Identity verified successfully"
            : "No identity data found for this phone number",
      },
    });
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
// CASHFREE MOBILE 360 API
// ==============================================

async function callCashfreeMobile360(
  phoneNumber: string
): Promise<Mobile360Response> {
  if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    throw new ExternalServiceError(
      "Cashfree",
      "API credentials not configured"
    );
  }

  const referenceId = `FLENT_M360_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  try {
    const response = await fetch(`${CASHFREE_BASE_URL}/mobile-360`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
      },
      body: JSON.stringify({
        mobile: phoneNumber,
        reference_id: referenceId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Cashfree Mobile 360 API error:", data);
      // Mobile 360 returns 400 when no data found, which is not an error
      if (response.status === 400 && data.code === "mobile_360_no_data_found") {
        return {
          verification_id: referenceId,
          reference_id: referenceId,
          status: "DETAILS_NOT_FOUND",
          data: undefined,
        };
      }
      throw new ExternalServiceError(
        "Cashfree",
        data.message ?? `HTTP ${response.status}`
      );
    }

    return {
      verification_id: data.verification_id ?? referenceId,
      reference_id: data.reference_id ?? referenceId,
      status: data.status ?? "SUCCESS",
      data: {
        name: data.name,
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

    console.error("Cashfree Mobile 360 failed:", error);
    throw new ExternalServiceError(
      "Cashfree",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}
