/**
 * Flent Secured v2 - Calculate Cashback Edge Function (BE-083)
 *
 * Calculates cashback for a payment, manages the cashback ledger,
 * and supports cashback redemption (deduct from available balance).
 *
 * Endpoints:
 * - GET  /functions/v1/calculate-cashback - Get cashback summary (balance, history, expiring)
 * - POST /functions/v1/calculate-cashback - Calculate/credit cashback for a payment
 *                                           OR redeem cashback
 *
 * Auth: Service role (POST credit) or User JWT (GET, POST redeem)
 *
 * POST body (credit - service role):
 * {
 *   action: "credit",
 *   payment_id: string,
 *   user_id: string,
 *   amount_paise: number,
 *   tenancy_id: string,
 *   rent_month: string
 * }
 *
 * POST body (redeem - user JWT):
 * {
 *   action: "redeem",
 *   amount_paise: number,
 *   tenancy_id: string,
 *   payment_id?: string
 * }
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  createServiceClient,
  createAuthenticatedClient,
  verifyServiceRole,
  hasServiceRoleAuth,
} from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { AppError, ValidationError, handleError } from "../_shared/errors.ts";
import { validateSchema, isValidUuid } from "../_shared/validation.ts";
import { AuditLogger, AuditActions } from "../_shared/audit.ts";
// ==============================================
// CONFIGURATION
// ==============================================

const CASHBACK_RATE = 0.01; // 1%
const CASHBACK_EXPIRY_DAYS = 90;
const MIN_REDEEM_PAISE = 100; // Rs 1 minimum redemption

// ==============================================
// TYPES
// ==============================================

interface CreditCashbackRequest {
  action: "credit";
  payment_id: string;
  user_id: string;
  amount_paise: number;
  tenancy_id: string;
  rent_month: string;
}

interface RedeemCashbackRequest {
  action: "redeem";
  amount_paise: number;
  tenancy_id: string;
  payment_id?: string;
}

// ==============================================
// VALIDATION SCHEMAS
// ==============================================

const creditSchema = {
  action: { required: true, type: "string" as const, enum: ["credit"] as unknown[] },
  payment_id: { required: true, type: "string" as const },
  user_id: { required: true, type: "string" as const },
  amount_paise: { required: true, type: "number" as const, min: 100 },
  tenancy_id: { required: true, type: "string" as const },
  rent_month: { required: true, type: "string" as const },
};

const redeemSchema = {
  action: { required: true, type: "string" as const, enum: ["redeem"] as unknown[] },
  amount_paise: { required: true, type: "number" as const, min: MIN_REDEEM_PAISE },
  tenancy_id: {
    required: true,
    type: "string" as const,
    custom: (v: unknown) => isValidUuid(v) || "Invalid tenancy ID",
  },
  payment_id: { required: false, type: "string" as const },
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
    // GET - Fetch cashback summary
    if (req.method === "GET") {
      return await handleGetCashbackSummary(req, supabase);
    }

    // POST - Credit or Redeem cashback
    if (req.method === "POST") {
      const body = await req.json();
      const action = body?.action;

      if (action === "credit") {
        return await handleCreditCashback(req, body, supabase);
      } else if (action === "redeem") {
        return await handleRedeemCashback(req, body, supabase);
      } else {
        // Legacy: if no action field, assume credit (backward compat)
        return await handleCreditCashback(req, { ...body, action: "credit" }, supabase);
      }
    }

    return errorResponse("Method not allowed", 405);
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});

// ==============================================
// GET CASHBACK SUMMARY
// ==============================================

async function handleGetCashbackSummary(
  req: Request,
  supabase: ReturnType<typeof createServiceClient>
): Promise<Response> {
  // Authenticate user
  const authHeader = req.headers.get("Authorization");
  const { userId } = await createAuthenticatedClient(authHeader);

  // Run queries in parallel for performance
  const [
    availableBalanceResult,
    currentBalanceResult,
    historyResult,
    expiringSoonResult,
    statsResult,
  ] = await Promise.all([
    // Available (non-expired) balance
    supabase.rpc("get_available_cashback", { p_user_id: userId }),
    // Current running balance
    supabase.rpc("get_cashback_balance", { p_user_id: userId }),
    // Recent history
    supabase
      .from("cashback_ledger")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    // Expiring within 30 days
    (() => {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      return supabase
        .from("cashback_ledger")
        .select("amount_paise, expires_at")
        .eq("user_id", userId)
        .eq("transaction_type", "earned")
        .is("expired_at", null)
        .lt("expires_at", thirtyDaysFromNow.toISOString())
        .gt("expires_at", new Date().toISOString());
    })(),
    // Lifetime stats
    supabase
      .from("cashback_ledger")
      .select("transaction_type, amount_paise")
      .eq("user_id", userId),
  ]);

  const availableBalance = availableBalanceResult.data ?? 0;
  const currentBalance = currentBalanceResult.data ?? 0;
  const history = historyResult.data ?? [];
  const expiringSoon = expiringSoonResult.data ?? [];
  const stats = statsResult.data ?? [];

  // Calculate stats
  let totalEarned = 0;
  let totalRedeemed = 0;
  let totalExpired = 0;

  for (const entry of stats) {
    switch (entry.transaction_type) {
      case "earned":
      case "bonus":
        totalEarned += entry.amount_paise;
        break;
      case "applied":
        totalRedeemed += entry.amount_paise;
        break;
      case "expired":
        totalExpired += entry.amount_paise;
        break;
    }
  }

  const expiringAmount = expiringSoon.reduce(
    (sum: number, entry: any) => sum + entry.amount_paise,
    0
  );

  // Format history entries
  const formattedHistory = history.map((entry: any) => ({
    id: entry.id,
    transaction_type: entry.transaction_type,
    amount_paise: entry.amount_paise,
    amount: entry.amount_paise / 100,
    balance_after_paise: entry.balance_after_paise,
    balance_after: entry.balance_after_paise / 100,
    description: entry.description,
    payment_id: entry.payment_id,
    tenancy_id: entry.tenancy_id,
    expires_at: entry.expires_at,
    created_at: entry.created_at,
  }));

  return jsonResponse({
    success: true,
    data: {
      // Summary in paise (for precise calculations)
      total_earned_paise: totalEarned,
      available_balance_paise: availableBalance,
      total_redeemed_paise: totalRedeemed,
      total_expired_paise: totalExpired,
      // Summary in rupees (for display)
      total_earned: totalEarned / 100,
      available_balance: availableBalance / 100,
      total_redeemed: totalRedeemed / 100,
      total_expired: totalExpired / 100,
      current_balance: currentBalance / 100,
      // Expiring soon
      expiring_soon: {
        amount_paise: expiringAmount,
        amount: expiringAmount / 100,
        within_days: 30,
        entries_count: expiringSoon.length,
      },
      // History
      history: formattedHistory,
    },
  });
}

// ==============================================
// CREDIT CASHBACK
// ==============================================

async function handleCreditCashback(
  req: Request,
  body: unknown,
  supabase: ReturnType<typeof createServiceClient>
): Promise<Response> {
  // Verify service role authorization
  const authHeader = req.headers.get("Authorization");
  verifyServiceRole(authHeader);

  const audit = new AuditLogger(supabase, {
    actorType: "system",
    functionName: "calculate-cashback",
    requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
  });

  // Validate request
  const validated = validateSchema<CreditCashbackRequest>(body, creditSchema, true);
  const { payment_id, user_id, amount_paise, tenancy_id, rent_month } = validated;

  // Check if cashback already credited for this payment (idempotent)
  const { data: existing } = await supabase
    .from("cashback_ledger")
    .select("id")
    .eq("payment_id", payment_id)
    .eq("transaction_type", "earned")
    .maybeSingle();

  if (existing) {
    return jsonResponse({
      success: true,
      data: {
        already_credited: true,
        ledger_entry_id: existing.id,
      },
    });
  }

  // Fetch tenancy to get monthly_rent_paise for dynamic cap
  const { data: tenancy } = await supabase
    .from("tenancies")
    .select("monthly_rent_paise")
    .eq("id", tenancy_id)
    .single();

  const monthlyRentPaise = tenancy?.monthly_rent_paise ?? 0;

  // Dynamic monthly cap = 1% of agreement rent
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const monthlyCap = Math.floor(monthlyRentPaise * CASHBACK_RATE);

  // How much already earned this month
  const { data: monthlyEarnings } = await supabase
    .from('cashback_ledger')
    .select('amount_paise')
    .eq('user_id', user_id)
    .eq('transaction_type', 'earned')
    .gte('created_at', startOfMonth.toISOString())
    .lte('created_at', endOfMonth.toISOString());

  const earnedThisMonth = (monthlyEarnings || []).reduce((sum: number, e: { amount_paise: number }) => sum + e.amount_paise, 0);
  const capRemaining = Math.max(0, monthlyCap - earnedThisMonth);

  // Calculate cashback: 1% of payment amount, capped by remaining monthly allowance
  let cashbackPaise = Math.min(Math.floor(amount_paise * CASHBACK_RATE), capRemaining);

  if (cashbackPaise <= 0) {
    return jsonResponse({
      success: true,
      data: {
        cashback_amount_paise: 0,
        cashback_amount: 0,
        message: "No cashback for this payment (monthly cap reached)",
      },
    });
  }

  // Get current balance
  const { data: currentBalance } = await supabase.rpc("get_cashback_balance", {
    p_user_id: user_id,
  });

  const newBalance = (currentBalance ?? 0) + cashbackPaise;

  // Calculate expiry date
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + CASHBACK_EXPIRY_DAYS);

  // Create ledger entry
  const { data: ledgerEntry, error: insertError } = await supabase
    .from("cashback_ledger")
    .insert({
      user_id,
      transaction_type: "earned",
      amount_paise: cashbackPaise,
      balance_after_paise: newBalance,
      payment_id,
      tenancy_id,
      description: `1% cashback earned on rent payment for ${rent_month}`,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    console.error("Failed to create cashback entry:", insertError);
    throw new AppError("Failed to credit cashback", "DB_ERROR", 500);
  }

  // Update payment record with cashback earned
  await supabase
    .from("payments")
    .update({ cashback_earned_paise: cashbackPaise })
    .eq("id", payment_id);

  // Log audit
  await audit.logSuccess(AuditActions.CASHBACK_EARNED, "cashback", "cashback_ledger", ledgerEntry.id, {
    amount_paise: cashbackPaise,
    payment_id,
    rent_month,
    expires_at: expiresAt.toISOString(),
  });

  return jsonResponse({
    success: true,
    data: {
      cashback_amount_paise: cashbackPaise,
      cashback_amount: cashbackPaise / 100,
      new_balance_paise: newBalance,
      new_balance: newBalance / 100,
      expires_at: expiresAt.toISOString(),
      ledger_entry_id: ledgerEntry.id,
      rate: `${CASHBACK_RATE * 100}%`,
    },
  });
}

// ==============================================
// REDEEM CASHBACK
// ==============================================

async function handleRedeemCashback(
  req: Request,
  body: unknown,
  supabase: ReturnType<typeof createServiceClient>
): Promise<Response> {
  // Authenticate user
  const authHeader = req.headers.get("Authorization");
  const { userId } = await createAuthenticatedClient(authHeader);

  const audit = AuditLogger.fromRequest(supabase, req, userId, "calculate-cashback");

  // Validate request
  const validated = validateSchema<RedeemCashbackRequest>(body, redeemSchema, true);
  const { amount_paise, tenancy_id, payment_id } = validated;

  // Verify tenancy ownership and verification status
  const { data: tenancy, error: tenancyError } = await supabase
    .from("tenancies")
    .select("id, user_id, status, bank_verified, utility_verified, landlord_approved")
    .eq("id", tenancy_id)
    .eq("user_id", userId)
    .single();

  if (tenancyError || !tenancy) {
    throw new NotFoundError("Tenancy", tenancy_id);
  }

  // Verification gate — all verifications must be complete before redeeming
  if (!tenancy.bank_verified || !tenancy.utility_verified || !tenancy.landlord_approved) {
    return jsonResponse(
      {
        error: "VERIFICATION_INCOMPLETE",
        message: "Complete all verifications before redeeming cashback",
      },
      403
    );
  }

  // Check available balance
  const { data: availableBalance } = await supabase.rpc("get_available_cashback", {
    p_user_id: userId,
  });

  const available = availableBalance ?? 0;

  if (amount_paise > available) {
    throw new AppError(
      `Insufficient cashback balance. Available: Rs ${(available / 100).toFixed(2)}, Requested: Rs ${(amount_paise / 100).toFixed(2)}`,
      "INSUFFICIENT_BALANCE",
      400
    );
  }

  // Get current running balance
  const { data: currentBalance } = await supabase.rpc("get_cashback_balance", {
    p_user_id: userId,
  });

  const newBalance = (currentBalance ?? 0) - amount_paise;

  // Create redemption ledger entry
  const { data: ledgerEntry, error: insertError } = await supabase
    .from("cashback_ledger")
    .insert({
      user_id: userId,
      transaction_type: "applied",
      amount_paise,
      balance_after_paise: newBalance,
      payment_id: payment_id ?? null,
      tenancy_id,
      description: payment_id
        ? `Cashback redeemed against payment`
        : `Cashback redeemed`,
    })
    .select()
    .single();

  if (insertError) {
    console.error("Failed to create redemption entry:", insertError);
    throw new AppError("Failed to redeem cashback", "DB_ERROR", 500);
  }

  // If linked to a payment, update the payment's cashback_applied
  if (payment_id) {
    const { data: payment } = await supabase
      .from("payments")
      .select("cashback_applied_paise")
      .eq("id", payment_id)
      .eq("user_id", userId)
      .single();

    if (payment) {
      await supabase
        .from("payments")
        .update({
          cashback_applied_paise: (payment.cashback_applied_paise ?? 0) + amount_paise,
        })
        .eq("id", payment_id);
    }
  }

  await audit.logSuccess(AuditActions.CASHBACK_APPLIED, "cashback", "cashback_ledger", ledgerEntry.id, {
    amount_paise,
    payment_id,
    tenancy_id,
    previous_balance: currentBalance,
    new_balance: newBalance,
  });

  return jsonResponse({
    success: true,
    data: {
      redeemed_amount_paise: amount_paise,
      redeemed_amount: amount_paise / 100,
      new_balance_paise: newBalance,
      new_balance: newBalance / 100,
      ledger_entry_id: ledgerEntry.id,
    },
  });
}

// ==============================================
// MISSING IMPORT - NotFoundError
// ==============================================

class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with id ${id} not found` : `${resource} not found`,
      "NOT_FOUND",
      404
    );
  }
}

