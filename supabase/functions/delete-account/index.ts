/**
 * Flent Secured v2 - Edge Function: delete-account
 *
 * V1 COMPATIBILITY: Required for App Store compliance (Guideline 5.1.1(v))
 * Archives user data before deletion for legal/compliance purposes.
 *
 * V2 IMPROVEMENTS:
 * - Archives V2 tables (tenancies, payments, bank_accounts) in addition to V1 tables
 * - Uses typed error handling
 * - Comprehensive audit logging
 * - Proper CORS handling
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { handleCors, getCorsHeaders, jsonResponse } from "../_shared/cors.ts";
import { AuthError, AppError, handleError } from "../_shared/errors.ts";
import { AuditLogger, AuditActions } from "../_shared/audit.ts";

// ==============================================
// TYPES
// ==============================================

interface DeleteAccountResponse {
  success: boolean;
  message: string;
  archived_at?: string;
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = (Deno.env.get("SB_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY"))!;
    const supabaseServiceKey = (Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;

    // Validate auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new AuthError("Missing authorization header");
    }

    // Create client with user's auth to verify their identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      throw new AuthError("Unauthorized");
    }

    const userId = user.id;
    console.log(`[delete-account] Starting deletion for user: ${userId}`);

    // Create admin client for deletion operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize audit logger
    const audit = AuditLogger.fromRequest(
      adminClient,
      req,
      userId,
      "delete-account"
    );

    // Parse optional reason from body
    let deletionReason = "user_requested";
    try {
      if (req.method === "POST") {
        const body = await req.json();
        deletionReason = body.reason || "user_requested";
      }
    } catch {
      // No body or invalid JSON - use default reason
    }

    // ==============================================
    // STEP 1: COLLECT ALL USER DATA FOR ARCHIVE
    // ==============================================

    console.log(`[${userId}] Collecting user data for archive...`);

    // V1 + V2 tables: users profile
    const { data: userData } = await adminClient
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    // V1: waitlist entries (via compatibility view)
    const { data: waitlistData } = await adminClient
      .from("waitlist_entries")
      .select("*")
      .eq("user_id", userId);

    // V2: extracted_rental_info
    const { data: extractedRentalInfoData } = await adminClient
      .from("extracted_rental_info")
      .select("*")
      .eq("user_id", userId);

    // V2: tenancies
    const { data: tenanciesData } = await adminClient
      .from("tenancies")
      .select("*")
      .eq("user_id", userId);

    // V2: payments (via tenancies)
    let paymentsData: unknown[] = [];
    if (tenanciesData && tenanciesData.length > 0) {
      const tenancyIds = tenanciesData.map((t) => t.id);
      const { data: payments } = await adminClient
        .from("payments")
        .select("*")
        .in("tenancy_id", tenancyIds);
      paymentsData = payments || [];
    }

    // V2: bank_accounts
    const { data: bankAccountsData } = await adminClient
      .from("bank_accounts")
      .select("*")
      .eq("user_id", userId);

    // V2: identity_verifications
    const { data: identityVerificationsData } = await adminClient
      .from("identity_verifications")
      .select("*")
      .eq("user_id", userId);

    // V2: cashback_ledger
    const { data: cashbackData } = await adminClient
      .from("cashback_ledger")
      .select("*")
      .eq("user_id", userId);

    // V2: device_tokens
    const { data: deviceTokensData } = await adminClient
      .from("device_tokens")
      .select("*")
      .eq("user_id", userId);

    // Auth metadata
    const authMetadata = {
      phone: user.phone,
      email: user.email,
      role: user.user_metadata?.role,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      user_metadata: user.user_metadata,
      app_metadata: user.app_metadata,
    };

    console.log(
      `[${userId}] Collected: user=${!!userData}, waitlist=${
        waitlistData?.length || 0
      }, extracted=${extractedRentalInfoData?.length || 0}, tenancies=${
        tenanciesData?.length || 0
      }, payments=${paymentsData.length}`
    );

    // ==============================================
    // STEP 2: ARCHIVE DATA
    // ==============================================

    console.log(`[${userId}] Archiving user data...`);
    const archivedAt = new Date().toISOString();

    const { error: archiveError } = await adminClient
      .from("deleted_users_archive")
      .upsert(
        {
          original_user_id: userId,
          deleted_at: archivedAt,
          user_data: userData || {},
          waitlist_data: waitlistData || [],
          extracted_rental_info_data: extractedRentalInfoData || [],
          rental_parties_data: [], // V2 stores parties in extracted_rental_info
          auth_metadata: authMetadata,
          deletion_reason: deletionReason,
          deletion_initiated_by: "user",
          // V2 additions
          tenancies_data: tenanciesData || [],
          payments_data: paymentsData,
          bank_accounts_data: bankAccountsData || [],
          identity_verifications_data: identityVerificationsData || [],
          cashback_data: cashbackData || [],
          device_tokens_data: deviceTokensData || [],
        },
        { onConflict: "original_user_id" }
      );

    if (archiveError) {
      console.error(`[${userId}] Error archiving data:`, archiveError);
      throw new AppError(
        `Failed to archive user data: ${archiveError.message}`,
        "ARCHIVE_ERROR",
        500
      );
    }

    console.log(`[${userId}] Data archived successfully`);

    // Log archive action
    await audit.logSuccess(
      "ACCOUNT_DATA_ARCHIVED",
      "security",
      "deleted_users_archive",
      userId,
      {
        tables_archived: [
          "users",
          "waitlist_entries",
          "extracted_rental_info",
          "tenancies",
          "payments",
          "bank_accounts",
        ],
      }
    );

    // ==============================================
    // STEP 3: DELETE FROM SOURCE TABLES
    // ==============================================
    // Order matters: delete dependent records first

    console.log(`[${userId}] Deleting from source tables...`);

    // 3a. Delete device_tokens
    await adminClient.from("device_tokens").delete().eq("user_id", userId);

    // 3b. Delete cashback_ledger
    await adminClient.from("cashback_ledger").delete().eq("user_id", userId);

    // 3c. Delete identity_verifications
    await adminClient
      .from("identity_verifications")
      .delete()
      .eq("user_id", userId);

    // 3d. Delete payments (via tenancies)
    if (tenanciesData && tenanciesData.length > 0) {
      const tenancyIds = tenanciesData.map((t) => t.id);
      await adminClient.from("payments").delete().in("tenancy_id", tenancyIds);
    }

    // 3d-2. Delete payments with no tenancy (e.g. card verification payments)
    await adminClient.from("payments").delete().is("tenancy_id", null).eq("user_id", userId);

    // 3e. Delete bank_accounts
    await adminClient.from("bank_accounts").delete().eq("user_id", userId);

    // 3f. Delete tenancies
    await adminClient.from("tenancies").delete().eq("user_id", userId);

    // 3g. Delete extracted_rental_info
    await adminClient
      .from("extracted_rental_info")
      .delete()
      .eq("user_id", userId);

    // 3h. Delete waitlist_entries (V1 compatibility table)
    await adminClient.from("waitlist_entries").delete().eq("user_id", userId);

    // 3i. Delete from public.users
    const { error: usersError } = await adminClient
      .from("users")
      .delete()
      .eq("id", userId);

    if (usersError) {
      console.error(`[${userId}] Error deleting from users:`, usersError);
      // Continue anyway - archive is saved
    }

    // ==============================================
    // STEP 4: DELETE AUTH USER
    // ==============================================

    console.log(`[${userId}] Deleting auth user...`);

    const { error: authDeleteError } =
      await adminClient.auth.admin.deleteUser(userId);

    if (authDeleteError) {
      console.error(`[${userId}] Error deleting auth user:`, authDeleteError);
      throw new AppError(
        `Failed to delete auth user: ${authDeleteError.message}`,
        "AUTH_DELETE_ERROR",
        500
      );
    }

    // Log successful deletion
    await audit.logSuccess("ACCOUNT_DELETED", "security", "user", userId, {
      deletion_reason: deletionReason,
    });

    console.log(`[${userId}] Account deletion completed successfully`);

    const response: DeleteAccountResponse = {
      success: true,
      message: "Your account has been deleted successfully.",
      archived_at: archivedAt,
    };

    return jsonResponse(response, 200, headers);
  } catch (error) {
    return handleError(error);
  }
});
