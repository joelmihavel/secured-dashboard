/**
 * Flent Secured v2 - Payment Gateway Router
 *
 * Feature flag and gradual rollout router for switching between
 * PayU and Cashfree payment gateways.
 *
 * Priority order:
 * 1. Environment override (FORCE_PAYMENT_GATEWAY) - kill switch
 * 2. Per-user override from app_config table
 * 3. Percentage-based rollout with deterministic bucketing
 * 4. Default gateway from app_config table
 * 5. Fallback to 'payu'
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

// ==============================================
// TYPES
// ==============================================

export type PaymentGateway = "payu" | "cashfree";

/** Result from gateway resolution with metadata about why this gateway was chosen. */
export interface GatewayResolution {
  gateway: PaymentGateway;
  reason: "env_override" | "user_override" | "rollout_bucket" | "default_config" | "fallback";
}

// ==============================================
// GATEWAY ROUTER
// ==============================================

/**
 * Determines which payment gateway to use for a given user.
 *
 * Resolution priority:
 * 1. `FORCE_PAYMENT_GATEWAY` env var -- global kill switch for incidents
 * 2. Per-user override in `app_config` (key: `payment_gateway_user_{userId}`)
 * 3. Percentage rollout via deterministic user bucketing
 * 4. Default gateway in `app_config` (key: `payment_gateway_default`)
 * 5. Fallback: `payu`
 *
 * The percentage rollout uses SHA-256 hashing of the userId for deterministic
 * bucketing, so a given user always lands in the same bucket regardless of
 * when or how often this function is called.
 *
 * @param supabase - Supabase client (service role recommended for reading app_config)
 * @param userId - The authenticated user's UUID
 * @returns The payment gateway to use
 */
export async function getGatewayForUser(
  supabase: SupabaseClient,
  userId: string,
  preferredGateway?: PaymentGateway
): Promise<PaymentGateway> {
  const resolution = await resolveGateway(supabase, userId, preferredGateway);

  console.log(
    `[gateway-router] user=${userId} gateway=${resolution.gateway} reason=${resolution.reason}`
  );

  return resolution.gateway;
}

/**
 * Resolves the gateway with full metadata about the resolution reason.
 * Useful for audit logging and debugging.
 *
 * @param supabase - Supabase client
 * @param userId - The authenticated user's UUID
 * @returns Gateway and reason for selection
 */
export async function resolveGateway(
  supabase: SupabaseClient,
  userId: string,
  preferredGateway?: PaymentGateway
): Promise<GatewayResolution> {
  // 1. Check environment override (kill switch)
  const forceGateway = Deno.env.get("FORCE_PAYMENT_GATEWAY");
  if (forceGateway === "payu" || forceGateway === "cashfree") {
    return { gateway: forceGateway, reason: "env_override" };
  }

  // 1.5. Client preferred gateway hint (only honored in sandbox/dev)
  const isSandbox = Deno.env.get("CASHFREE_PG_BASE_URL")?.includes("sandbox") || Deno.env.get("PAYU_BASE_URL")?.includes("test");
  if (preferredGateway && isSandbox) {
    return { gateway: preferredGateway, reason: "user_override" };
  }

  // 2. Check per-user override from app_config table
  const { data: userOverride } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", `payment_gateway_user_${userId}`)
    .maybeSingle();

  if (
    userOverride?.value === "payu" ||
    userOverride?.value === "cashfree"
  ) {
    return {
      gateway: userOverride.value as PaymentGateway,
      reason: "user_override",
    };
  }

  // 3. Check percentage rollout
  const { data: rolloutConfig } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "payment_gateway_rollout_pct")
    .maybeSingle();

  const rolloutPct = parseInt(rolloutConfig?.value ?? "0", 10);

  if (rolloutPct > 0) {
    // Deterministic bucketing: hash userId to get a stable 0-99 bucket
    const bucket = await hashUserIdToBucket(userId);

    if (bucket < rolloutPct) {
      return { gateway: "cashfree", reason: "rollout_bucket" };
    }
  }

  // 4. Check default gateway config
  const { data: defaultConfig } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "payment_gateway_default")
    .maybeSingle();

  if (
    defaultConfig?.value === "payu" ||
    defaultConfig?.value === "cashfree"
  ) {
    return {
      gateway: defaultConfig.value as PaymentGateway,
      reason: "default_config",
    };
  }

  // 5. Ultimate fallback
  return { gateway: "payu", reason: "fallback" };
}

// ==============================================
// HASHING UTILITY
// ==============================================

/**
 * Hashes a userId to a deterministic bucket number (0-99).
 *
 * Uses SHA-256 and reads the first 4 bytes as an unsigned 32-bit integer,
 * then takes modulo 100. This provides uniform distribution across buckets
 * and is stable -- the same userId always maps to the same bucket.
 *
 * @param userId - UUID string
 * @returns Bucket number between 0 and 99 inclusive
 */
async function hashUserIdToBucket(userId: string): Promise<number> {
  const encoder = new TextEncoder();
  const data = encoder.encode(userId);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const view = new DataView(hashBuffer);
  // Use getUint32 for a non-negative value, ensuring modulo works correctly
  const hash = view.getUint32(0);
  return hash % 100;
}

// ==============================================
// VALIDATION HELPERS
// ==============================================

/**
 * Checks if a string is a valid PaymentGateway value.
 */
export function isValidGateway(value: string): value is PaymentGateway {
  return value === "payu" || value === "cashfree";
}
