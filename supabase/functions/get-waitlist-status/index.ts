/**
 * Flent Secured v2 - Edge Function: get-waitlist-status
 *
 * V1 COMPATIBILITY: This function maintains the exact response format expected by the iOS app.
 * It reads from V2's extracted_rental_info table but returns data in V1's waitlist format.
 *
 * V2 IMPROVEMENTS USED:
 * - Typed error handling (AuthError, NotFoundError)
 * - Audit logging for compliance
 * - CORS with origin validation
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { handleCors, getCorsHeaders, jsonResponse } from "../_shared/cors.ts";
import { AuthError, handleError } from "../_shared/errors.ts";
import { AuditLogger } from "../_shared/audit.ts";

// ==============================================
// TYPES (V1 compatibility format)
// ==============================================

interface WaitlistStatusResponse {
  success: boolean;
  has_entry: boolean;
  // Polling fields (used by iOS app)
  contract_status?: string;
  extraction_status?: string;
  requires_manual_review?: boolean;
  manual_review_reason?: string | null;
  fields_extracted?: number;
  total_fields?: number;
  confidence_score?: number;
  waitlist_position?: number;
  admin_review?: string; // 'due' | 'in_progress' | 'rejected' | 'approved'
  // Full waitlist entry
  waitlist_entry?: {
    id: string;
    status: string;
    extraction_status: string;
    contract_status: string;
    requires_manual_review: boolean;
    manual_review_reason: string | null;
    waitlist_position: number | null;
    document_uploaded: boolean;
    admin_review: string;
    created_at: string;
  };
  extracted_info?: {
    property_name: string;
    monthly_rent: string;
    security_deposit: string;
    rent_duration: string;
    lease_end_date: string;
    tenants: string[];
    landlords: string[];
    confidence_score: number;
    certificate_no: string | null;
  };
  rewards?: {
    pending_total: number;
    credited_total: number;
  };
  error?: string;
}

// ==============================================
// HELPER FUNCTIONS
// ==============================================

function formatCurrency(amountPaise: number | null): string {
  if (!amountPaise) return "\u20B9 0";
  const rupees = Math.round(amountPaise / 100);
  return `\u20B9 ${rupees.toLocaleString("en-IN")}`;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "Not specified";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function mapExtractionStatusToContract(
  extractionStatus: string,
  userVerified: boolean
): string {
  switch (extractionStatus) {
    case "pending":
      return "not_uploaded";
    case "processing":
      return "processing";
    case "completed":
      return userVerified ? "confirmed" : "user_review";
    case "failed":
      return "processing_failed";
    case "manual_review":
      return "manual_review";
    default:
      return "not_uploaded";
  }
}

function calculateFieldsExtracted(data: Record<string, unknown>): number {
  const fields = [
    "landlord_name",
    "landlord_phone",
    "property_address",
    "property_city",
    "property_state",
    "property_pincode",
    "monthly_rent_paise",
    "security_deposit_paise",
    "lease_start_date",
    "lease_end_date",
    "rent_due_day",
    "tenant_name",
    "tenant_phone",
    "tenant_email",
  ];
  return fields.filter((f) => data[f] != null && data[f] !== "").length;
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

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthError("Unauthorized");
    }

    // Create service client for admin operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize audit logger (V2 improvement)
    const audit = AuditLogger.fromRequest(
      adminClient,
      req,
      user.id,
      "get-waitlist-status"
    );

    // ==============================================
    // QUERY V2's extracted_rental_info TABLE
    // ==============================================
    // V2 uses extracted_rental_info directly linked to user
    // We map this to V1's waitlist format

    const { data: extractedInfo, error: queryError } = await supabase
      .from("extracted_rental_info")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (queryError) {
      console.error("Query error:", queryError);
      throw queryError;
    }

    // No extraction record found - user hasn't uploaded a document yet
    if (!extractedInfo) {
      const response: WaitlistStatusResponse = {
        success: true,
        has_entry: false,
      };
      return jsonResponse(response, 200, headers);
    }

    // ==============================================
    // MAP V2 DATA TO V1 RESPONSE FORMAT
    // ==============================================

    const extractionStatus = extractedInfo.extraction_status || "pending";
    const userVerified = extractedInfo.user_verified || false;
    const confidenceScore = extractedInfo.extraction_confidence
      ? Math.round(extractedInfo.extraction_confidence * 100)
      : 0;
    const fieldsExtracted = calculateFieldsExtracted(extractedInfo);

    // Map to contract status (V1 field)
    const contractStatus = mapExtractionStatusToContract(
      extractionStatus,
      userVerified
    );

    // Determine admin review status
    const adminReviewStatus = userVerified
      ? "approved"
      : extractionStatus === "manual_review"
      ? "in_progress"
      : "due";

    // Build response in V1 format
    const response: WaitlistStatusResponse = {
      success: true,
      has_entry: true,

      // Polling fields at root level (iOS app checks these)
      contract_status: contractStatus,
      extraction_status: extractionStatus,
      requires_manual_review: extractionStatus === "manual_review",
      manual_review_reason: extractedInfo.extraction_error || null,
      fields_extracted: fieldsExtracted,
      total_fields: 14,
      confidence_score: confidenceScore,
      waitlist_position: 1000, // V2 doesn't track waitlist position, provide default
      admin_review: adminReviewStatus,

      // Full waitlist entry (V1 format)
      waitlist_entry: {
        id: extractedInfo.id,
        status: userVerified ? "approved" : "pending_review",
        extraction_status: extractionStatus,
        contract_status: contractStatus,
        requires_manual_review: extractionStatus === "manual_review",
        manual_review_reason: extractedInfo.extraction_error || null,
        waitlist_position: 1000,
        document_uploaded: !!extractedInfo.document_storage_path,
        admin_review: adminReviewStatus,
        created_at: extractedInfo.created_at,
      },

      // Rewards (V2 uses cashback_ledger, simplified here)
      rewards: {
        pending_total: 0,
        credited_total: 0,
      },
    };

    // Add extracted info if available
    if (extractionStatus === "completed" || extractionStatus === "manual_review") {
      // Get cashback balance from users table (V2 tracks it there)
      const { data: userData } = await supabase
        .from("users")
        .select("cashback_balance_paise")
        .eq("id", user.id)
        .single();

      response.extracted_info = {
        property_name: extractedInfo.property_address
          ? `${extractedInfo.property_city || "Unknown"} Property`
          : "Unknown Property",
        monthly_rent: formatCurrency(extractedInfo.monthly_rent_paise),
        security_deposit: formatCurrency(extractedInfo.security_deposit_paise),
        rent_duration: calculateRentDuration(
          extractedInfo.lease_start_date,
          extractedInfo.lease_end_date
        ),
        lease_end_date: formatDate(extractedInfo.lease_end_date),
        tenants: extractedInfo.tenant_name ? [extractedInfo.tenant_name] : [],
        landlords: extractedInfo.landlord_name
          ? [extractedInfo.landlord_name]
          : [],
        confidence_score: confidenceScore,
        certificate_no: null, // V2 doesn't track e-stamp separately
      };

      // Update rewards with actual cashback balance
      if (userData?.cashback_balance_paise) {
        response.rewards = {
          pending_total: 0,
          credited_total: userData.cashback_balance_paise,
        };
      }
    }

    // Log successful status check (V2 audit improvement)
    await audit.logSuccess(
      "WAITLIST_STATUS_CHECKED",
      "extraction",
      "extracted_rental_info",
      extractedInfo.id,
      { extraction_status: extractionStatus, user_verified: userVerified }
    );

    return jsonResponse(response, 200, headers);
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});

function calculateRentDuration(
  startDate: string | null,
  endDate: string | null
): string {
  if (!startDate || !endDate) return "11 Months"; // Default

  const start = new Date(startDate);
  const end = new Date(endDate);
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());

  return `${months} Months`;
}
