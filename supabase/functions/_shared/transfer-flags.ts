/**
 * Flent Secured v2 - Transfer Feature Flags
 *
 * Two-layer flag system for controlling landlord transfers:
 * 1. System-level: app_config row 'landlord_transfers' — pause ALL transfers globally
 * 2. Transaction-level: payments.transfer_hold column — hold a specific payment
 *
 * Precedence: System disabled → held. System enabled + txn held → held. Both clear → proceed.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

// ==============================================
// TYPES
// ==============================================

export interface SystemTransferFlag {
  enabled: boolean;
  disabled_at: string | null;
  disabled_by: string | null;
  reason: string | null;
}

export interface TransferEligibility {
  allowed: boolean;
  reason: string | null;
  system_enabled: boolean;
  transaction_held: boolean;
}

// ==============================================
// SYSTEM-LEVEL FLAG
// ==============================================

/**
 * Reads the system-level transfer flag from app_config.
 * Defaults to { enabled: true } if the row is missing.
 */
export async function getSystemTransferFlag(
  supabase: SupabaseClient,
): Promise<SystemTransferFlag> {
  const { data, error } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "landlord_transfers")
    .single();

  if (error || !data) {
    // Default to enabled if row missing — fail-open for existing flow
    return { enabled: true, disabled_at: null, disabled_by: null, reason: null };
  }

  const value = data.value as Record<string, unknown>;
  return {
    enabled: value.enabled !== false,
    disabled_at: (value.disabled_at as string) ?? null,
    disabled_by: (value.disabled_by as string) ?? null,
    reason: (value.reason as string) ?? null,
  };
}

/**
 * Shorthand: returns true if system-level transfers are enabled.
 */
export async function isSystemTransferEnabled(
  supabase: SupabaseClient,
): Promise<boolean> {
  const flag = await getSystemTransferFlag(supabase);
  return flag.enabled;
}

// ==============================================
// COMBINED ELIGIBILITY CHECK
// ==============================================

/**
 * Checks whether a specific payment is eligible for landlord transfer.
 * Combines system-level flag + transaction-level hold.
 *
 * @param supabase - Service client
 * @param paymentId - Payment UUID to check
 * @param cachedConfig - Optional pre-fetched system config (avoids extra DB read in loops)
 */
export async function checkTransferEligibility(
  supabase: SupabaseClient,
  paymentId: string,
  cachedConfig?: SystemTransferFlag,
): Promise<TransferEligibility> {
  // Get system flag (use cache if provided)
  const systemFlag = cachedConfig ?? await getSystemTransferFlag(supabase);

  // Get transaction-level hold
  const { data: payment } = await supabase
    .from("payments")
    .select("transfer_hold, transfer_hold_reason")
    .eq("id", paymentId)
    .single();

  const transactionHeld = payment?.transfer_hold === true;

  // Precedence logic
  if (!systemFlag.enabled) {
    return {
      allowed: false,
      reason: systemFlag.reason ?? "System transfers disabled",
      system_enabled: false,
      transaction_held: transactionHeld,
    };
  }

  if (transactionHeld) {
    return {
      allowed: false,
      reason: payment?.transfer_hold_reason ?? "Payment held",
      system_enabled: true,
      transaction_held: true,
    };
  }

  return {
    allowed: true,
    reason: null,
    system_enabled: true,
    transaction_held: false,
  };
}
