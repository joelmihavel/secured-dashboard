/**
 * Temporary debug function to inspect payment data.
 * DELETE after investigation.
 */
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const body = await req.json().catch(() => ({}));
  let userId = body.user_id;
  const phone = body.phone;

  const supabase = createServiceClient();

  // Look up user by phone if no user_id provided
  if (!userId && phone) {
    const { data: userRow } = await supabase
      .from("users")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();
    if (userRow) userId = userRow.id;
  }
  if (!userId) return errorResponse("user_id or phone required", 400);

  const [paymentsResult, tenancyResult, cashbackResult] = await Promise.all([
    supabase
      .from("payments")
      .select("id, created_at, rent_amount_paise, total_amount_paise, net_rent_paise, status, payment_month, paid_at, cashback_applied_paise, cashback_earned_paise, intended_cashback_paise, accumulated_redeemed_paise, flent_subsidy_paise, payment_method, payment_method_details, gateway_metadata, payu_txn_id, payu_mihpayid")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("tenancies")
      .select("id, status, bank_verified, utility_verified, landlord_approved, landlord_response, rent_due_day, cashback_cutoff_day, monthly_rent_paise, created_at")
      .eq("user_id", userId)
      .in("status", ["active", "pending_verification"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("cashback_ledger")
      .select("id, transaction_type, amount_paise, balance_after_paise, payment_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const { data: userProfile } = await supabase
    .from("users")
    .select("id, is_test_user, cashback_balance_paise, user_status")
    .eq("id", userId)
    .single();

  // Check landlord verification logs
  const tenancyId = tenancyResult.data?.id;
  const { data: verifyLogs } = tenancyId ? await supabase
    .from("landlord_verifications")
    .select("id, status, response, responded_at, created_at")
    .eq("tenancy_id", tenancyId)
    .order("created_at", { ascending: false })
    .limit(5) : { data: null };

  // Check user_status_changes or any table tracking verification
  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, title, body, notification_type, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  // Also check the tenancy updated_at via raw query
  const { data: tenancyFull } = tenancyId ? await supabase
    .from("tenancies")
    .select("updated_at, bank_verified, utility_verified, landlord_approved, landlord_response")
    .eq("id", tenancyId)
    .single() : { data: null };

  return jsonResponse({
    user: userProfile,
    payments: paymentsResult.data,
    tenancy: tenancyResult.data,
    tenancy_updated: tenancyFull,
    cashback_ledger: cashbackResult.data,
    landlord_verifications: verifyLogs,
    notifications,
  });
});
