/**
 * Payment Services — Core SDK Only
 */

import { callEdgeFunction } from '../supabase';

import type { PayUSessionParams } from '@/src/stores/payment';

// Re-export individual services for direct access
export * from './storageService';
export { launchCorePayment, isCoreSdkAvailable } from './payuCoreService';
export type { CorePaymentMode, CorePaymentOutcome, InstrumentParams } from './payuCoreService';
export * from './cashfreeService';

// ==============================================
// TYPES
// ==============================================

export interface FeeRateConfig {
  rate: number;
  fee_type: 'percentage' | 'flat_paise';
}

export interface GatewayFeeRates {
  upi: FeeRateConfig;
  credit_card: FeeRateConfig;
  debit_card: FeeRateConfig;
  netbanking: FeeRateConfig;
}

export interface UnifiedInitiateResult {
  paymentId: string;
  payuParams?: Record<string, unknown>;
  /** Cashfree payment session ID for SDK initialization */
  cashfreeSessionId?: string;
  /** Cashfree order ID for status polling and webhooks */
  cfOrderId?: string;
  totalAmountPaise: number;
  cashbackAppliedPaise: number;
  demoMode?: boolean;
  /** True when backend sent a S2S UPI collect request — skip SDK, go to status polling */
  upiS2sCollect?: boolean;
}

// ==============================================
// FEE RATES
// ==============================================

const PAYU_FEE_RATES: GatewayFeeRates = {
  upi: { rate: 0, fee_type: 'percentage' },
  credit_card: { rate: 0.0185, fee_type: 'percentage' },
  debit_card: { rate: 0.009, fee_type: 'percentage' },
  netbanking: { rate: 1500, fee_type: 'flat_paise' },
};

const CASHFREE_FEE_RATES: GatewayFeeRates = {
  upi: { rate: 0, fee_type: 'percentage' },
  credit_card: { rate: 0.02, fee_type: 'percentage' },
  debit_card: { rate: 0.009, fee_type: 'percentage' },
  netbanking: { rate: 1500, fee_type: 'flat_paise' },
};

export function getGatewayFeeRates(gateway?: 'payu' | 'cashfree'): GatewayFeeRates {
  return gateway === 'cashfree' ? CASHFREE_FEE_RATES : PAYU_FEE_RATES;
}

/** Compute fee in rupees for a given rate config and amount in rupees */
export function computeFee(config: FeeRateConfig, amount: number): number {
  if (config.fee_type === 'flat_paise') return Math.round(config.rate / 100);
  return Math.ceil(amount * config.rate);
}

/** Format fee config as a human-readable label (e.g. "Free", "1.85%", "₹15 fee") */
export function formatFeeLabel(config: FeeRateConfig, amount: number): string {
  if (config.fee_type === 'flat_paise') {
    const rupees = Math.round(config.rate / 100);
    return `\u20B9${rupees.toLocaleString('en-IN')} fee`;
  }
  if (config.rate === 0) return 'Free';
  const fee = Math.ceil(amount * config.rate);
  return `\u20B9${fee.toLocaleString('en-IN')} fee`;
}

/** Map raw edge function PayU params to typed PayUSessionParams */
export function buildSessionParams(p: Record<string, string>): PayUSessionParams {
  return {
    key: p.key,
    txnid: p.txnid,
    amount: p.amount,
    productinfo: p.productinfo,
    firstname: p.firstname,
    email: p.email,
    phone: p.phone,
    surl: p.surl,
    furl: p.furl,
    hash: p.hash,
    vas_hash: p.vas_for_mobile_sdk_hash,
    prd_hash: p.payment_related_details_for_mobile_sdk_hash,
    user_credential: p.user_credential ?? `${p.key}:${p.email}`,
    udf1: p.udf1,
    udf2: p.udf2,
    udf3: p.udf3,
    udf4: p.udf4,
    udf5: p.udf5,
    enforce_paymethod: p.enforce_paymethod,
    environment: (p.environment as '0' | '1') ?? undefined,
    // Server-built POST body + URL — pass through to payuCoreService
    post_data: p.post_data,
    payment_url: p.payment_url,
  } as PayUSessionParams;
}

/** Normalize a fee value — if the backend returns a plain number (old shape), wrap it as percentage */
function normalizeFeeRate(value: unknown): FeeRateConfig {
  if (typeof value === 'object' && value !== null && 'rate' in value && 'fee_type' in value) {
    return value as FeeRateConfig;
  }
  if (typeof value === 'number') {
    return { rate: value, fee_type: 'percentage' };
  }
  return { rate: 0, fee_type: 'percentage' };
}

export async function fetchFeeConfig(): Promise<GatewayFeeRates> {
  const { data, error, errorBody } = await callEdgeFunction<{
    success: boolean;
    data: {
      fee_rates: Record<string, unknown>;
    };
  }>('get-fee-config', {}, true, 'GET');

  if (error || !data?.success || !data.data) {
    return PAYU_FEE_RATES; // Fallback to hardcoded defaults
  }

  const raw = data.data.fee_rates;
  return {
    upi: normalizeFeeRate(raw.upi),
    credit_card: normalizeFeeRate(raw.credit_card),
    debit_card: normalizeFeeRate(raw.debit_card),
    netbanking: normalizeFeeRate(raw.netbanking),
  };
}

