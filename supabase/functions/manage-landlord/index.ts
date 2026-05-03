/**
 * Flent Secured v2 - Manage Landlord Edge Function
 *
 * Read + update operations for landlord details on a tenancy.
 *
 * Endpoints:
 * - GET /functions/v1/manage-landlord?tenancy_id=xxx — fetch landlord details
 * - PUT /functions/v1/manage-landlord                 — update landlord contact info
 *
 * The POST/email-invite handler that used to live here was removed in the
 * 2026-05-03 release: the email invite path was redundant (RN app routes
 * 100% through WhatsApp via invite-landlord-whatsapp, and the new template
 * URL doesn't carry tokens). For tenant-initiated invites, call
 * /functions/v1/invite-landlord-whatsapp.
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
  isValidPhone,
} from "../_shared/validation.ts";
import { AuditLogger } from "../_shared/audit.ts";

// ==============================================
// TYPES
// ==============================================

interface UpdateLandlordRequest {
  tenancy_id: string;
  landlord_name?: string;
  landlord_email?: string;
  landlord_phone?: string;
  country_code?: string;
}

// ==============================================
// VALIDATION SCHEMAS
// ==============================================

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
  country_code: {
    required: false,
    type: "string" as const,
    custom: (v: unknown) =>
      v === undefined || v === null ||
      (typeof v === "string" && /^\+\d{1,3}$/.test(v)) ||
      "Country code must be in '+CC' form (e.g. '+91', '+1', '+971')",
  },
};

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabase = createServiceClient();

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const { userId } = await createAuthenticatedClient(authHeader);

    const audit = AuditLogger.fromRequest(supabase, req, userId, "manage-landlord");

    switch (req.method) {
      case "GET":
        return await handleGetLandlord(req, supabase, userId);
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

  const { tenancy_id, landlord_name, landlord_email, landlord_phone, country_code } = validated;

  // Verify tenancy ownership
  const { data: tenancy, error: tenancyError } = await supabase
    .from("tenancies")
    .select("id, user_id, landlord_approved, landlord_name, landlord_email, landlord_phone, country_code")
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

  // Phone updates must always include country_code (or be cleared together).
  // Indian tenants frequently have NRI landlords, so we never default the
  // country code — the caller must say which country the number belongs to.
  if (landlord_phone !== undefined || country_code !== undefined) {
    const nextPhone = landlord_phone !== undefined ? landlord_phone : tenancy.landlord_phone;
    const nextCountryCode = country_code !== undefined ? country_code : tenancy.country_code;

    if (nextPhone) {
      if (!nextCountryCode) {
        throw new ValidationError(
          "country_code is required when setting landlord_phone",
          { country_code: "Required (e.g. '+91', '+1', '+971')" }
        );
      }
      if (!isValidPhone(nextPhone, nextCountryCode)) {
        throw new ValidationError("Invalid landlord phone for the selected country", {
          landlord_phone: "Invalid format for country code " + nextCountryCode,
        });
      }
    }

    if (landlord_phone !== undefined) {
      oldValues.landlord_phone = tenancy.landlord_phone;
      newValues.landlord_phone = landlord_phone;
      // Store digits only — country_code holds the +CC, per the canonical
      // (country_code || landlord_phone) E.164 contract.
      updatePayload.landlord_phone = landlord_phone ? landlord_phone.replace(/\D/g, "") : landlord_phone;
    }
    if (country_code !== undefined) {
      oldValues.country_code = tenancy.country_code;
      newValues.country_code = country_code;
      updatePayload.country_code = country_code;
    }
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
