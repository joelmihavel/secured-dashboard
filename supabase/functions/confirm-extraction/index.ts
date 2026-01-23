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

// ==============================================
// TYPES
// ==============================================

interface ConfirmExtractionRequest {
  waitlist_entry_id?: string; // V1 format (actually extracted_rental_info_id)
  extracted_rental_info_id?: string; // V2 format
  confirmed_role: "tenant" | "landlord";
}

interface ConfirmExtractionResponse {
  success: boolean;
  waitlist_entry_id?: string;
  extraction_id?: string;
  user_id?: string;
  confirmed_role?: string;
  contract_status?: string;
  tenancy_id?: string; // V2: created tenancy
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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    // V1 uses waitlist_entry_id, V2 uses extracted_rental_info_id
    const extractionId =
      body.extracted_rental_info_id || body.waitlist_entry_id;
    const confirmedRole = body.confirmed_role;

    if (!extractionId) {
      throw new ValidationError("Missing extraction ID", {
        waitlist_entry_id: "Required",
      });
    }

    if (!confirmedRole || !["tenant", "landlord"].includes(confirmedRole)) {
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
    // UPDATE EXTRACTED INFO - MARK AS VERIFIED
    // ==============================================

    const { error: updateError } = await adminClient
      .from("extracted_rental_info")
      .update({
        user_verified: true,
        verified_at: new Date().toISOString(),
      })
      .eq("id", extractionId);

    if (updateError) {
      console.error("Failed to update extracted_rental_info:", updateError);
      throw new AppError(
        "Failed to confirm extraction",
        "UPDATE_ERROR",
        500
      );
    }

    // ==============================================
    // LOCK USER ROLE (V1 compatibility)
    // ==============================================

    const { error: roleError } = await adminClient
      .from("users")
      .update({
        role: confirmedRole,
        is_role_locked: true,
        role_locked_at: new Date().toISOString(),
        // V2: also update user_status to waitlisted
        user_status: "waitlisted",
        status_updated_at: new Date().toISOString(),
        // V2: mark as in KYC progress
        kyc_status: "in_progress",
      })
      .eq("id", user.id)
      .eq("is_role_locked", false); // Only update if not already locked

    if (roleError) {
      console.error("Failed to lock user role:", roleError);
      // Don't throw - extraction is confirmed, role lock is secondary
    }

    // ==============================================
    // CREATE TENANCY RECORD (V2 improvement)
    // ==============================================
    // V2 creates a tenancy from confirmed extraction data

    let tenancyId: string | undefined;

    if (confirmedRole === "tenant") {
      const { data: tenancy, error: tenancyError } = await adminClient
        .from("tenancies")
        .insert({
          user_id: user.id,
          extracted_rental_info_id: extractionId,
          status: "pending",
          // Copy key fields from extraction
          property_address: extractedInfo.property_address,
          property_city: extractedInfo.property_city,
          property_state: extractedInfo.property_state,
          property_pincode: extractedInfo.property_pincode,
          monthly_rent_paise: extractedInfo.monthly_rent_paise,
          security_deposit_paise: extractedInfo.security_deposit_paise,
          rent_due_day: extractedInfo.rent_due_day || 1,
          lease_start_date: extractedInfo.lease_start_date,
          lease_end_date: extractedInfo.lease_end_date,
          // Landlord info
          landlord_name: extractedInfo.landlord_name,
          landlord_phone: extractedInfo.landlord_phone,
          landlord_email: extractedInfo.landlord_email,
        })
        .select("id")
        .single();

      if (!tenancyError && tenancy) {
        tenancyId = tenancy.id;

        // Link extraction to tenancy
        await adminClient
          .from("extracted_rental_info")
          .update({ tenancy_id: tenancyId })
          .eq("id", extractionId);
      }
    }

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
        tenancy_created: !!tenancyId,
        tenancy_id: tenancyId,
      }
    );

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
      tenancy_id: tenancyId, // V2 addition
    };

    return jsonResponse(response, 200, headers);
  } catch (error) {
    return handleError(error);
  }
});