// ==============================================
// UNIFIED INITIATE
// ==============================================

export async function initiatePayment(params: {
  tenancyId: string;
  paymentMethod: 'upi' | 'card' | 'debit_card' | 'netbanking';
  rentMonth: string;
  cardType?: 'credit' | 'debit';
  amountPaise?: number;
  /** UPI VPA for S2S collect flow — when provided, backend sends collect request directly */
  upiVpa?: string;
}): Promise<{ data: UnifiedInitiateResult | null; error: string | null }> {
  // Use dedicated Cashfree function — isolated from PayU path
  const useCashfree = true;
  const functionName = useCashfree ? 'initiate-cashfree-payment' : 'initiate-payment';

  const body: Record<string, unknown> = {
    tenancy_id: params.tenancyId,
    payment_method: params.paymentMethod === 'debit_card' ? 'card' : params.paymentMethod,
    card_type: params.cardType,
    rent_month: params.rentMonth.slice(0, 7),
    checkout_mode: 'sdk',
  };
  if (params.amountPaise) {
    body.amount_paise = params.amountPaise;
  }
  if (params.upiVpa) {
    body.upi_vpa = params.upiVpa;
  }

  // Standard authenticated call — JWT ref matches edge function project
  // because EAS env vars point dev/preview to the branch and production to main.
  const { data, error, errorBody } = await callEdgeFunction<{
    success: boolean;
    data: {
      payment_id: string;
      txn_id: string;
      total_amount_paise: number;
      cashback_applied_paise: number;
      payu?: Record<string, unknown>;
      cashfree?: { payment_session_id: string; cf_order_id: string };
    };
  }>(functionName, body, true);

  if (error) {
    console.error('[initiatePayment] Edge function error:', error, 'code:', errorBody?.code, 'body:', JSON.stringify(errorBody));
    // Check structured error code first for precise error handling
    const structuredCode = errorBody?.code as string | undefined;
    if (structuredCode) {
      switch (structuredCode) {
        case 'ALREADY_PAID':
        case 'PAYMENT_ALREADY_COMPLETED':
          return { data: null, error: 'Payment already completed for this month' };
        case 'PAYMENT_IN_PROGRESS':
          return { data: null, error: 'A payment is already being processed' };
        case 'BANK_NOT_VERIFIED':
          return { data: null, error: 'Landlord bank account not verified yet' };
        case 'AUTH_ERROR':
          return { data: null, error: 'Please sign in to continue' };
        case 'RATE_LIMITED':
          return { data: null, error: 'Too many requests. Please wait a moment.' };
        case 'IDEMPOTENCY_CONFLICT':
          return { data: null, error: 'Please wait a moment and try again.' };
        case 'DB_ERROR':
          return { data: null, error: 'Server error creating payment. Please try again.' };
        case 'UPI_S2S_FAILED':
        case 'UPI_S2S_ERROR':
          // Pass through the actual PayU error from backend for debugging
          return { data: null, error: error ?? 'UPI collect request failed' };
        case 'UPI_VPA_REQUIRED':
          return { data: null, error: 'UPI ID is required for payment.' };
        case 'AMOUNT_TOO_LOW':
        case 'AMOUNT_EXCEEDS_RENT':
        case 'INVALID_AMOUNT':
        case 'LANDLORD_NOT_APPROVED':
        case 'UTILITY_NOT_VERIFIED':
        case 'TENANCY_INACTIVE':
          return { data: null, error };
      }
    }

    // Surface field-level validation details for debugging
    const details = errorBody?.details as Record<string, unknown> | undefined;
    const fieldErrors = (details?.fields ?? details) as Record<string, string> | undefined;
    if (fieldErrors && typeof fieldErrors === 'object') {
      const fieldInfo = Object.entries(fieldErrors).map(([k, v]) => `${k}: ${v}`).join(', ');
      console.error('[initiatePayment] Validation details:', fieldInfo);
      return { data: null, error: `${error} (${fieldInfo})` };
    }
    return { data: null, error };
  }

  if (!data?.success || !data.data) {
    console.error('[initiatePayment] Unexpected response format:', JSON.stringify(data));
    return { data: null, error: 'Failed to initiate payment' };
  }

  const d = data.data;
  const raw = d as Record<string, unknown>;
  return {
    data: {
      paymentId: d.payment_id,
      payuParams: d.payu,
      cashfreeSessionId: d.cashfree?.payment_session_id,
      cfOrderId: d.cashfree?.cf_order_id,
      totalAmountPaise: d.total_amount_paise,
      cashbackAppliedPaise: d.cashback_applied_paise,
      demoMode: raw.demo_mode === true,
      upiS2sCollect: raw.upi_s2s_collect === true,
    },
    error: null,
  };
}
