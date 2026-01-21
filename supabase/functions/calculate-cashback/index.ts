/**
 * Flent Secured v2 - Calculate Cashback Edge Function
 *
 * Calculates cashback for a payment and manages the ledger.
 * Called after successful payments or for cashback queries.
 *
 * Endpoints:
 * - POST /functions/v1/calculate-cashback - Calculate for a payment
 * - GET /functions/v1/calculate-cashback?user_id=xxx - Get balance/history
 *
 * Auth: Service role (POST) or User JWT (GET)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  createServiceClient,
  createAuthenticatedClient,
  verifyServiceRole,
} from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { AppError, ValidationError, handleError } from "../_shared/errors.ts";
import { validateSchema } from "../_shared/validation.ts";
import { AuditLogger, AuditActions } from "../_shared/audit.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const CASHBACK_RATE = 0.01; // 1%
const CASHBACK_EXPIRY_DAYS = 90;
const MAX_CASHBACK_PER_PAYMENT = 10000_00; // Rs 10,000 in paise

// ==============================================
// TYPES
// ==============================================

interface CalculateCashbackRequest {
  payment_id: string;
  user_id: string;
  amount_paise: number;
  tenancy_id: string;
  rent_month: string;
}

interface CashbackHistory {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
  expires_at: string | null;
}

// ==============================================
// VALIDATION SCHEMA
// ==============================================

const requestSchema = {
  payment_id: { required: true, type: "string" as const },
  user_id: { required: true, type: "string" as const },
  amount_paise: { required: true, type: "number" as const, min: 100 },
  tenancy_id: { required: true, type: "string" as const },
  rent_month: { required: true, type: "string" as const },
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
    // GET - Fetch cashback balance and history
    if (req.method === "GET") {
      return await handleGetCashback(req, supabase);
    }

    // POST - Calculate and credit cashback
    if (req.method === "POST") {
      return await handleCalculateCashback(req, supabase);
    }

    return errorResponse("Method not allowed", 405);
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});

// ==============================================
// GET CASHBACK HANDLER
// ==============================================

async function handleGetCashback(
  req: Request,
  supabase: ReturnType<typeof createServiceClient>
): Promise<Response> {
  // Authenticate user
  const authHeader = req.headers.get("Authorization");
  const { userId } = await createAuthenticatedClient(authHeader);

  // Get available balance
  const { data: availableBalance } = await supabase.rpc("get_available_cashback", {
    p_user_id: userId,
  });

  // Get current balance (including pending)
  const { data: currentBalance } = await supabase.rpc("get_cashback_balance", {
    p_user_id: userId,
  });

  // Get history
  const { data: history } = await supabase
    .from("cashback_ledger")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  const formattedHistory: CashbackHistory[] = (history ?? []).map((entry) => ({
    id: entry.id,
    type: entry.transaction_type,
    amount: entry.amount_paise / 100,
    balance_after: entry.balance_after_paise / 100,
    description: entry.description,
    created_at: entry.created_at,
    expires_at: entry.expires_at,
  }));

  // Get expiring soon (next 30 days)
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const { data: expiringSoon } = await supabase
    .from("cashback_ledger")
    .select("amount_paise, expires_at")
    .eq("user_id", userId)
    .eq("transaction_type", "earned")
    .is("expired_at", null)
    .lt("expires_at", thirtyDaysFromNow.toISOString())
    .gt("expires_at", new Date().toISOString());

  const expiringAmount = (expiringSoon ?? []).reduce(
    (sum, entry) => sum + entry.amount_paise,
    0
  );

  return jsonResponse({
    success: true,
    data: {
      available_balance: (availableBalance ?? 0) / 100,
      current_balance: (currentBalance ?? 0) / 100,
      expiring_soon: {
        amount: expiringAmount / 100,
        within_days: 30,
      },
      history: formattedHistory,
    },
  });
}

// ==============================================
// CALCULATE CASHBACK HANDLER
// ==============================================

async function handleCalculateCashback(
  req: Request,
  supabase: ReturnType<typeof createServiceClient>
): Promise<Response> {
  // Verify service role authorization (strict equality check)
  const authHeader = req.headers.get("Authorization");
  verifyServiceRole(authHeader);

  const audit = new AuditLogger(supabase, {
    actorType: "system",
    functionName: "calculate-cashback",
    requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
  });

  // Parse and validate request
  const body = await req.json();
  const validatedBody = validateSchema<CalculateCashbackRequest>(
    body,
    requestSchema,
    true
  );

  const { payment_id, user_id, amount_paise, tenancy_id, rent_month } = validatedBody;

  // Check if cashback already credited for this payment
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

  // Calculate cashback amount
  let cashbackPaise = Math.floor(amount_paise * CASHBACK_RATE);
  cashbackPaise = Math.min(cashbackPaise, MAX_CASHBACK_PER_PAYMENT);

  if (cashbackPaise <= 0) {
    return jsonResponse({
      success: true,
      data: {
        cashback_amount: 0,
        message: "No cashback for this payment",
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
      cashback_amount: cashbackPaise / 100,
      new_balance: newBalance / 100,
      expires_at: expiresAt.toISOString(),
      ledger_entry_id: ledgerEntry.id,
    },
  });
}
