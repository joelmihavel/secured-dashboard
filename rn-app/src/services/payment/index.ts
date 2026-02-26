/**
 * Payment Services — Core SDK Only
 */

import { callEdgeFunction } from '../supabase';

// Re-export individual services for direct access
export * from './storageService';
export { launchCorePayment, isCoreSdkAvailable } from './payuCoreService';
export type { CorePaymentMode, CorePaymentOutcome, InstrumentParams } from './payuCoreService';

// ==============================================
// TYPES
// ==============================================

export interface GatewayFeeRates {
  upi: number;
  credit_card: number;
  debit_card: number;
  netbanking: number;
}

export interface UnifiedInitiateResult {
  paymentId: string;
  payuParams?: Record<string, unknown>;
  totalAmountPaise: number;
  cashbackAppliedPaise: number;
}

// ==============================================
// FEE RATES
// ==============================================

const PAYU_FEE_RATES: GatewayFeeRates = { upi: 0, credit_card: 0.02, debit_card: 0.02, netbanking: 0.015 };

export function getGatewayFeeRates(): GatewayFeeRates {
  return PAYU_FEE_RATES;
}

export async function fetchFeeConfig(): Promise<GatewayFeeRates> {
  const { data, error } = await callEdgeFunction<{
    success: boolean;
    data: {
      fee_rates: {
        upi: number;
        credit_card: number;
        debit_card: number;
        netbanking: number;
      };
    };
  }>('get-fee-config', {}, true, 'GET');

  if (error || !data?.success || !data.data) {
    return PAYU_FEE_RATES; // Fallback to hardcoded defaults
  }

  return data.data.fee_rates;
}

// ==============================================
// UNIFIED INITIATE
// ==============================================

export async function initiatePayment(params: {
  tenancyId: string;
  paymentMethod: 'upi' | 'card' | 'debit_card' | 'netbanking';
  rentMonth: string;
  cardType?: 'credit' | 'debit';
}): Promise<{ data: UnifiedInitiateResult | null; error: string | null }> {
  const { data, error } = await callEdgeFunction<{
    success: boolean;
    data: {
      payment_id: string;
      txn_id: string;
      total_amount_paise: number;
      cashback_applied_paise: number;
      payu?: Record<string, unknown>;
    };
  }>('initiate-payment', {
    tenancy_id: params.tenancyId,
    payment_method: params.paymentMethod === 'debit_card' ? 'card' : params.paymentMethod,
    card_type: params.cardType,
    rent_month: params.rentMonth,
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
      payuParams: d.payu,
      totalAmountPaise: d.total_amount_paise,
      cashbackAppliedPaise: d.cashback_applied_paise,
    },
    error: null,
  };
}
