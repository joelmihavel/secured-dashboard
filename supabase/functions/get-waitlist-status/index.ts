/**
 * Flent Secured v2 - Edge Function: get-waitlist-status
 *
 * Returns the user's waitlist status by combining data from:
 * - waitlist_entries: position, admin review, rejection reasons
 * - extracted_rental_info: agreement extraction details
 * - cashback_ledger / users: reward balances
 *
 * V1 COMPATIBILITY: Maintains the response format expected by the iOS app.
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
  user_status?: string; // Master journey state from users table
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
    rejection_reasons: string[];
    next_application_at: string | null;
    created_at: string;
    has_invite_code: boolean;
    batch_number: number | null;
    risk_level: string;
    risk_factors: unknown[];
    risk_computed_at: string | null;
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
  onboarded_count?: number;
  total_member_slots?: number;
  // Dynamic config from app_config table
  review_timeline?: {
    hours: number;
    display_text: string;
  };
  batch_config?: {
    current_batch: number;
    batch_size: number;
    batch_launch_date: string | null;
    rejection_cooldown_days: number;
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

// Total member slots (configurable via env or default)
const TOTAL_MEMBER_SLOTS = parseInt(Deno.env.get("WAITLIST_TOTAL_SLOTS") || "150", 10);

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

    // Initialize audit logger
    const audit = AuditLogger.fromRequest(
      adminClient,
      req,
      user.id,
      "get-waitlist-status"
    );

    // ==============================================
    // QUERY WAITLIST ENTRY
    // ==============================================

    const { data: waitlistEntry, error: waitlistError } = await adminClient
      .from("waitlist_entries")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (waitlistError) {
      console.error("Waitlist query error:", waitlistError);
      // Don't throw — fall back to no entry
    }

    // Query user_status from users table (master journey state)
    const { data: userRecord } = await adminClient
      .from("users")
      .select("user_status")
      .eq("id", user.id)
      .single();

    const userStatus = (userRecord?.user_status as string) ?? "signed_up";

    // ==============================================
    // GET ONBOARDED COUNT + DYNAMIC CONFIG (needed for ALL paths)
    // Moved above no-entry check so the response always includes batch data.
    // ==============================================

    let onboardedCount = 0;
    const { data: onboardedResult, error: onboardedError } = await adminClient
      .rpc("get_onboarded_count");

    if (onboardedError) {
      console.error("[get-waitlist-status] RPC get_onboarded_count failed:", onboardedError);
      // Fallback: query directly
      const { count } = await adminClient
        .from("waitlist_entries")
        .select("*", { count: "exact", head: true })
        .eq("admin_review", "approved");
      onboardedCount = count ?? 0;
    } else {
      onboardedCount = (onboardedResult as number) ?? 0;
    }

    let reviewTimeline: { hours: number; display_text: string } | undefined;
    let batchConfig: {
      current_batch: number;
      batch_size: number;
      batch_launch_date: string | null;
      rejection_cooldown_days: number;
    } | undefined;

    const { data: configRows } = await adminClient
      .from("app_config")
      .select("key, value")
      .in("key", ["review_timeline", "batch_config"]);

    if (configRows) {
      for (const row of configRows) {
        if (row.key === "review_timeline") {
          reviewTimeline = row.value as typeof reviewTimeline;
        } else if (row.key === "batch_config") {
          batchConfig = row.value as typeof batchConfig;
        }
      }
    }

    // No waitlist entry — user hasn't been assigned a position yet
    if (!waitlistEntry) {
      const response: WaitlistStatusResponse = {
        success: true,
        has_entry: false,
        user_status: userStatus,
        onboarded_count: onboardedCount,
        total_member_slots: batchConfig?.batch_size ?? TOTAL_MEMBER_SLOTS,
        review_timeline: reviewTimeline,
        batch_config: batchConfig,
      };
      return jsonResponse(response, 200, headers);
    }

    // ==============================================
    // QUERY EXTRACTED RENTAL INFO (if linked)
    // ==============================================

    let extractedInfo: Record<string, unknown> | null = null;

    if (waitlistEntry.extraction_id) {
      const { data: extraction } = await adminClient
        .from("extracted_rental_info")
        .select("*")
        .eq("id", waitlistEntry.extraction_id)
        .single();
      extractedInfo = extraction;
    } else {
      // Fall back: find latest extraction for this user
      const { data: extraction } = await adminClient
        .from("extracted_rental_info")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      extractedInfo = extraction;
    }

    // ==============================================
    // BUILD RESPONSE
    // ==============================================

    const extractionStatus = (extractedInfo?.extraction_status as string) || "pending";
    const userVerified = (extractedInfo?.user_verified as boolean) || false;
    const confidenceScore = extractedInfo?.extraction_confidence
      ? Math.round((extractedInfo.extraction_confidence as number) * 100)
      : 0;
    const fieldsExtracted = extractedInfo ? calculateFieldsExtracted(extractedInfo) : 0;
    const contractStatus = mapExtractionStatusToContract(extractionStatus, userVerified);

    // Admin review comes from waitlist_entries (authoritative)
    const adminReview = waitlistEntry.admin_review as string;

    // Determine user-facing status from admin_review
    let entryStatus = "pending_review";
    if (adminReview === "approved") {
      entryStatus = "approved";
    } else if (adminReview === "rejected") {
      entryStatus = "rejected";
    } else if (adminReview === "in_progress") {
      entryStatus = "in_review";
    }

    const response: WaitlistStatusResponse = {
      success: true,
      has_entry: true,
      user_status: userStatus,

      // Polling fields at root level
      contract_status: contractStatus,
      extraction_status: extractionStatus,
      requires_manual_review: extractionStatus === "manual_review",
      manual_review_reason: (extractedInfo?.extraction_error as string) || null,
      fields_extracted: fieldsExtracted,
      total_fields: 14,
      confidence_score: confidenceScore,
      waitlist_position: waitlistEntry.waitlist_position,
      admin_review: adminReview,

      // Full waitlist entry
      waitlist_entry: {
        id: waitlistEntry.id,
        status: entryStatus,
        extraction_status: extractionStatus,
        contract_status: contractStatus,
        requires_manual_review: extractionStatus === "manual_review",
        manual_review_reason: (extractedInfo?.extraction_error as string) || null,
        waitlist_position: waitlistEntry.waitlist_position,
        document_uploaded: !!(extractedInfo?.document_storage_path),
        admin_review: adminReview,
        rejection_reasons: waitlistEntry.rejection_reasons || [],
        next_application_at: waitlistEntry.next_application_at,
        created_at: waitlistEntry.created_at,
        has_invite_code: !!waitlistEntry.invite_code_id,
        batch_number: waitlistEntry.batch_number ?? null,
        risk_level: waitlistEntry.risk_level ?? "PENDING",
        risk_factors: waitlistEntry.risk_factors ?? [],
        risk_computed_at: waitlistEntry.risk_computed_at ?? null,
      },

      // Counts
      onboarded_count: onboardedCount,
      total_member_slots: batchConfig?.batch_size ?? TOTAL_MEMBER_SLOTS,

      // Dynamic config
      review_timeline: reviewTimeline,
      batch_config: batchConfig,

      // Rewards placeholder
      rewards: {
        pending_total: 0,
        credited_total: 0,
      },
    };

    // Add extracted info if available
    if (
      extractedInfo &&
      (extractionStatus === "completed" || extractionStatus === "manual_review")
    ) {
      // Get cashback balance
      const { data: userData } = await supabase
        .from("users")
        .select("cashback_balance_paise")
        .eq("id", user.id)
        .single();

      response.extracted_info = {
        property_name: extractedInfo.property_address
          ? `${(extractedInfo.property_city as string) || "Unknown"} Property`
          : "Unknown Property",
        monthly_rent: formatCurrency(extractedInfo.monthly_rent_paise as number | null),
        security_deposit: formatCurrency(
          extractedInfo.security_deposit_paise as number | null
        ),
        rent_duration: calculateRentDuration(
          extractedInfo.lease_start_date as string | null,
          extractedInfo.lease_end_date as string | null
        ),
        lease_end_date: formatDate(extractedInfo.lease_end_date as string | null),
        tenants: extractedInfo.tenant_name
          ? [extractedInfo.tenant_name as string]
          : [],
        landlords: extractedInfo.landlord_name
          ? [extractedInfo.landlord_name as string]
          : [],
        confidence_score: confidenceScore,
        certificate_no: null,
      };

      if (userData?.cashback_balance_paise) {
        response.rewards = {
          pending_total: 0,
          credited_total: userData.cashback_balance_paise,
        };
      }
    }

    // Log successful status check
    await audit.logSuccess(
      "WAITLIST_STATUS_CHECKED",
      "waitlist",
      "waitlist_entries",
      waitlistEntry.id,
      {
        position: waitlistEntry.waitlist_position,
        admin_review: adminReview,
        extraction_status: extractionStatus,
      }
    );

    return jsonResponse(response, 200, headers);
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
