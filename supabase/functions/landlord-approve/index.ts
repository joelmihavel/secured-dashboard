/**
 * Flent Secured v2 - Landlord Approve Edge Function
 *
 * Handles landlord approval/dispute flow via web portal.
 * Landlords receive a link and can verify tenancy details.
 *
 * Endpoints:
 * - GET /functions/v1/landlord-approve?token=xxx - Get tenancy details
 * - POST /functions/v1/landlord-approve - Approve or dispute
 *
 * Auth: Token-based (no JWT, uses approval_token)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { AppError, ValidationError, NotFoundError, handleError } from "../_shared/errors.ts";
import { validateSchema, isValidIfsc, sanitizeIfsc, maskAccountNumber } from "../_shared/validation.ts";
import { AuditLogger, AuditActions } from "../_shared/audit.ts";
import { encrypt } from "../_shared/crypto.ts";
import { sendEmail } from "../_shared/notifications.ts";

// ==============================================
// TYPES
// ==============================================

interface ApproveRequest {
  token: string;
  action: "approve" | "dispute" | "request_otp" | "verify_otp";
  dispute_reason?: string;
  // Bank account details (required for approval)
  account_holder_name?: string;
  account_number?: string;
  ifsc_code?: string;
  // OTP verification
  otp?: string;
  email?: string; // For OTP request
}

// ==============================================
// VALIDATION SCHEMA
// ==============================================

const approveSchema = {
  token: { required: true, type: "string" as const },
  action: { required: true, type: "string" as const, enum: ["approve", "dispute", "request_otp", "verify_otp"] },
  dispute_reason: { required: false, type: "string" as const, maxLength: 500 },
  account_holder_name: { required: false, type: "string" as const },
  account_number: { required: false, type: "string" as const },
  ifsc_code: { required: false, type: "string" as const },
  otp: { required: false, type: "string" as const, minLength: 6, maxLength: 6 },
  email: { required: false, type: "string" as const },
};

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabase = createServiceClient();
  const audit = new AuditLogger(supabase, {
    actorType: "user",
    functionName: "landlord-approve",
    ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0],
    userAgent: req.headers.get("user-agent") ?? undefined,
    requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
  });

  try {
    // Handle GET - Fetch tenancy details by token
    if (req.method === "GET") {
      const url = new URL(req.url);
      const token = url.searchParams.get("token");

      if (!token) {
        throw new ValidationError("Token is required");
      }

      return await handleGetTenancyDetails(supabase, token, audit);
    }

    // Handle POST - Approve, dispute, or OTP flow
    if (req.method === "POST") {
      const body = await req.json();
      const validatedBody = validateSchema<ApproveRequest>(body, approveSchema, true);

      switch (validatedBody.action) {
        case "request_otp":
          return await handleRequestOtp(supabase, validatedBody, audit);
        case "verify_otp":
          return await handleVerifyOtp(supabase, validatedBody, audit);
        case "approve":
          return await handleApprove(supabase, validatedBody, audit);
        case "dispute":
          return await handleDispute(supabase, validatedBody, audit);
        default:
          throw new ValidationError("Invalid action");
      }
    }

    return errorResponse("Method not allowed", 405);
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});

// ==============================================
// GET TENANCY DETAILS
// ==============================================

async function handleGetTenancyDetails(
  supabase: ReturnType<typeof createServiceClient>,
  token: string,
  audit: AuditLogger
): Promise<Response> {
  // Find tenancy by approval token
  const { data: tenancy, error } = await supabase
    .from("tenancies")
    .select(`
      id, status, monthly_rent_paise, rent_due_day,
      lease_start_date, lease_end_date,
      property_address, property_city, property_state, property_pincode,
      landlord_name, landlord_phone, landlord_email,
      landlord_approved, landlord_approved_at,
      bank_verified, utility_verified,
      user_id,
      users!tenancies_user_id_fkey (
        first_name, last_name, phone
      )
    `)
    .eq("landlord_approval_token", token)
    .single();

  if (error || !tenancy) {
    throw new NotFoundError("Tenancy", token);
  }

  // Check if already processed
  if (tenancy.landlord_approved) {
    return jsonResponse({
      success: true,
      data: {
        already_approved: true,
        approved_at: tenancy.landlord_approved_at,
        message: "This tenancy has already been approved.",
      },
    });
  }

  // Log view
  await audit.logSuccess("LANDLORD_VIEWED_DETAILS", "landlord", "tenancy", tenancy.id, {
    landlord_phone_masked: `XXXXXX${tenancy.landlord_phone?.slice(-4) ?? ""}`,
  });

  // Return sanitized details
  // Note: Supabase returns the joined user as an object (not array) for single foreign key relations
  const user = (tenancy as any).users as { first_name: string; last_name: string; phone: string } | null;

  return jsonResponse({
    success: true,
    data: {
      tenancy_id: tenancy.id,
      status: tenancy.status,
      tenant: {
        name: user ? `${user.first_name} ${user.last_name ?? ""}`.trim() : "Unknown",
        phone_masked: user?.phone ? `XXXXXX${user.phone.slice(-4)}` : null,
      },
      property: {
        address: tenancy.property_address,
        city: tenancy.property_city,
        state: tenancy.property_state,
        pincode: tenancy.property_pincode,
      },
      rent: {
        monthly_amount: tenancy.monthly_rent_paise / 100,
        due_day: tenancy.rent_due_day,
      },
      lease: {
        start_date: tenancy.lease_start_date,
        end_date: tenancy.lease_end_date,
      },
      landlord: {
        name: tenancy.landlord_name,
        phone_masked: tenancy.landlord_phone
          ? `XXXXXX${tenancy.landlord_phone.slice(-4)}`
          : null,
      },
      verification_status: {
        bank_verified: tenancy.bank_verified,
        utility_verified: tenancy.utility_verified,
        landlord_approved: tenancy.landlord_approved,
      },
    },
  });
}

// ==============================================
// REQUEST OTP HANDLER
// ==============================================

async function handleRequestOtp(
  supabase: ReturnType<typeof createServiceClient>,
  request: ApproveRequest,
  audit: AuditLogger
): Promise<Response> {
  const { token, email } = request;

  // Find tenancy by token
  const { data: tenancy, error } = await supabase
    .from("tenancies")
    .select("id, landlord_name, landlord_email, landlord_approved, landlord_otp_attempts")
    .eq("landlord_approval_token", token)
    .single();

  if (error || !tenancy) {
    throw new NotFoundError("Tenancy", token);
  }

  if (tenancy.landlord_approved) {
    throw new AppError("Tenancy already approved", "ALREADY_APPROVED", 400);
  }

  // Verify email matches (if provided)
  const landlordEmail = tenancy.landlord_email;
  if (email && email.toLowerCase() !== landlordEmail?.toLowerCase()) {
    throw new ValidationError("Email does not match landlord on record");
  }

  if (!landlordEmail) {
    throw new AppError("No email address on record for landlord", "MISSING_EMAIL", 400);
  }

  // Check rate limiting
  if ((tenancy.landlord_otp_attempts ?? 0) >= 5) {
    throw new AppError(
      "Too many OTP requests. Please contact support.",
      "RATE_LIMITED",
      429
    );
  }

  // Generate OTP using database function
  const { data: otp, error: otpError } = await supabase.rpc("generate_landlord_otp", {
    p_tenancy_id: tenancy.id,
    p_email: landlordEmail,
  });

  if (otpError || !otp) {
    console.error("Failed to generate OTP:", otpError);
    throw new AppError("Failed to generate OTP", "OTP_ERROR", 500);
  }

  // Send OTP via email
  const emailResult = await sendEmail({
    to: landlordEmail,
    subject: "Your Flent Secured Verification Code",
    html: generateOtpEmailHtml(tenancy.landlord_name, otp),
    text: `Your Flent Secured OTP is ${otp}. This code is valid for 10 minutes. Do not share it with anyone.`,
  });

  await audit.logSuccess("LANDLORD_OTP_SENT", "landlord", "tenancy", tenancy.id, {
    email_masked: maskEmailAddress(landlordEmail),
    email_sent: emailResult.success,
  });

  if (!emailResult.success) {
    throw new AppError("Failed to send OTP email", "EMAIL_FAILED", 502);
  }

  return jsonResponse({
    success: true,
    message: "OTP sent to your email",
    data: {
      email_masked: maskEmailAddress(landlordEmail),
      expires_in_seconds: 600, // 10 minutes
    },
  });
}

/**
 * Generates HTML for OTP email.
 */
