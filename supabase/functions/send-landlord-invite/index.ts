/**
 * Flent Secured v2 - Send Landlord Invite Edge Function
 *
 * Sends an invitation to the landlord to approve the tenancy.
 * Generates a unique approval token and sends WhatsApp/SMS.
 *
 * Endpoint: POST /functions/v1/send-landlord-invite
 * Auth: Required (User JWT)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  createServiceClient,
  createAuthenticatedClient,
} from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { AppError, ValidationError, handleError } from "../_shared/errors.ts";
import { validateSchema } from "../_shared/validation.ts";
import { AuditLogger, AuditActions } from "../_shared/audit.ts";
import { sendEmail } from "../_shared/notifications.ts";
import { generateSecureRandom } from "../_shared/crypto.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const INVITE_EXPIRY_HOURS = 72; // 3 days
const LANDLORD_PORTAL_URL = "https://landlord.flentsecured.com";

// ==============================================
// TYPES
// ==============================================

interface SendInviteRequest {
  tenancy_id: string;
  landlord_name?: string;
  landlord_email?: string;
  resend?: boolean;
}

// ==============================================
// VALIDATION SCHEMA
// ==============================================

const requestSchema = {
  tenancy_id: { required: true, type: "string" as const },
  landlord_name: { required: false, type: "string" as const },
  landlord_email: { required: false, type: "string" as const },
  resend: { required: false, type: "boolean" as const },
};

// ==============================================
// EMAIL TEMPLATE
// ==============================================

function generateLandlordInviteEmail(params: {
  landlordName: string;
  tenantName: string;
  propertyAddress: string;
  monthlyRent: string;
  approvalUrl: string;
  expiresIn: string;
}): { html: string; text: string } {
  const { landlordName, tenantName, propertyAddress, monthlyRent, approvalUrl, expiresIn } = params;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Tenancy - Flent Secured</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #1a1a1a;">
                🏠 Flent Secured
              </h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; color: #333; line-height: 1.6;">
                Hello <strong>${landlordName}</strong>,
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; color: #333; line-height: 1.6;">
                <strong>${tenantName}</strong> has registered you as their landlord on Flent Secured for the following property:
              </p>

              <!-- Property Details Card -->
              <table role="presentation" style="width: 100%; background-color: #f8f9fa; border-radius: 8px; margin: 20px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 10px; font-size: 14px; color: #666;">Property Address</p>
                    <p style="margin: 0 0 16px; font-size: 16px; color: #1a1a1a; font-weight: 500;">${propertyAddress}</p>
                    <p style="margin: 0 0 10px; font-size: 14px; color: #666;">Monthly Rent</p>
                    <p style="margin: 0; font-size: 20px; color: #1a1a1a; font-weight: 600;">₹${monthlyRent}</p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 24px; font-size: 16px; color: #333; line-height: 1.6;">
                Please verify and approve this tenancy by clicking the button below:
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center">
                    <a href="${approvalUrl}" style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                      Review & Approve Tenancy
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; font-size: 14px; color: #666; text-align: center;">
                This link will expire in <strong>${expiresIn}</strong>.
              </p>
            </td>
          </tr>

          <!-- Security Note -->
          <tr>
            <td style="padding: 20px 40px;">
              <table role="presentation" style="width: 100%; background-color: #fef3c7; border-radius: 8px;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0; font-size: 14px; color: #92400e; line-height: 1.5;">
                      ⚠️ If you did not expect this email or do not recognize this tenant, please ignore this message or report it to us at support@flentsecured.com
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0 0 8px; font-size: 14px; color: #666; text-align: center;">
                Flent Secured - Rent payments made simple
              </p>
              <p style="margin: 0; font-size: 12px; color: #999; text-align: center;">
                © ${new Date().getFullYear()} Flent Technologies Pvt Ltd. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
Hello ${landlordName},

${tenantName} has registered you as their landlord on Flent Secured.

Property: ${propertyAddress}
Monthly Rent: ₹${monthlyRent}

Please verify and approve this tenancy by visiting:
${approvalUrl}

This link will expire in ${expiresIn}.

If you did not expect this email, please ignore it or contact support@flentsecured.com

- Flent Secured Team
  `.trim();

  return { html, text };
}

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const supabase = createServiceClient();

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const { userId } = await createAuthenticatedClient(authHeader);

    const audit = new AuditLogger(supabase, {
      actorType: "user",
      actorId: userId,
      functionName: "send-landlord-invite",
      requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
    });

    // Parse and validate request
    const body = await req.json();
    const { tenancy_id, landlord_name, landlord_email, resend } = validateSchema<SendInviteRequest>(
      body,
      requestSchema,
      true
    );

    // Fetch tenancy and verify ownership
    const { data: tenancy, error: tenancyError } = await supabase
      .from("tenancies")
      .select("*")
      .eq("id", tenancy_id)
      .eq("user_id", userId)
      .single();

    if (tenancyError || !tenancy) {
      throw new AppError("Tenancy not found or access denied", "NOT_FOUND", 404);
    }

    // Check if already approved
    if (tenancy.landlord_approved) {
      return jsonResponse({
        success: true,
        data: {
          already_approved: true,
          message: "Landlord has already approved this tenancy",
        },
      });
    }

    // Get landlord details (from request or existing tenancy)
    const finalLandlordName = landlord_name ?? tenancy.landlord_name;
    const finalLandlordEmail = landlord_email ?? tenancy.landlord_email;

    if (!finalLandlordEmail || !isValidEmail(finalLandlordEmail)) {
      throw new ValidationError("Valid landlord email address is required", {
        landlord_email: "Invalid or missing email address",
      });
    }

    // Check for existing invite token (if not resend)
    let approvalToken = tenancy.landlord_approval_token;
    let tokenExpiresAt = tenancy.landlord_token_expires_at;

    const now = new Date();
    const needsNewToken = !approvalToken ||
      !tokenExpiresAt ||
      new Date(tokenExpiresAt) < now ||
      resend;

    if (needsNewToken) {
      // Generate new approval token
      approvalToken = generateSecureRandom(32);
      tokenExpiresAt = new Date(now.getTime() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

      // Update tenancy with new token and landlord info
      const { error: updateError } = await supabase
        .from("tenancies")
        .update({
          landlord_name: finalLandlordName,
          landlord_email: finalLandlordEmail,
          landlord_approval_token: approvalToken,
          landlord_token_expires_at: tokenExpiresAt,
          landlord_invite_sent_at: now.toISOString(),
          landlord_invite_count: (tenancy.landlord_invite_count ?? 0) + 1,
        })
        .eq("id", tenancy_id);

      if (updateError) {
        console.error("Failed to update tenancy:", updateError);
        throw new AppError("Failed to generate invite", "DB_ERROR", 500);
      }
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

    // Format rent amount
    const monthlyRent = (tenancy.monthly_rent_paise / 100).toLocaleString("en-IN");

    // Generate email content
    const emailContent = generateLandlordInviteEmail({
      landlordName: finalLandlordName,
      tenantName,
      propertyAddress: tenancy.property_address,
      monthlyRent,
      approvalUrl,
      expiresIn: "72 hours",
    });

    // Send email via Resend
    const emailResult = await sendEmail({
      to: finalLandlordEmail,
      subject: `${tenantName} has added you as their landlord - Action Required`,
      html: emailContent.html,
      text: emailContent.text,
    });

    // Log audit
    await audit.logSuccess(
      AuditActions.LANDLORD_INVITE_SENT,
      "tenancy",
      "tenancies",
      tenancy_id,
      {
        landlord_email_masked: maskEmail(finalLandlordEmail),
        email_sent: emailResult.success,
        email_message_id: emailResult.messageId,
        is_resend: resend ?? false,
        expires_at: tokenExpiresAt,
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
        message: "Landlord invitation email sent successfully",
        sent_via: "email",
        landlord_email_masked: maskEmail(finalLandlordEmail),
        expires_at: tokenExpiresAt,
      },
    });
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});

// ==============================================
// HELPER FUNCTIONS
// ==============================================

/**
 * Validates email format.
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Masks an email address for logging.
 * john.doe@example.com -> j***@e***.com
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***@***";

  const domainParts = domain.split(".");
  const maskedLocal = local.charAt(0) + "***";
  const maskedDomain = domainParts[0].charAt(0) + "***";
  const tld = domainParts.slice(1).join(".");

  return `${maskedLocal}@${maskedDomain}.${tld}`;
}
