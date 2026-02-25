/**
 * Flent Secured v2 - Payment Gateway Router
 *
 * Simplified: always returns 'payu' as the sole payment gateway.
 * Cashfree PG has been removed; only Cashfree Payouts remain.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

export type PaymentGateway = "payu";

export interface GatewayResolution {
  gateway: PaymentGateway;
  reason: "default";
}

export async function getGatewayForUser(
  _supabase: SupabaseClient,
  userId: string,
  _preferredGateway?: string
): Promise<PaymentGateway> {
  console.log(`[gateway-router] user=${userId} gateway=payu reason=default`);
  return "payu";
}

export async function resolveGateway(
  _supabase: SupabaseClient,
  _userId: string,
  _preferredGateway?: string
): Promise<GatewayResolution> {
  return { gateway: "payu", reason: "default" };
}

export function isValidGateway(value: string): value is PaymentGateway {
  return value === "payu";
}
