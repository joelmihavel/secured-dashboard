/**
 * Flent Secured v2 - Edge Function: confirm-extraction
 *
 * V1 COMPATIBILITY: Called by iOS app to confirm extracted rental data and lock user role.
 *
 * V2 IMPROVEMENTS:
 * - Creates a tenancy record (V2 concept) when user confirms
 * - Uses typed error handling
 * - Comprehensive audit logging
 * - Validates user_verified flag on extracted_rental_info
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { handleCors, getCorsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  AuthError,
  ValidationError,
  NotFoundError,
  AppError,
  handleError,
} from "../_shared/errors.ts";
import { AuditLogger } from "../_shared/audit.ts";
import { finalizeExtractionForOnboarding } from "../_shared/onboarding.ts";

// ==============================================
// TYPES
// ==============================================

interface ConfirmExtractionRequest {
  waitlist_entry_id?: string; // V1 format (actually extracted_rental_info_id)
  extracted_rental_info_id?: string; // V2 format
  extraction_id?: string; // V2 iOS format
  confirmed_role?: "tenant" | "landlord"; // Optional - defaults to "tenant" for iOS
  // Extraction data from iOS
  tenant_name?: string;
  landlord_name?: string;
  property_address?: string;
  property_city?: string;
  property_state?: string;
  property_pincode?: string;
  monthly_rent_paise?: number;
  security_deposit_paise?: number;
  rent_due_day?: number;
  lease_start_date?: string;
  lease_end_date?: string;
  landlord_phone?: string;
  landlord_email?: string;
}

interface ConfirmExtractionResponse {
  success: boolean;
  // V1/V2 flat fields for backward compatibility
  waitlist_entry_id?: string;
  extraction_id?: string;
  user_id?: string;
  confirmed_role?: string;
  contract_status?: string;
  tenancy_id?: string; // V2: created tenancy
  // iOS expects nested data object
  data?: {
    tenancy_id: string;
    user_status: string;
  };
  error?: string;
}

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const headers = getCorsHeaders(req);

  try {
    if (req.method !== "POST") {
      throw new ValidationError("Method not allowed", { method: "POST required" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = (Deno.env.get("SB_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY"))!;
    const supabaseServiceKey = (Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;

    // Validate auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new AuthError("Missing authorization header");
    }

    // Create client with user's auth
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthError("Unauthorized");
    }

    // Parse request body
    const body: ConfirmExtractionRequest = await req.json();

    // V1 uses waitlist_entry_id, V2 uses extracted_rental_info_id or extraction_id
    const extractionId =
      body.extraction_id || body.extracted_rental_info_id || body.waitlist_entry_id;
    // Default to "tenant" for iOS app (iOS users are always tenants during onboarding)
    const confirmedRole = body.confirmed_role || "tenant";

    console.log(`[confirm-extraction] Processing for extraction: ${extractionId}, role: ${confirmedRole}`);

    if (!extractionId) {
      throw new ValidationError("Missing extraction ID", {
        extraction_id: "Required",
      });
    }

    if (!["tenant", "landlord"].includes(confirmedRole)) {
      throw new ValidationError("Invalid role", {
        confirmed_role: "Must be 'tenant' or 'landlord'",
      });
    }

    // Create admin client
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize audit logger
    const audit = AuditLogger.fromRequest(
      adminClient,
      req,
      user.id,
      "confirm-extraction"
    );

    // ==============================================
    // FETCH EXTRACTED RENTAL INFO
    // ==============================================

    const { data: extractedInfo, error: fetchError } = await supabase
      .from("extracted_rental_info")
      .select("*")
      .eq("id", extractionId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !extractedInfo) {
      throw new NotFoundError("Extraction record", extractionId);
    }

    // Validate extraction is complete
    if (extractedInfo.extraction_status !== "completed") {
      throw new ValidationError("Extraction not complete", {
        extraction_status: `Current status: ${extractedInfo.extraction_status}`,
      });
    }

    // Check if already verified
    if (extractedInfo.user_verified) {
      throw new AppError(
        "Extraction already confirmed",
        "ALREADY_CONFIRMED",
        409
      );
    }

    // ==============================================
    // VALIDATE USER CORRECTIONS
    // ==============================================

    const validationErrors: Record<string, string> = {};
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (body.tenant_name !== undefined && body.tenant_name.trim() === "") {
      validationErrors.tenant_name = "Cannot be empty";
    }
    if (body.landlord_name !== undefined && body.landlord_name.trim() === "") {
      validationErrors.landlord_name = "Cannot be empty";
    }
    if (body.monthly_rent_paise !== undefined) {
      if (body.monthly_rent_paise <= 0 || body.monthly_rent_paise > 5000000000) {
        // 50,00,000 rupees = 5,000,000,000 paise
        validationErrors.monthly_rent_paise = "Must be > 0 and < 50,00,000 rupees (in paise)";
      }
    }
    if (body.lease_start_date !== undefined && body.lease_start_date !== "" && !dateRegex.test(body.lease_start_date)) {
      validationErrors.lease_start_date = "Must be YYYY-MM-DD format";
    }
    if (body.lease_end_date !== undefined && body.lease_end_date !== "" && !dateRegex.test(body.lease_end_date)) {
      validationErrors.lease_end_date = "Must be YYYY-MM-DD format";
    }

    if (Object.keys(validationErrors).length > 0) {
      console.log("[confirm-extraction] Validation failed:", JSON.stringify(validationErrors));
      throw new ValidationError("Invalid user corrections", validationErrors);
    }

    // ==============================================
    // UPDATE EXTRACTED INFO - MARK AS VERIFIED + USER CORRECTIONS
    // ==============================================
    // iOS sends user-corrected data that should update the extraction

    const updateData: Record<string, any> = {
      user_verified: true,
      verified_at: new Date().toISOString(),
    };

    // Apply user corrections from iOS if provided (already validated above)
    if (body.tenant_name && body.tenant_name.trim()) {
      updateData.tenant_name = body.tenant_name.trim();
      // Don't wipe tenant_names array — preserve all names from extraction.
    }
    if (body.landlord_name && body.landlord_name.trim()) {
      updateData.landlord_name = body.landlord_name.trim();
      // Don't wipe landlord_names array — it contains all names from extraction.
      // The singular landlord_name serves as the "primary" landlord for invite flow.
    }
    if (body.property_address) {
      updateData.property_address = body.property_address;
    }
    if (body.property_city) {
      updateData.property_city = body.property_city;
    }
    if (body.property_state) {
      updateData.property_state = body.property_state;
    }
    if (body.property_pincode) {
      updateData.property_pincode = body.property_pincode;
    }
    if (body.monthly_rent_paise) {
      updateData.monthly_rent_paise = body.monthly_rent_paise;
    }
    if (body.security_deposit_paise) {
      updateData.security_deposit_paise = body.security_deposit_paise;
    }
    if (body.rent_due_day) {
      updateData.rent_due_day = body.rent_due_day;
    }
    if (body.lease_start_date) {
      updateData.lease_start_date = body.lease_start_date;
    }
    if (body.lease_end_date) {
      updateData.lease_end_date = body.lease_end_date;
    }
    if (body.landlord_phone) {
      updateData.landlord_phone = body.landlord_phone;
    }
    if (body.landlord_email) {
      updateData.landlord_email = body.landlord_email;
    }

    console.log("[confirm-extraction] Updating extraction with:", JSON.stringify(updateData).substring(0, 500));

    const finalization = await finalizeExtractionForOnboarding({
      supabase: adminClient,
      userId: user.id,
      extractionId,
      confirmedRole,
      extractionUpdates: updateData,
      syncWaitlistFields: {
        extraction_status: "completed",
        contract_status: extractedInfo.contract_status ?? "user_review",
      },
      autoApproveDemo: true,
    });

    // ==============================================
    // AUDIT LOG
    // ==============================================

    await audit.logSuccess(
      "EXTRACTION_CONFIRMED",
      "extraction",
      "extracted_rental_info",
      extractionId,
      {
        confirmed_role: confirmedRole,
        tenancy_created: !!finalization.tenancyId,
        tenancy_id: finalization.tenancyId,
      }
    );

    if (finalization.autoApprovedDemo && finalization.waitlistEntryId) {
      await audit.logSuccess(
        "EXTRACTION_DEMO_AUTO_APPROVED",
        "extraction",
        "waitlist_entries",
        finalization.waitlistEntryId,
        { demo: true, tenancy_id: finalization.tenancyId }
      );
    }

    // ==============================================
    // RETURN V1-COMPATIBLE RESPONSE
    // ==============================================

    const response: ConfirmExtractionResponse = {
      success: true,
      waitlist_entry_id: extractionId, // V1 field name
      extraction_id: extractionId, // V2 field name
      user_id: user.id,
      confirmed_role: confirmedRole,
      contract_status: "confirmed",
      tenancy_id: finalization.tenancyId, // V2 addition
      // Nested data object for iOS compatibility
      data: finalization.tenancyId ? {
        tenancy_id: finalization.tenancyId,
        user_status: finalization.finalUserStatus,
      } : undefined,
    };

    return jsonResponse(response, 200, headers);
  } catch (error) {
    return handleError(error);
  }
});