function generateOtpEmailHtml(landlordName: string, otp: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 480px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding: 40px; text-align: center;">
              <h1 style="margin: 0 0 20px; font-size: 20px; color: #1a1a1a;">🔐 Verification Code</h1>
              <p style="margin: 0 0 24px; font-size: 16px; color: #666;">Hello ${landlordName},</p>
              <p style="margin: 0 0 24px; font-size: 16px; color: #666;">Use this code to verify your identity on Flent Secured:</p>
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
                <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1a1a1a;">${otp}</span>
              </div>
              <p style="margin: 0; font-size: 14px; color: #999;">This code expires in <strong>10 minutes</strong>.<br>Do not share this code with anyone.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; border-top: 1px solid #e5e5e5; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #999;">© ${new Date().getFullYear()} Flent Technologies Pvt Ltd</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Masks an email address.
 */
function maskEmailAddress(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***@***";
  const maskedLocal = local.charAt(0) + "***";
  const domainParts = domain.split(".");
  const maskedDomain = domainParts[0].charAt(0) + "***";
  return `${maskedLocal}@${maskedDomain}.${domainParts.slice(1).join(".")}`;
}

// ==============================================
// VERIFY OTP HANDLER
// ==============================================

async function handleVerifyOtp(
  supabase: ReturnType<typeof createServiceClient>,
  request: ApproveRequest,
  audit: AuditLogger
): Promise<Response> {
  const { token, otp } = request;

  if (!otp) {
    throw new ValidationError("OTP is required", { otp: "Required" });
  }

  // Find tenancy by token
  const { data: tenancy, error } = await supabase
    .from("tenancies")
    .select("id, landlord_approved, landlord_otp_verified")
    .eq("landlord_approval_token", token)
    .single();

  if (error || !tenancy) {
    throw new NotFoundError("Tenancy", token);
  }

  if (tenancy.landlord_approved) {
    throw new AppError("Tenancy already approved", "ALREADY_APPROVED", 400);
  }

  // Verify OTP using database function
  const { data: isValid, error: verifyError } = await supabase.rpc("verify_landlord_otp", {
    p_tenancy_id: tenancy.id,
    p_otp: otp,
  });

  if (verifyError) {
    console.error("Failed to verify OTP:", verifyError);
    throw new AppError("Failed to verify OTP", "OTP_ERROR", 500);
  }

  if (!isValid) {
    await audit.logFailure(
      "LANDLORD_OTP_FAILED",
      "landlord",
      "INVALID_OTP",
      "Invalid or expired OTP",
      "tenancy",
      tenancy.id
    );
    throw new AppError("Invalid or expired OTP", "INVALID_OTP", 400);
  }

  await audit.logSuccess("LANDLORD_OTP_VERIFIED", "landlord", "tenancy", tenancy.id);

  return jsonResponse({
    success: true,
    message: "OTP verified successfully",
    data: {
      otp_verified: true,
      next_step: "You can now approve or dispute the tenancy",
    },
  });
}

// ==============================================
// APPROVE HANDLER
// ==============================================

async function handleApprove(
  supabase: ReturnType<typeof createServiceClient>,
  request: ApproveRequest,
  audit: AuditLogger
): Promise<Response> {
  const { token, account_holder_name, account_number, ifsc_code } = request;

  // Validate required fields for approval
  if (!account_holder_name || !account_number || !ifsc_code) {
    const fields: Record<string, string> = {};
    if (!account_holder_name) fields.account_holder_name = "Required";
    if (!account_number) fields.account_number = "Required";
    if (!ifsc_code) fields.ifsc_code = "Required";
    throw new ValidationError("Bank account details are required for approval", fields);
  }

  if (!isValidIfsc(ifsc_code)) {
    throw new ValidationError("Invalid IFSC code format", { ifsc_code: "Invalid format" });
  }

  // Find tenancy
  const { data: tenancy, error } = await supabase
    .from("tenancies")
    .select("id, user_id, landlord_name, landlord_phone, landlord_approved, landlord_otp_verified")
    .eq("landlord_approval_token", token)
    .single();

  if (error || !tenancy) {
    throw new NotFoundError("Tenancy", token);
  }

  if (tenancy.landlord_approved) {
    throw new AppError("Tenancy already approved", "ALREADY_APPROVED", 400);
  }

  // Require OTP verification before approval
  if (!tenancy.landlord_otp_verified) {
    throw new AppError(
      "OTP verification required before approval. Please verify your email first.",
      "OTP_REQUIRED",
      403
    );
  }

  // Encrypt account number
  const encryptedAccountNumber = await encrypt(account_number);
  const sanitizedIfsc = sanitizeIfsc(ifsc_code);

  // Create landlord bank account record
  const { data: bankAccount, error: bankError } = await supabase
    .from("bank_accounts")
    .insert({
      user_id: tenancy.user_id, // Associate with tenant's user for now
      party_type: "landlord",
      account_holder_name,
      account_number_encrypted: encryptedAccountNumber,
      account_number_masked: maskAccountNumber(account_number),
      ifsc_code: sanitizedIfsc,
      verified: false, // Will be verified via penny drop
      is_default: true,
    })
    .select()
    .single();

  if (bankError) {
    console.error("Failed to create bank account:", bankError);
    throw new AppError("Failed to save bank account", "DB_ERROR", 500);
  }

  // Update tenancy
  const { error: updateError } = await supabase
    .from("tenancies")
    .update({
      landlord_approved: true,
      landlord_approved_at: new Date().toISOString(),
      landlord_response: "approved",
      status: "active", // Activate tenancy on landlord approval
    })
    .eq("id", tenancy.id);

  if (updateError) {
    console.error("Failed to update tenancy:", updateError);
    throw new AppError("Failed to approve tenancy", "DB_ERROR", 500);
  }

  // Log audit
  await audit.logSuccess(AuditActions.LANDLORD_APPROVED, "landlord", "tenancy", tenancy.id, {
    bank_account_id: bankAccount.id,
  });

  // Create in-app notification for tenant
  const { data: user } = await supabase
    .from("users")
    .select("first_name")
    .eq("id", tenancy.user_id)
    .single();

  await supabase.rpc("create_notification", {
    p_user_id: tenancy.user_id,
    p_title: "Landlord Approved!",
    p_body: `Great news${user?.first_name ? `, ${user.first_name}` : ""}! Your landlord has approved your tenancy. You can now make rent payments.`,
    p_notification_type: "landlord_approved",
    p_action_type: "navigate",
    p_action_data: { screen: "tenancy", tenancy_id: tenancy.id },
    p_related_entity_type: "tenancy",
    p_related_entity_id: tenancy.id,
    p_priority: "high",
  });

  return jsonResponse({
    success: true,
    message: "Tenancy approved successfully",
    data: {
      tenancy_id: tenancy.id,
      bank_account_id: bankAccount.id,
      next_steps: [
        "Bank account will be verified via penny drop",
        "Tenant can now make rent payments",
      ],
    },
  });
}

// ==============================================
// DISPUTE HANDLER
// ==============================================

async function handleDispute(
  supabase: ReturnType<typeof createServiceClient>,
  request: ApproveRequest,
  audit: AuditLogger
): Promise<Response> {
  const { token, dispute_reason } = request;

  if (!dispute_reason) {
    throw new ValidationError("Dispute reason is required", { dispute_reason: "Required" });
  }

  // Find tenancy
  const { data: tenancy, error } = await supabase
    .from("tenancies")
    .select("id, user_id, landlord_name, landlord_email")
    .eq("landlord_approval_token", token)
    .single();

  if (error || !tenancy) {
    throw new NotFoundError("Tenancy", token);
  }

  // Update tenancy with dispute status
  const { error: updateError } = await supabase
    .from("tenancies")
    .update({
      landlord_response: "disputed",
      landlord_dispute_reason: dispute_reason,
      landlord_disputed_at: new Date().toISOString(),
    })
    .eq("id", tenancy.id);

  if (updateError) {
    console.error("Failed to update tenancy with dispute:", updateError);
  }

  // Log the dispute
  await audit.log({
    action: AuditActions.LANDLORD_DISPUTED,
    category: "landlord",
    entityType: "tenancy",
    entityId: tenancy.id,
    details: {
      dispute_reason,
      landlord_name: tenancy.landlord_name,
    },
    status: "success",
  });

  // Create a support ticket or flag for review
  await supabase.from("audit_logs").insert({
    user_id: tenancy.user_id,
    actor_type: "user",
    action: "TENANCY_DISPUTED",
    action_category: "landlord",
    entity_type: "tenancy",
    entity_id: tenancy.id,
    details: {
      dispute_reason,
      landlord_name: tenancy.landlord_name,
      landlord_email: tenancy.landlord_email,
      requires_review: true,
    },
  });

  // Create in-app notification for tenant
  await supabase.rpc("create_notification", {
    p_user_id: tenancy.user_id,
    p_title: "Tenancy Dispute",
    p_body: "Your landlord has raised a concern about the tenancy details. Our team will contact you shortly to resolve this.",
    p_notification_type: "landlord_disputed",
    p_action_type: "navigate",
    p_action_data: { screen: "support" },
    p_related_entity_type: "tenancy",
    p_related_entity_id: tenancy.id,
    p_priority: "high",
  });

  return jsonResponse({
    success: true,
    message: "Dispute recorded. Our team will review and contact both parties.",
    data: {
      tenancy_id: tenancy.id,
      dispute_reason,
    },
  });
}
