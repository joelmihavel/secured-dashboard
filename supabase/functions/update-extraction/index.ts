/**
 * Flent Secured v2 - Update Extraction Edge Function
 *
 * Allows users to modify AI-extracted lease data before confirmation.
 * Stores user modifications in user_modified_data JSONB field.
 *
 * Endpoint: POST /functions/v1/update-extraction
 * Auth: Required (JWT)
 *
 * @author Backend API Agent
 * @date 2026-01-29
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, createAuthenticatedClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { AppError, ValidationError, NotFoundError, handleError } from "../_shared/errors.ts";
import { validateSchema, isValidUuid, isValidDate } from "../_shared/validation.ts";
import { AuditLogger } from "../_shared/audit.ts";

// ==============================================
// TYPES & VALIDATION
// ==============================================

interface UpdateExtractionRequest {
  extraction_id: string;
  modifications: {
    tenant_name?: string;
    tenant_names?: string[];
    landlord_name?: string;
    landlord_names?: string[];
    property_address?: string;
    monthly_rent?: number; // In rupees
    security_deposit?: number; // In rupees
    lease_start_date?: string; // YYYY-MM-DD
    lease_end_date?: string; // YYYY-MM-DD
    rent_due_day?: number; // 1-28
    landlord_phone?: string;
    landlord_email?: string;
    // Additional fields that can be modified
    property_type?: string;
    bhk_count?: string;
    furnished_status?: string;
    maintenance_charges?: number;
    parking_included?: boolean;
    agreement_date?: string;
    stamp_paper_value?: number;
    registration_number?: string;
  };
}

const requestSchema = {
  extraction_id: {
    required: true,
    type: "string" as const,
    custom: (v: unknown) => isValidUuid(v) || "Invalid extraction ID",
  },
  modifications: {
    required: true,
    type: "object" as const,
    custom: (v: unknown) => {
      if (!v || typeof v !== "object") return "modifications must be an object";
      const mods = v as Record<string, unknown>;
      if (Object.keys(mods).length === 0) return "At least one modification is required";

      // Validate specific fields
      if (mods.monthly_rent !== undefined) {
        const rent = mods.monthly_rent as number;
        if (!Number.isFinite(rent) || rent <= 0 || rent > 10000000) {
          return "monthly_rent must be between 1 and 1,00,00,000 rupees";
        }
      }

      if (mods.rent_due_day !== undefined) {
        const day = mods.rent_due_day as number;
        if (!Number.isInteger(day) || day < 1 || day > 28) {
          return "rent_due_day must be between 1 and 28";
        }
      }

      if (mods.lease_start_date !== undefined) {
        if (!isValidDate(mods.lease_start_date as string)) {
          return "lease_start_date must be in YYYY-MM-DD format";
        }
      }

      if (mods.lease_end_date !== undefined) {
        if (!isValidDate(mods.lease_end_date as string)) {
          return "lease_end_date must be in YYYY-MM-DD format";
        }
      }

      const isStringArray = (v: unknown): v is string[] =>
        Array.isArray(v) && v.every((x) => typeof x === "string");

      if (mods.tenant_names !== undefined && !isStringArray(mods.tenant_names)) {
        return "tenant_names must be an array of strings";
      }
      if (mods.landlord_names !== undefined && !isStringArray(mods.landlord_names)) {
        return "landlord_names must be an array of strings";
      }

      return true;
    },
  },
};

// Fields that can be modified by users
const MODIFIABLE_FIELDS = [
  "tenant_name",
  "tenant_names",
  "landlord_name",
  "landlord_names",
  "property_address",
  "monthly_rent",
  "security_deposit",
  "lease_start_date",
  "lease_end_date",
  "rent_due_day",
  "landlord_phone",
  "landlord_email",
  "property_type",
  "bhk_count",
  "furnished_status",
  "maintenance_charges",
  "parking_included",
  "agreement_date",
  "stamp_paper_value",
  "registration_number",
];

// Maps API field name → actual DB column on extracted_rental_info, with an
// optional unit transform. Fields NOT in this map are kept in the
// user_modified_data JSONB audit blob but never written to a real column —
// either because (a) the API field accepts a synthetic key (e.g. monthly_rent
// in rupees vs. monthly_rent_paise in paise) and we translate on the way in,
// or (b) the column simply doesn't exist on the table yet.
const COLUMN_MAP: Record<string, { column: string; transform?: (v: unknown) => unknown }> = {
  tenant_name: { column: "tenant_name" },
  tenant_names: { column: "tenant_names" },
  landlord_name: { column: "landlord_name" },
  landlord_names: { column: "landlord_names" },
  property_address: { column: "property_address" },
  monthly_rent: {
    column: "monthly_rent_paise",
    transform: (v: unknown) => Math.round((v as number) * 100),
  },
  security_deposit: {
    column: "security_deposit_paise",
    transform: (v: unknown) => Math.round((v as number) * 100),
  },
  lease_start_date: { column: "lease_start_date" },
  lease_end_date: { column: "lease_end_date" },
  rent_due_day: { column: "rent_due_day" },
  landlord_phone: { column: "landlord_phone" },
  landlord_email: { column: "landlord_email" },
  agreement_date: { column: "agreement_date" },
  registration_number: { column: "registration_number" },
};

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabase = createServiceClient();
  let audit: AuditLogger | null = null;
  let userId: string | null = null;

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const { userId: uid } = await createAuthenticatedClient(authHeader);
    userId = uid;

    // Initialize audit logger
    audit = AuditLogger.fromRequest(supabase, req, userId, "update-extraction");

    // Parse and validate request
    const body = await req.json();
    const { extraction_id, modifications } = validateSchema<UpdateExtractionRequest>(
      body,
      requestSchema,
      true
    );

    // Fetch the extraction record
    const { data: extraction, error: fetchError } = await supabase
      .from("extracted_rental_info")
      .select("*")
      .eq("id", extraction_id)
      .single();

    if (fetchError || !extraction) {
      throw new NotFoundError("Extraction", extraction_id);
    }

    // Verify ownership
    if (extraction.user_id !== userId) {
      throw new AppError(
        "You don't have permission to modify this extraction",
        "FORBIDDEN",
        403
      );
    }

    // Check extraction status - only allow modifications before confirmation
    if (extraction.extraction_status === "confirmed") {
      throw new AppError(
        "Cannot modify extraction after confirmation",
        "ALREADY_CONFIRMED",
        400
      );
    }

    // Filter to only allow modifiable fields
    const filteredModifications: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(modifications)) {
      if (MODIFIABLE_FIELDS.includes(key) && value !== undefined) {
        filteredModifications[key] = value;
      }
    }

    if (Object.keys(filteredModifications).length === 0) {
      throw new ValidationError("No valid modifications provided");
    }

    // Translate modifiable API fields to their actual DB columns (with unit
    // conversion where needed — e.g. monthly_rent rupees → monthly_rent_paise).
    // Edits used to live only in user_modified_data JSONB, which no consumer
    // reads — meaning admin views, payment recipient names, and PAN matching
    // all kept seeing the original Gemini extraction even after a user edit.
    const columnUpdates: Record<string, unknown> = {};
    for (const [apiKey, value] of Object.entries(filteredModifications)) {
      const mapping = COLUMN_MAP[apiKey];
      if (!mapping) continue;
      columnUpdates[mapping.column] = mapping.transform ? mapping.transform(value) : value;
    }

    // Get existing user_modified_data and modification_history
    const existingModifications = extraction.user_modified_data || {};
    const modificationHistory = extraction.modification_history || [];

    // Merge new modifications with existing ones
    const mergedModifications = {
      ...existingModifications,
      ...filteredModifications,
    };

    // Add to modification history
    const historyEntry = {
      timestamp: new Date().toISOString(),
      fields_modified: Object.keys(filteredModifications),
      modifications: filteredModifications,
    };
    modificationHistory.push(historyEntry);

    // Update the extraction record with optimistic lock on updated_at
    // to prevent concurrent modifications from overwriting each other
    const { data: updatedExtraction, error: updateError } = await supabase
      .from("extracted_rental_info")
      .update({
        ...columnUpdates,
        user_modified_data: mergedModifications,
        modification_history: modificationHistory,
        // updated_at is auto-set by trigger — no need to set manually
      })
      .eq("id", extraction_id)
      .eq("updated_at", extraction.updated_at) // optimistic lock
      .select()
      .single();

    if (updateError) {
      // PGRST116 = no rows returned (optimistic lock failed — concurrent modification)
      if (updateError.code === "PGRST116") {
        throw new AppError(
          "This record was modified by another request. Please refresh and try again.",
          "CONFLICT",
          409
        );
      }
      console.error("[update-extraction] Update error:", updateError);
      throw new Error(`Failed to update extraction: ${updateError.message}`);
    }

    // Log audit event
    await audit.logSuccess("EXTRACTION_MODIFIED", "extraction", "extracted_rental_info", extraction_id, {
      fields_modified: Object.keys(filteredModifications),
      modification_count: modificationHistory.length,
    });

    // Build response with merged data (original + modifications)
    const originalData = {
      tenant_name: extraction.tenant_name,
      landlord_name: extraction.landlord_name,
      property_address: extraction.property_address,
      monthly_rent: extraction.monthly_rent_paise ? extraction.monthly_rent_paise / 100 : null,
      security_deposit: extraction.security_deposit_paise ? extraction.security_deposit_paise / 100 : null,
      lease_start_date: extraction.lease_start_date,
      lease_end_date: extraction.lease_end_date,
      rent_due_day: extraction.rent_due_day,
      landlord_phone: extraction.landlord_phone,
      landlord_email: extraction.landlord_email,
    };

    const mergedData = {
      ...originalData,
      ...mergedModifications,
    };

    return jsonResponse({
      success: true,
      data: {
        extraction_id,
        original_data: originalData,
        user_modifications: mergedModifications,
        merged_data: mergedData,
        modification_count: modificationHistory.length,
        last_modified_at: updatedExtraction.updated_at,
        can_confirm: true, // User can now confirm with modifications
      },
    });
  } catch (error) {
    // Log failure
    if (audit && userId) {
      await audit.logFailure(
        "EXTRACTION_MODIFICATION_FAILED",
        "extraction",
        error instanceof AppError ? error.code : "UPDATE_FAILED",
        error instanceof Error ? error.message : "Unknown error",
        "extracted_rental_info"
      );
    }
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
