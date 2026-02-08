/**
 * Payments API Service
 *
 * Handles payment initiation, status checks, and history.
 */

import { callEdgeFunction } from '../supabase';

// ==============================================
// TYPES
// ==============================================

export type PaymentMethod =
  | 'upi'
  | 'upi_intent'
  | 'upi_collect'
  | 'card'
  | 'netbanking'
  | 'wallet';

export interface InitiatePaymentRequest {
  tenancy_id: string;
  amount_paise?: number;
  payment_method: PaymentMethod;
  upi_app?: string;
  upi_vpa?: string;
  card_token?: string;
  bank_code?: string;
  apply_cashback?: boolean;
  rent_month: string; // YYYY-MM format
}

export interface PayUParams {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  hash: string;
  surl: string;
  furl: string;
  curl: string;
  udf1: string;
  udf2: string;
  udf3: string;
}

export interface InitiatePaymentData {
  payment_id: string;
  txn_id: string;
  amount_paise: number;
  pg_fee_paise: number;
  cashback_applied_paise: number;
  total_paise: number;
  payment_method: PaymentMethod;
  payu: PayUParams;
  intent_url?: string;
}

export interface InitiatePaymentResponse {
  success: boolean;
  data: InitiatePaymentData;
}

export interface PaymentHistoryItem {
  id: string;
  amount_paise: number;
  pg_fee_paise: number;
  cashback_applied_paise: number;
  status: 'pending' | 'initiated' | 'processing' | 'success' | 'failed' | 'refunded';
  payment_method: PaymentMethod | null;
  rent_month: string;
  created_at: string;
  paid_at: string | null;
  receipt_url: string | null;
}

export interface PaymentHistoryResponse {
  success: boolean;
  data: {
    payments: PaymentHistoryItem[];
    total: number;
    page: number;
    limit: number;
  };
}

export interface PaymentErrorCode {
  code: string;
  message: string;
}

// ==============================================
// API FUNCTIONS
// ==============================================

/**
 * Initiate a rent payment
 */
export async function initiatePayment(
  request: InitiatePaymentRequest
): Promise<{ data: InitiatePaymentData | null; error: PaymentErrorCode | null }> {
  const { data, error } = await callEdgeFunction<InitiatePaymentResponse>(
    'initiate-payment',
    request,
    true // Requires authentication
  );

  if (error) {
    return {
      data: null,
      error: mapPaymentError(error),
    };
  }

  if (!data?.success) {
    return {
      data: null,
      error: { code: 'INITIATION_FAILED', message: 'Failed to initiate payment' },
    };
  }

  return { data: data.data, error: null };
}

/**
 * Fetch payment history
 */
export async function fetchPaymentHistory(
  page = 1,
  limit = 20
): Promise<{ data: PaymentHistoryItem[] | null; error: string | null }> {
  const { data, error } = await callEdgeFunction<PaymentHistoryResponse>(
    'get-payment-history',
    { page, limit },
    true
  );

  if (error) {
    return { data: null, error };
  }

  return { data: data?.data.payments ?? [], error: null };
}

/**
 * Generate receipt for a successful payment
 */
export async function generateReceipt(
  paymentId: string
): Promise<{ data: { receipt_url: string } | null; error: string | null }> {
  const { data, error } = await callEdgeFunction<{
    success: boolean;
    data: { receipt_url: string };
  }>('generate-receipt', { payment_id: paymentId }, true);

  if (error) {
    return { data: null, error };
  }

  return { data: data?.data ?? null, error: null };
}

/**
 * Get saved payment methods
 */
export interface SavedPaymentMethod {
  id: string;
  type: 'upi' | 'card';
  display_name: string;
  // UPI fields
  vpa?: string;
  // Card fields
  last_four?: string;
  card_network?: string;
  is_default: boolean;
}

/**
 * Mock saved payment methods for dev mode (no auth required)
 */
const MOCK_SAVED_METHODS: SavedPaymentMethod[] = [
  {
    id: 'pm_upi_001',
    type: 'upi',
    display_name: 'ICICI',
    vpa: 'rishabh@icici',
    is_default: true,
  },
  {
    id: 'pm_card_001',
    type: 'card',
    display_name: 'VISA',
    last_four: '2341',
    card_network: 'VISA',
    is_default: false,
  },
];

export async function getSavedPaymentMethods(): Promise<{
  data: SavedPaymentMethod[] | null;
  error: string | null;
}> {
  const { data, error } = await callEdgeFunction<{
    success: boolean;
    data: { payment_methods: SavedPaymentMethod[] };
  }>('get-saved-payment-methods', {}, true);

  if (error) {
    if (__DEV__) {
      return { data: MOCK_SAVED_METHODS, error: null };
    }
    return { data: null, error };
  }

  return { data: data?.data.payment_methods ?? [], error: null };
}

/**
 * Add UPI VPA
 */
export async function addUpiVpa(
  vpa: string,
  displayName?: string
): Promise<{ data: SavedPaymentMethod | null; error: string | null }> {
  const { data, error } = await callEdgeFunction<{
    success: boolean;
    data: SavedPaymentMethod;
  }>('add-upi-vpa', { vpa, display_name: displayName }, true);

  if (error) {
    return { data: null, error };
  }

  return { data: data?.data ?? null, error: null };
}

/**
 * Delete a saved payment method
 */
export async function deletePaymentMethod(
  methodId: string
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await callEdgeFunction(
    'delete-payment-method',
    { method_id: methodId },
    true
  );

  return { success: !error, error };
}

// ==============================================
// ERROR MAPPING
// ==============================================

function mapPaymentError(errorMessage: string): PaymentErrorCode {
  const lowerMessage = errorMessage.toLowerCase();

  if (lowerMessage.includes('already paid')) {
    return { code: 'ALREADY_PAID', message: 'Payment already completed for this month' };
  }

  if (lowerMessage.includes('in progress')) {
    return { code: 'PAYMENT_IN_PROGRESS', message: 'A payment is already being processed' };
  }

  if (lowerMessage.includes('bank not verified')) {
    return { code: 'BANK_NOT_VERIFIED', message: 'Landlord bank account not verified yet' };
  }

  if (lowerMessage.includes('tenancy')) {
    return { code: 'INVALID_TENANCY', message: 'Tenancy not found or inactive' };
  }

  if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
    return { code: 'NETWORK_ERROR', message: 'Please check your internet connection' };
  }

  return { code: 'UNKNOWN_ERROR', message: errorMessage };
}

// ==============================================
// UTILITY FUNCTIONS
// ==============================================

/**
 * Format amount in paise to rupees with currency symbol
 */
export function formatAmount(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/**
 * Get current rent month in YYYY-MM format
 */
export function getCurrentRentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
