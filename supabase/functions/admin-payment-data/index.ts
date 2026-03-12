/**
 * Admin Payment Data — returns payments with decrypted landlord bank details.
 * Service-role only. Called by Apps Script for the Payments sheet.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { verifyServiceRole } from "../_shared/supabase.ts";
import { handleCors, errorResponse } from "../_shared/cors.ts";
import { decrypt } from "../_shared/crypto.ts";

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    verifyServiceRole(authHeader);
  } catch {
    return errorResponse("Unauthorized", 401);
  }

  const supabase = createServiceClient();

  // Fetch all payments with tenancy + user info
  const { data: payments, error: pErr } = await supabase
    .from("payments")
    .select(`
      id, created_at, due_date, payment_month, status, payment_method,
      rent_amount_paise, pg_fee_paise, cashback_applied_paise, cashback_earned_paise,
      total_amount_paise, payu_txn_id, payu_mihpayid, paid_at,
      settlement_status, settled_at, user_id, tenancy_id
    `)
    .order("created_at", { ascending: false });

  if (pErr) {
    return errorResponse("Failed to fetch payments: " + pErr.message, 500);
  }

  // Collect unique user_ids to fetch bank accounts and user/tenancy info
  const userIds = [...new Set(payments.map((p: Record<string, unknown>) => p.user_id as string))];

  // Fetch users
  const { data: users } = await supabase
    .from("users")
    .select("id, phone, full_name, first_name, last_name, user_status")
    .in("id", userIds);
  const userMap = new Map((users || []).map((u: Record<string, unknown>) => [u.id, u]));

  // Fetch tenancies
  const tenancyIds = [...new Set(payments.map((p: Record<string, unknown>) => p.tenancy_id as string).filter(Boolean))];
  const { data: tenancies } = await supabase
    .from("tenancies")
    .select("id, property_address, property_city, landlord_name, monthly_rent_paise, user_id")
    .in("id", tenancyIds);
  const tenancyMap = new Map((tenancies || []).map((t: Record<string, unknown>) => [t.id, t]));

  // Fetch primary landlord bank accounts (one per user)
  const { data: bankAccounts } = await supabase
    .from("bank_accounts")
    .select("id, user_id, account_number_encrypted, account_number_masked, ifsc_code, verified_account_holder_name, verified")
    .eq("party_type", "landlord")
    .eq("is_primary", true)
    .in("user_id", userIds);

  // Decrypt account numbers and build map
  const bankMap = new Map<string, Record<string, unknown>>();
  for (const ba of (bankAccounts || []) as Record<string, unknown>[]) {
    let accountNumber = ba.account_number_masked as string || "";
    try {
      if (ba.account_number_encrypted && ba.account_number_encrypted !== "PENDING_PENNY_DROP") {
        accountNumber = await decrypt(ba.account_number_encrypted as string);
      }
    } catch {
      // Keep masked version on decrypt failure
    }
    bankMap.set(ba.user_id as string, {
      ...ba,
      account_number: accountNumber,
    });
  }

  // Assemble response
  const result = payments.map((p: Record<string, unknown>) => {
    const user = userMap.get(p.user_id) as Record<string, unknown> | undefined;
    const tenancy = tenancyMap.get(p.tenancy_id) as Record<string, unknown> | undefined;
    const bank = bankMap.get(p.user_id as string);

    return {
      // Payment
      payment_id: p.id,
      initiated_at: p.created_at,
      due_date: p.due_date,
      payment_month: p.payment_month,
      payment_status: p.status,
      payment_method: p.payment_method,
      rent_amount_paise: p.rent_amount_paise,
      total_amount_paise: p.total_amount_paise,
      cashback_applied_paise: p.cashback_applied_paise,
      cashback_earned_paise: p.cashback_earned_paise,
      pg_fee_paise: p.pg_fee_paise,
      payu_txn_id: p.payu_txn_id,
      payu_mihpayid: p.payu_mihpayid,
      paid_at: p.paid_at,
      settlement_status: p.settlement_status,
      settled_at: p.settled_at,
      // User
      user_phone: user?.phone ?? "",
      user_name: user?.full_name || [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "",
      user_status: user?.user_status ?? "",
      // Tenancy
      property_address: tenancy?.property_address ?? "",
      property_city: tenancy?.property_city ?? "",
      landlord_name: tenancy?.landlord_name ?? "",
      tenancy_rent_paise: tenancy?.monthly_rent_paise ?? 0,
      // Bank (decrypted)
      ll_bank_account: bank?.account_number ?? "",
      ll_bank_ifsc: bank?.ifsc_code ?? "",
      ll_bank_holder: bank?.verified_account_holder_name ?? "",
      ll_bank_verified: bank?.verified ?? false,
    };
  });

  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" },
  });
});
