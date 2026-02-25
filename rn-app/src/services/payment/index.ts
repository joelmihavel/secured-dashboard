/**
 * Payment Services — Unified Gateway Adapter
 *
 * Provides a single interface that routes to PayU or Cashfree based on
 * the server's `gateway` field in the initiate-payment response.
 */

import { callEdgeFunction } from '../supabase';

// Re-export individual services for direct access
export * from './cashfreeService';
export * from './storageService';
export { initiatePayUPayment, launchPayUCheckout } from './payuService';
export { launchCorePayment, isCoreSdkAvailable } from './payuCoreService';
export type { CorePaymentMode, CorePaymentOutcome, InstrumentParams } from './payuCoreService';

// ==============================================
// TYPES
// ==============================================

export type GatewayType = 'payu' | 'cashfree';

export interface GatewayFeeRates {
  upi: number;
  card: number;
  netbanking: number;
}

export interface UnifiedInitiateResult {
  paymentId: string;
  gateway: GatewayType;
  // Cashfree-specific
  orderId?: string;
  paymentSessionId?: string;
  // PayU-specific
  payuParams?: Record<string, unknown>;
  // Common
  totalAmountPaise: number;
  cashbackAppliedPaise: number;
}

export type CheckoutOutcome = 'needs_verification' | 'cancelled' | 'failure' | 'navigating_to_instrument';

// ==============================================
// FEE RATES PER GATEWAY
// ==============================================

const GATEWAY_FEE_RATES: Record<GatewayType, GatewayFeeRates> = {
  payu: { upi: 0.008, card: 0.02, netbanking: 0.015 },
  cashfree: { upi: 0, card: 0.02, netbanking: 0.015 },
};

export function getGatewayFeeRates(gateway: GatewayType): GatewayFeeRates {
  return GATEWAY_FEE_RATES[gateway];
}

// ==============================================
// UNIFIED INITIATE
// ==============================================

/**
 * Initiates a payment via the edge function and returns a normalized result
 * with the gateway determined by the server.
 */
export async function initiatePayment(params: {
  tenancyId: string;
  paymentMethod: 'upi' | 'card' | 'netbanking';
  rentMonth: string;
  preferredGateway?: GatewayType;
}): Promise<{ data: UnifiedInitiateResult | null; error: string | null }> {
  const { data, error } = await callEdgeFunction<{
    success: boolean;
    data: {
      payment_id: string;
      gateway: GatewayType;
      txn_id: string;
      total_amount_paise: number;
      cashback_applied_paise: number;
      cashfree?: {
        order_id: string;
        payment_session_id: string;
      };
      payu?: Record<string, unknown>;
    };
  }>('initiate-payment', {
    tenancy_id: params.tenancyId,
    payment_method: params.paymentMethod,
    rent_month: params.rentMonth,
    ...(params.preferredGateway && { preferred_gateway: params.preferredGateway }),
  }, true);

  if (error) {
    return { data: null, error };
  }

  if (!data?.success || !data.data) {
    return { data: null, error: 'Failed to initiate payment' };
  }

  const d = data.data;
  return {
    data: {
      paymentId: d.payment_id,
      gateway: d.gateway,
      orderId: d.cashfree?.order_id,
      paymentSessionId: d.cashfree?.payment_session_id,
      payuParams: d.payu,
      totalAmountPaise: d.total_amount_paise,
      cashbackAppliedPaise: d.cashback_applied_paise,
    },
    error: null,
  };
}

// ==============================================
// UNIFIED CHECKOUT LAUNCHER
// ==============================================

/**
 * Launches the appropriate gateway SDK based on the initiate result.
 * Normalizes all outcomes to: needs_verification | cancelled | failure
 *
 * For PayU with Core SDK enabled: returns 'navigating_to_instrument' to signal
 * that initiate.tsx should navigate to the instrument screen instead.
 */
export async function launchCheckout(
  result: UnifiedInitiateResult
): Promise<{ outcome: CheckoutOutcome; error?: string }> {
  if (result.gateway === 'cashfree') {
    if (!result.orderId || !result.paymentSessionId) {
      return { outcome: 'failure', error: 'Missing Cashfree session data' };
    }
    const { launchCashfreeCheckout } = await import('./cashfreeService');
    const checkoutResult = await launchCashfreeCheckout(
      result.paymentId,
      result.orderId,
      result.paymentSessionId,
    );
    if (checkoutResult.status === 'cancelled') return { outcome: 'cancelled' };
    if (checkoutResult.status === 'failure') return { outcome: 'failure', error: checkoutResult.error };
    return { outcome: 'needs_verification' };
  }

  if (result.gateway === 'payu') {
    // Check Core SDK feature flag
    const { usePaymentStore } = await import('@/src/stores');
    const useCoreSdk = usePaymentStore.getState().useCoreSdk;

    if (useCoreSdk) {
      // Core SDK flow — don't launch checkout overlay.
      // Store PayU params in Zustand for the instrument screen to read.
      // initiate.tsx will navigate to add-card / add-netbanking / add-upi.
      return { outcome: 'navigating_to_instrument' as CheckoutOutcome };
    }

    // Fallback: Checkout Pro overlay (unchanged)
    if (!result.payuParams) {
      return { outcome: 'failure', error: 'Missing PayU params' };
    }
    const { launchPayUCheckout } = await import('./payuService');
    const checkoutResult = await launchPayUCheckout(
      result.paymentId,
      result.payuParams as any,
    );
    if (checkoutResult.status === 'cancelled') return { outcome: 'cancelled' };
    if (checkoutResult.status === 'failure') return { outcome: 'failure', error: checkoutResult.error };
    // PayU 'success' also means needs_verification (client-side success != server-side confirmed)
    return { outcome: 'needs_verification' };
  }

  return { outcome: 'failure', error: `Unknown gateway: ${result.gateway}` };
}

// Re-export verifyPaymentStatus (deduplicated — use from cashfreeService, it's gateway-agnostic)
export { verifyPaymentStatus } from './cashfreeService';
