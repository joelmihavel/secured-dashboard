/**
 * Flent Secured v2 - Manage Landlord Edge Function (BE-079)
 *
 * CRUD operations for landlord management tied to a tenancy.
 *
 * Endpoints:
 * - GET  /functions/v1/manage-landlord?tenancy_id=xxx - Fetch landlord details
 * - POST /functions/v1/manage-landlord - Send landlord invite (email notification)
 * - PUT  /functions/v1/manage-landlord - Update landlord contact info
 *
 * Auth: Required (User JWT)
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
  NotFoundError,
  handleError,
} from "../_shared/errors.ts";
import {
  validateSchema,
  isValidUuid,
  isValidEmail,
  isValidIndianPhone,
} from "../_shared/validation.ts";
import { AuditLogger, AuditActions } from "../_shared/audit.ts";
import { sendEmail, MessageTemplates } from "../_shared/notifications.ts";
import { generateSecureRandom } from "../_shared/crypto.ts";
import { isTestMode, mockData } from "../_shared/test-mode.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const INVITE_EXPIRY_HOURS = 72;
const LANDLORD_PORTAL_URL = "https://landlord.flentsecured.com";

// ==============================================
// TYPES
// ==============================================

interface SendInviteRequest {
  tenancy_id: string;
  landlord_name: string;
  landlord_email: string;
  landlord_phone?: string;
}

interface UpdateLandlordRequest {
  tenancy_id: string;
  landlord_name?: string;
  landlord_email?: string;
  landlord_phone?: string;
}

// ==============================================
// VALIDATION SCHEMAS
// ==============================================

const inviteSchema = {
  tenancy_id: {
    required: true,
    type: "string" as const,
    custom: (v: unknown) => isValidUuid(v) || "Invalid tenancy ID",
  },
  landlord_name: { required: true, type: "string" as const, minLength: 2, maxLength: 100 },
  landlord_email: {
    required: true,
    type: "string" as const,
    custom: (v: unknown) =>
      (typeof v === "string" && isValidEmail(v)) || "Invalid email address",
  },
  landlord_phone: { required: false, type: "string" as const },
};

const updateSchema = {
  tenancy_id: {
    required: true,
    type: "string" as const,
    custom: (v: unknown) => isValidUuid(v) || "Invalid tenancy ID",
  },
  landlord_name: { required: false, type: "string" as const, minLength: 2, maxLength: 100 },
  landlord_email: {
    required: false,
    type: "string" as const,
    custom: (v: unknown) =>
      v === undefined || v === null || (typeof v === "string" && isValidEmail(v)) || "Invalid email address",
  },
  landlord_phone: { required: false, type: "string" as const },
};

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // MD-131: Test mode support
  if (isTestMode(req)) {
    return handleTestMode(req);
  }

  const supabase = createServiceClient();

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const { userId } = await createAuthenticatedClient(authHeader);

    const audit = AuditLogger.fromRequest(supabase, req, userId, "manage-landlord");

    switch (req.method) {
      case "GET":
        return await handleGetLandlord(req, supabase, userId);
      case "POST":
        return await handleSendInvite(req, supabase, userId, audit);
      case "PUT":
        return await handleUpdateLandlord(req, supabase, userId, audit);
      default:
        return errorResponse("Method not allowed", 405);
    }
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});

// ==============================================
// GET LANDLORD DETAILS
// ==============================================

async function handleGetLandlord(
  req: Request,
  supabase: ReturnType<typeof createServiceClient>,
  userId: string
): Promise<Response> {
  const url = new URL(req.url);
  const tenancyId = url.searchParams.get("tenancy_id");

  if (!tenancyId || !isValidUuid(tenancyId)) {
    throw new ValidationError("Valid tenancy_id is required", {
      tenancy_id: "Required",
    });
  }

  // Fetch tenancy with landlord info, verifying ownership
  const { data: tenancy, error } = await supabase
    .from("tenancies")
    .select(`
      id, landlord_name, landlord_phone, landlord_email,
      landlord_approved, landlord_approved_at,
      landlord_invite_sent_at, landlord_invite_count,
      landlord_response, landlord_dispute_reason,
      property_address, property_city,
      monthly_rent_paise, status,
      bank_accounts (
        id, account_holder_name, account_number_masked, ifsc_code, verified, party_type
      )
    `)
    .eq("id", tenancyId)
    .eq("user_id", userId)
    .single();

  if (error || !tenancy) {
    throw new NotFoundError("Tenancy", tenancyId);
  }

  // Filter to landlord bank accounts only
  const landlordBankAccounts = ((tenancy as any).bank_accounts ?? []).filter(
    (ba: any) => ba.party_type === "landlord"
  );

  return jsonResponse({
    success: true,
    data: {
      tenancy_id: tenancy.id,
      landlord: {
        name: tenancy.landlord_name,
        phone: tenancy.landlord_phone,
        email_masked: tenancy.landlord_email ? maskEmail(tenancy.landlord_email) : null,
        approved: tenancy.landlord_approved,
        approved_at: tenancy.landlord_approved_at,
        response: tenancy.landlord_response,
        dispute_reason: tenancy.landlord_dispute_reason,
      },
      invite: {
        sent_at: tenancy.landlord_invite_sent_at,
        invite_count: tenancy.landlord_invite_count,
      },
      bank_accounts: landlordBankAccounts.map((ba: any) => ({
        id: ba.id,
        account_holder_name: ba.account_holder_name,
        account_number_masked: ba.account_number_masked,
        ifsc_code: ba.ifsc_code,
        verified: ba.verified,
      })),
      property: {
        address: tenancy.property_address,
        city: tenancy.property_city,
        monthly_rent: (tenancy.monthly_rent_paise ?? 0) / 100,
      },
    },
  });
}

// ==============================================
// SEND LANDLORD INVITE
// ==============================================

async function handleSendInvite(
  req: Request,
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  audit: AuditLogger
): Promise<Response> {
  const body = await req.json();
  const validated = validateSchema<SendInviteRequest>(body, inviteSchema, true);

  const { tenancy_id, landlord_name, landlord_email, landlord_phone } = validated;

  // Verify tenancy ownership
  const { data: tenancy, error: tenancyError } = await supabase
    .from("tenancies")
    .select("id, user_id, landlord_approved, landlord_name, landlord_email, landlord_invite_count, property_address, monthly_rent_paise")
    .eq("id", tenancy_id)
    .eq("user_id", userId)
    .single();

  if (tenancyError || !tenancy) {
    throw new NotFoundError("Tenancy", tenancy_id);
  }

  if (tenancy.landlord_approved) {
    return jsonResponse({
      success: true,
      data: {
        already_approved: true,
        message: "Landlord has already approved this tenancy",
      },
    });
  }

  // Generate approval token
  const approvalToken = generateSecureRandom(32);
  const expiresAt = new Date(
    Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000
  ).toISOString();

  // Update tenancy with landlord info and token
  const updatePayload: Record<string, unknown> = {
    landlord_name,
    landlord_email,
    landlord_approval_token: approvalToken,
    landlord_token_expires_at: expiresAt,
    landlord_invite_sent_at: new Date().toISOString(),
    landlord_invite_count: (tenancy.landlord_invite_count ?? 0) + 1,
  };

  if (landlord_phone) {
    updatePayload.landlord_phone = landlord_phone;
  }

  const { error: updateError } = await supabase
    .from("tenancies")
    .update(updatePayload)
    .eq("id", tenancy_id);

  if (updateError) {
    console.error("Failed to update tenancy with invite:", updateError);
    throw new AppError("Failed to generate invite", "DB_ERROR", 500);
  }

  // Build approval URL
  const approvalUrl = `${LANDLORD_PORTAL_URL}/approve/${tenancy_id}?token=${approvalToken}`;

  // Get tenant name for the email
  const { data: tenant } = await supabase
    .from("users")
    .select("first_name, last_name")
    .eq("id", userId)
    .single();

  const tenantName = tenant?.first_name
    ? `${tenant.first_name}${tenant.last_name ? ` ${tenant.last_name}` : ""}`
    : "Your tenant";

  const monthlyRent = ((tenancy.monthly_rent_paise ?? 0) / 100).toLocaleString("en-IN");

  // Send email notification
  const emailResult = await sendEmail({
    to: landlord_email,
    subject: `${tenantName} has added you as their landlord - Action Required`,
    html: generateInviteEmailHtml({
      landlordName: landlord_name,
      tenantName,
      propertyAddress: tenancy.property_address,
      monthlyRent,
      approvalUrl,
    }),
    text: `Hi ${landlord_name}, ${tenantName} has registered you as their landlord on Flent Secured for ${tenancy.property_address}. Monthly rent: Rs ${monthlyRent}. Please verify at: ${approvalUrl}. This link expires in 72 hours.`,
  });

  await audit.logSuccess(
    AuditActions.LANDLORD_INVITE_SENT,
    "landlord",
    "tenancy",
    tenancy_id,
    {
      landlord_email_masked: maskEmail(landlord_email),
      email_sent: emailResult.success,
      email_message_id: emailResult.messageId,
      expires_at: expiresAt,
    }
  );

  if (!emailResult.success) {
    throw new AppError(
      `Failed to send invitation email: ${emailResult.error}`,
      "EMAIL_FAILED",
      502
    );
  }

  return jsonResponse({
    success: true,
    data: {
      invite_id: tenancy_id,
      status: "sent",
      sent_via: "email",
      expires_at: expiresAt,
      landlord_email_masked: maskEmail(landlord_email),
      message: "Landlord invitation email sent successfully",
    },
  });
}

// ==============================================
// UPDATE LANDLORD CONTACT INFO
// ==============================================

async function handleUpdateLandlord(
  req: Request,
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  audit: AuditLogger
): Promise<Response> {
  const body = await req.json();
  const validated = validateSchema<UpdateLandlordRequest>(body, updateSchema, true);

  const { tenancy_id, landlord_name, landlord_email, landlord_phone } = validated;

  // Verify tenancy ownership
  const { data: tenancy, error: tenancyError } = await supabase
    .from("tenancies")
    .select("id, user_id, landlord_approved, landlord_name, landlord_email, landlord_phone")
    .eq("id", tenancy_id)
    .eq("user_id", userId)
    .single();

  if (tenancyError || !tenancy) {
    throw new NotFoundError("Tenancy", tenancy_id);
  }

  // Cannot update after landlord has approved
  if (tenancy.landlord_approved) {
    throw new AppError(
      "Cannot update landlord info after approval. Contact support for changes.",
      "ALREADY_APPROVED",
      400
    );
  }

  // Build update payload with only provided fields
  const updatePayload: Record<string, unknown> = {};
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  if (landlord_name !== undefined) {
    oldValues.landlord_name = tenancy.landlord_name;
    newValues.landlord_name = landlord_name;
    updatePayload.landlord_name = landlord_name;
  }

  if (landlord_email !== undefined) {
    oldValues.landlord_email = tenancy.landlord_email;
    newValues.landlord_email = landlord_email;
    updatePayload.landlord_email = landlord_email;
    // Reset invite token if email changes (need new invite)
    updatePayload.landlord_approval_token = null;
    updatePayload.landlord_token_expires_at = null;
  }

  if (landlord_phone !== undefined) {
    if (landlord_phone && !isValidIndianPhone(landlord_phone)) {
      throw new ValidationError("Invalid phone number", { landlord_phone: "Invalid format" });
    }
    oldValues.landlord_phone = tenancy.landlord_phone;
    newValues.landlord_phone = landlord_phone;
    updatePayload.landlord_phone = landlord_phone;
  }

  if (Object.keys(updatePayload).length === 0) {
    throw new ValidationError("At least one field must be provided for update");
  }

  const { error: updateError } = await supabase
    .from("tenancies")
    .update(updatePayload)
    .eq("id", tenancy_id);

  if (updateError) {
    console.error("Failed to update landlord info:", updateError);
    throw new AppError("Failed to update landlord info", "DB_ERROR", 500);
  }

  await audit.log({
    action: "LANDLORD_INFO_UPDATED",
    category: "landlord",
    entityType: "tenancy",
    entityId: tenancy_id,
    oldValues,
    newValues,
    status: "success",
  });

  return jsonResponse({
    success: true,
    data: {
      tenancy_id,
      updated_fields: Object.keys(newValues),
      invite_invalidated: landlord_email !== undefined,
      message: "Landlord info updated successfully",
    },
  });
}

// ==============================================
// TEST MODE HANDLER
// ==============================================

function handleTestMode(req: Request): Response {
  const url = new URL(req.url);

  if (req.method === "GET") {
    return jsonResponse({
      success: true,
      data: {
        tenancy_id: mockData.tenancy.id,
        landlord: {
          name: mockData.landlord.name,
          phone: mockData.landlord.phone,
          email_masked: "l***@t***.com",
          approved: true,
          approved_at: "2026-01-15T00:00:00.000Z",
          response: "approved",
          dispute_reason: null,
        },
        invite: {
          sent_at: "2026-01-10T00:00:00.000Z",
          invite_count: 1,
        },
        bank_accounts: [
          {
            id: "00000000-0000-0000-0000-000000000099",
            account_holder_name: "Test Landlord",
            account_number_masked: mockData.landlord.bank_account_masked,
            ifsc_code: "SBIN0001234",
            verified: true,
          },
        ],
        property: {
          address: mockData.tenancy.property_address,
          city: mockData.tenancy.property_city,
          monthly_rent: mockData.tenancy.monthly_rent_paise / 100,
        },
      },
    });
  }

  if (req.method === "POST") {
    return jsonResponse({
      success: true,
      data: {
        invite_id: mockData.tenancy.id,
        status: "sent",
        sent_via: "email",
        expires_at: "2026-02-20T10:00:00.000Z",
        landlord_email_masked: "l***@t***.com",
        message: "Landlord invitation email sent successfully (test mode)",
      },
    });
  }

  // PUT
  return jsonResponse({
    success: true,
    data: {
      tenancy_id: mockData.tenancy.id,
      updated_fields: ["landlord_name"],
      invite_invalidated: false,
      message: "Landlord info updated successfully (test mode)",
    },
  });
}

// ==============================================
// HELPER FUNCTIONS
// ==============================================

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***@***";
  const domainParts = domain.split(".");
  const maskedLocal = local.charAt(0) + "***";
  const maskedDomain = domainParts[0].charAt(0) + "***";
  return `${maskedLocal}@${maskedDomain}.${domainParts.slice(1).join(".")}`;
}

function generateInviteEmailHtml(params: {
  landlordName: string;
  tenantName: string;
  propertyAddress: string;
  monthlyRent: string;
  approvalUrl: string;
}): string {
  const { landlordName, tenantName, propertyAddress, monthlyRent, approvalUrl } = params;
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f5f5f5;">
  <table role="presentation" style="width:100%;border-collapse:collapse;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="padding:40px 40px 20px;text-align:center;">
          <h1 style="margin:0;font-size:24px;font-weight:600;color:#1a1a1a;">Flent Secured</h1>
        </td></tr>
        <tr><td style="padding:20px 40px;">
          <p style="font-size:16px;color:#333;">Hello <strong>${landlordName}</strong>,</p>
          <p style="font-size:16px;color:#333;"><strong>${tenantName}</strong> has registered you as their landlord on Flent Secured.</p>
          <table role="presentation" style="width:100%;background-color:#f8f9fa;border-radius:8px;margin:20px 0;">
            <tr><td style="padding:20px;">
              <p style="margin:0 0 10px;font-size:14px;color:#666;">Property Address</p>
              <p style="margin:0 0 16px;font-size:16px;color:#1a1a1a;font-weight:500;">${propertyAddress}</p>
              <p style="margin:0 0 10px;font-size:14px;color:#666;">Monthly Rent</p>
              <p style="margin:0;font-size:20px;color:#1a1a1a;font-weight:600;">Rs ${monthlyRent}</p>
            </td></tr>
          </table>
          <p style="font-size:16px;color:#333;">Please verify and approve this tenancy:</p>
          <table role="presentation" style="width:100%;"><tr><td align="center">
            <a href="${approvalUrl}" style="display:inline-block;padding:14px 32px;background-color:#2563eb;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;border-radius:8px;">Review & Approve</a>
          </td></tr></table>
          <p style="margin:24px 0 0;font-size:14px;color:#666;text-align:center;">This link expires in <strong>72 hours</strong>.</p>
        </td></tr>
        <tr><td style="padding:30px 40px;border-top:1px solid #e5e5e5;">
          <p style="margin:0;font-size:12px;color:#999;text-align:center;">&copy; ${new Date().getFullYear()} Flent Technologies Pvt Ltd</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}
