/**
 * Payments API Service
 *
 * Handles payment initiation, status checks, history, and payment method CRUD.
 * Maps edge function responses (snake_case) to the shapes expected by the RN UI layer.
 *
 * Edge function contracts:
 * - initiate-payment: POST, returns { success, data: { payment_id, txn_id, payu: {...}, ... } }
 * - get-payment-history: GET, returns { success, data: { payments, pagination, summary, filters_applied } }
 * - generate-receipt: GET, returns { success, data: ReceiptData }
 * - get-saved-payment-methods: GET, returns { success, data: { payment_methods, primary_method_id, grouped_methods, total_count } }
 * - add-upi-vpa: POST, expects { upi_vpa, nickname?, set_primary? }
 * - add-card-token: POST, expects { card_token, card_last4, card_network, card_type, ... }
 * - delete-payment-method: POST, expects { payment_method_id, hard_delete? }
 */

import { callEdgeFunction } from '../supabase';

// ==============================================
// TYPES — RN App UI Contract
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
  /** Amount in rupees (mapped from edge function's paise-based response) */
  amount: number;
  /** PG fee in rupees */
  pg_fee: number;
  /** Cashback applied in rupees */
  cashback_applied: number;
  /** Cashback earned in rupees */
  cashback_earned: number;
  /** Net amount in rupees (amount - cashback_applied) */
  net_amount: number;
  /** Paise values kept for backward compat */
  amount_paise: number;
  pg_fee_paise: number;
  cashback_applied_paise: number;
  status: 'pending' | 'initiated' | 'processing' | 'success' | 'failed' | 'refunded';
  payment_method: PaymentMethod | null;
  rent_month: string;
  created_at: string;
  paid_at: string | null;
  /** Whether a receipt can be downloaded for this payment */
  can_download_receipt: boolean;
  /** Tenancy details from the join */
  tenancy: {
    id: string;
    property_address: string;
    landlord_name: string;
  } | null;
}

export interface PaymentHistoryPagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface PaymentHistorySummary {
  total_paid: number;
  total_cashback_earned: number;
  successful_payments: number;
  failed_payments: number;
}

export interface PaymentHistoryResponse {
  success: boolean;
  data: {
    payments: PaymentHistoryItem[];
    pagination: PaymentHistoryPagination;
    summary: PaymentHistorySummary;
  };
}

export interface PaymentErrorCode {
  code: string;
  message: string;
}

// ==============================================
// TYPES — Raw Edge Function Responses
// ==============================================

/** Raw response from get-payment-history edge function */
interface RawPaymentHistoryItem {
  id: string;
  amount: number;
  pg_fee: number;
  cashback_applied: number;
  cashback_earned: number;
  net_amount: number;
  status: string;
  payment_method: string | null;
  rent_month: string;
  paid_at: string | null;
  created_at: string;
  tenancy: {
    id: string;
    property_address: string;
    landlord_name: string;
  } | null;
  can_download_receipt: boolean;
}

interface RawPaymentHistoryResponse {
  success: boolean;
  data: {
    payments: RawPaymentHistoryItem[];
    pagination: PaymentHistoryPagination;
    summary: PaymentHistorySummary;
    filters_applied: Record<string, string | null>;
  };
}

/** Raw response from get-saved-payment-methods edge function */
interface RawSavedPaymentMethod {
  id: string;
  type: 'upi' | 'card' | 'netbanking';
  display_name: string;
  is_primary: boolean;
  is_verified: boolean;
  nickname: string | null;
  created_at: string;
  // UPI fields
  upi_vpa?: string;
  upi_provider?: string;
  // Card fields
  card_last4?: string;
  card_network?: string;
  card_type?: string;
  card_issuer?: string;
  card_expiry_month?: number;
  card_expiry_year?: number;
  is_expired?: boolean;
  // Netbanking fields
  bank_code?: string;
  bank_name?: string;
}

interface RawGetPaymentMethodsResponse {
  success: boolean;
  data: {
    payment_methods: RawSavedPaymentMethod[];
    primary_method_id: string | null;
    grouped_methods: {
      upi: RawSavedPaymentMethod[];
      cards: RawSavedPaymentMethod[];
      netbanking: RawSavedPaymentMethod[];
    };
    total_count: number;
  };
}

/** Raw response from add-upi-vpa edge function */
interface RawAddUpiVpaResponse {
  success: boolean;
  data: {
    payment_method_id: string;
    upi_vpa: string;
    upi_provider: string;
    is_verified: boolean;
    is_primary: boolean;
    nickname: string;
    account_holder_name?: string;
  };
}

/** Raw response from add-card-token edge function */
interface RawAddCardTokenResponse {
  success: boolean;
  data: {
    payment_method_id: string;
    card_last4: string;
    card_network: string;
    card_type: string;
    card_issuer: string | null;
    card_expiry_month: number;
    card_expiry_year: number;
    is_primary: boolean;
    nickname: string;
  };
}

/** Raw response from delete-payment-method edge function */
interface RawDeletePaymentMethodResponse {
  success: boolean;
  data: {
    deleted_id: string;
    was_primary: boolean;
    new_primary_id: string | null;
    hard_deleted: boolean;
  };
}

/** Raw response from generate-receipt edge function */
interface RawReceiptData {
  receipt_number: string;
  generated_at: string;
  payment: {
    id: string;
    transaction_id: string | null;
    payment_gateway_id: string | null;
    amount: number;
    pg_fee: number;
    cashback_applied: number;
    cashback_earned: number;
    net_amount_paid: number;
    payment_method: string | null;
    status: string;
    rent_month: string;
    rent_month_display: string;
    paid_at: string;
  };
  tenant: {
    name: string;
    phone: string | null;
    email: string | null;
  };
  property: {
    address: string;
    city: string | null;
  };
  landlord: {
    name: string;
    bank_account_masked: string | null;
  };
  company: {
    name: string;
    address: string;
    gstin: string;
    support_email: string;
    support_phone: string;
  };
}

interface RawGenerateReceiptResponse {
  success: boolean;
  data: RawReceiptData;
}

// ==============================================
// TYPES — RN App UI Contract (Saved Payment Methods)
// ==============================================

export interface SavedPaymentMethod {
  id: string;
  type: 'upi' | 'card' | 'netbanking';
  display_name: string;
  is_default: boolean;
  is_verified: boolean;
  nickname: string | null;
  created_at: string;
  // UPI fields (mapped from edge function)
  vpa?: string;
  upi_provider?: string;
  // Card fields (mapped from edge function)
  last_four?: string;
  card_network?: string;
  card_type?: string;
  card_issuer?: string;
  card_expiry_month?: number;
  card_expiry_year?: number;
  is_expired?: boolean;
  // Netbanking fields
  bank_code?: string;
  bank_name?: string;
}

export interface ReceiptData {
  receiptNumber: string;
  generatedAt: string;
  payment: {
    id: string;
    transactionId: string | null;
    gatewayId: string | null;
    amount: number;
    pgFee: number;
    cashbackApplied: number;
    cashbackEarned: number;
    netAmountPaid: number;
    paymentMethod: string | null;
    status: string;
    rentMonth: string;
    rentMonthDisplay: string;
    paidAt: string;
  };
  tenant: {
    name: string;
    phone: string | null;
    email: string | null;
  };
  property: {
    address: string;
    city: string | null;
  };
  landlord: {
    name: string;
    bankAccountMasked: string | null;
  };
  company: {
    name: string;
    address: string;
    gstin: string;
    supportEmail: string;
    supportPhone: string;
  };
}

// ==============================================
// MAPPING FUNCTIONS
// ==============================================

/**
 * Maps raw edge function payment history item to the RN app's expected shape.
 * Edge function returns amounts in rupees; we keep both rupee and paise values.
 */
function mapRawPaymentHistoryItem(raw: RawPaymentHistoryItem): PaymentHistoryItem {
  return {
    id: raw.id,
    // Rupee values from edge function
    amount: raw.amount,
    pg_fee: raw.pg_fee,
    cashback_applied: raw.cashback_applied,
    cashback_earned: raw.cashback_earned,
    net_amount: raw.net_amount,
    // Paise values derived for backward compat
    amount_paise: Math.round(raw.amount * 100),
    pg_fee_paise: Math.round(raw.pg_fee * 100),
    cashback_applied_paise: Math.round(raw.cashback_applied * 100),
    status: raw.status as PaymentHistoryItem['status'],
    payment_method: raw.payment_method as PaymentMethod | null,
    rent_month: raw.rent_month,
    created_at: raw.created_at,
    paid_at: raw.paid_at,
    can_download_receipt: raw.can_download_receipt,
    tenancy: raw.tenancy,
  };
}

/**
 * Maps raw edge function saved payment method to the RN app's SavedPaymentMethod shape.
 * Key mappings:
 * - is_primary -> is_default (UI uses is_default)
 * - upi_vpa -> vpa
 * - card_last4 -> last_four
 */
function mapRawSavedPaymentMethod(raw: RawSavedPaymentMethod): SavedPaymentMethod {
  return {
    id: raw.id,
    type: raw.type,
    display_name: raw.display_name,
    is_default: raw.is_primary, // Edge function uses is_primary, UI uses is_default
    is_verified: raw.is_verified,
    nickname: raw.nickname,
    created_at: raw.created_at,
    // UPI fields
    vpa: raw.upi_vpa,
    upi_provider: raw.upi_provider,
    // Card fields
    last_four: raw.card_last4,
    card_network: raw.card_network,
    card_type: raw.card_type,
    card_issuer: raw.card_issuer,
    card_expiry_month: raw.card_expiry_month,
    card_expiry_year: raw.card_expiry_year,
    is_expired: raw.is_expired,
    // Netbanking fields
    bank_code: raw.bank_code,
    bank_name: raw.bank_name,
  };
}

/**
 * Maps raw receipt data to the RN app's camelCase ReceiptData shape.
 */
function mapRawReceiptData(raw: RawReceiptData): ReceiptData {
  return {
    receiptNumber: raw.receipt_number,
    generatedAt: raw.generated_at,
    payment: {
      id: raw.payment.id,
      transactionId: raw.payment.transaction_id,
      gatewayId: raw.payment.payment_gateway_id,
      amount: raw.payment.amount,
      pgFee: raw.payment.pg_fee,
      cashbackApplied: raw.payment.cashback_applied,
      cashbackEarned: raw.payment.cashback_earned,
      netAmountPaid: raw.payment.net_amount_paid,
      paymentMethod: raw.payment.payment_method,
      status: raw.payment.status,
      rentMonth: raw.payment.rent_month,
      rentMonthDisplay: raw.payment.rent_month_display,
      paidAt: raw.payment.paid_at,
    },
    tenant: raw.tenant,
    property: raw.property,
    landlord: {
      name: raw.landlord.name,
      bankAccountMasked: raw.landlord.bank_account_masked,
    },
    company: {
      name: raw.company.name,
      address: raw.company.address,
      gstin: raw.company.gstin,
      supportEmail: raw.company.support_email,
      supportPhone: raw.company.support_phone,
    },
  };
}

// ==============================================
// MOCK DATA FOR DEVELOPMENT
// ==============================================

/**
 * Mock saved payment methods for dev mode (no auth required)
 */
const MOCK_SAVED_METHODS: SavedPaymentMethod[] = [
  {
    id: 'pm_upi_001',
    type: 'upi',
    display_name: 'UPI - ICICI',
    vpa: 'rishabh@icici',
    upi_provider: 'other',
    is_default: true,
    is_verified: true,
    nickname: 'UPI - ICICI',
    created_at: new Date().toISOString(),
  },
  {
    id: 'pm_card_001',
    type: 'card',
    display_name: 'Visa ****2341',
    last_four: '2341',
    card_network: 'visa',
    card_type: 'credit',
    is_default: false,
    is_verified: true,
    nickname: 'Visa ending in 2341',
    created_at: new Date().toISOString(),
  },
];

// ==============================================
// API FUNCTIONS
// ==============================================

/**
 * Initiate a rent payment.
 *
 * Calls POST /functions/v1/initiate-payment
 * Edge function returns PayU params needed to launch the checkout SDK.
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
 * Fetch payment history.
 *
 * Calls GET /functions/v1/get-payment-history?page=X&limit=Y
 * Edge function returns paginated results with amounts in rupees.
 * Maps to the RN app's PaymentHistoryItem shape with both rupee and paise values.
 */
export async function fetchPaymentHistory(
  page = 1,
  limit = 20,
  filters?: {
    status?: string;
    tenancy_id?: string;
    from_date?: string;
    to_date?: string;
  }
): Promise<{
  data: PaymentHistoryItem[] | null;
  pagination: PaymentHistoryPagination | null;
  summary: PaymentHistorySummary | null;
  error: string | null;
}> {
  // Build query params for the GET request
  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (filters?.status) queryParams.set('status', filters.status);
  if (filters?.tenancy_id) queryParams.set('tenancy_id', filters.tenancy_id);
  if (filters?.from_date) queryParams.set('from_date', filters.from_date);
  if (filters?.to_date) queryParams.set('to_date', filters.to_date);

  const { data, error } = await callEdgeFunction<RawPaymentHistoryResponse>(
    `get-payment-history?${queryParams.toString()}`,
    {},
    true, // requireAuth
    'GET'
  );

  if (error) {
    return { data: null, pagination: null, summary: null, error };
  }

  if (!data?.success) {
    return {
      data: null,
      pagination: null,
      summary: null,
      error: 'Failed to fetch payment history',
    };
  }

  const mappedPayments = data.data.payments.map(mapRawPaymentHistoryItem);

  return {
    data: mappedPayments,
    pagination: data.data.pagination,
    summary: data.data.summary,
    error: null,
  };
}

/**
 * Generate receipt for a successful payment.
 *
 * Calls GET /functions/v1/generate-receipt?payment_id=xxx
 * Edge function returns rich ReceiptData (not just a URL).
 */
export async function generateReceipt(
  paymentId: string
): Promise<{ data: ReceiptData | null; error: string | null }> {
  const { data, error } = await callEdgeFunction<RawGenerateReceiptResponse>(
    `generate-receipt?payment_id=${encodeURIComponent(paymentId)}`,
    {},
    true, // requireAuth
    'GET'
  );

  if (error) {
    return { data: null, error };
  }

  if (!data?.success || !data.data) {
    return { data: null, error: 'Failed to generate receipt' };
  }

  return { data: mapRawReceiptData(data.data), error: null };
}

/**
 * Get saved payment methods.
 *
 * Calls GET /functions/v1/get-saved-payment-methods
 * Maps edge function response fields to the RN app's SavedPaymentMethod shape:
 * - is_primary -> is_default
 * - upi_vpa -> vpa
 * - card_last4 -> last_four
 */
export async function getSavedPaymentMethods(): Promise<{
  data: SavedPaymentMethod[] | null;
  primaryMethodId: string | null;
  error: string | null;
}> {
  const { data, error } = await callEdgeFunction<RawGetPaymentMethodsResponse>(
    'get-saved-payment-methods',
    {},
    true, // requireAuth
    'GET'
  );

  if (error) {
    if (__DEV__) {
      return { data: MOCK_SAVED_METHODS, primaryMethodId: 'pm_upi_001', error: null };
    }
    return { data: null, primaryMethodId: null, error };
  }

  if (!data?.success) {
    return { data: null, primaryMethodId: null, error: 'Failed to fetch payment methods' };
  }

  const mappedMethods = data.data.payment_methods.map(mapRawSavedPaymentMethod);

  return {
    data: mappedMethods,
    primaryMethodId: data.data.primary_method_id,
    error: null,
  };
}

/**
 * Add UPI VPA.
 *
 * Calls POST /functions/v1/add-upi-vpa
 * Edge function expects: { upi_vpa, nickname?, set_primary? }
 * (NOT { vpa, display_name } which was the old incorrect mapping)
 */
export async function addUpiVpa(
  vpa: string,
  nickname?: string,
  setPrimary = false
): Promise<{ data: SavedPaymentMethod | null; error: string | null }> {
  const { data, error } = await callEdgeFunction<RawAddUpiVpaResponse>(
    'add-upi-vpa',
    {
      upi_vpa: vpa, // Edge function expects upi_vpa, not vpa
      nickname, // Edge function expects nickname, not display_name
      set_primary: setPrimary,
    },
    true // requireAuth
  );

  if (error) {
    return { data: null, error };
  }

  if (!data?.success || !data.data) {
    return { data: null, error: 'Failed to add UPI VPA' };
  }

  // Map raw response to SavedPaymentMethod
  const raw = data.data;
  return {
    data: {
      id: raw.payment_method_id,
      type: 'upi',
      display_name: raw.nickname,
      vpa: raw.upi_vpa,
      upi_provider: raw.upi_provider,
      is_default: raw.is_primary,
      is_verified: raw.is_verified,
      nickname: raw.nickname,
      created_at: new Date().toISOString(),
    },
    error: null,
  };
}

/**
 * Add card token.
 *
 * Calls POST /functions/v1/add-card-token
 * Edge function expects: { card_token, card_last4, card_network, card_type, card_expiry_month, card_expiry_year, card_issuer?, nickname?, set_primary? }
 */
export interface AddCardTokenRequest {
  card_token: string;
  card_last4: string;
  card_network: 'visa' | 'mastercard' | 'rupay' | 'amex' | 'maestro';
  card_type: 'credit' | 'debit';
  card_issuer?: string;
  card_expiry_month: number;
  card_expiry_year: number;
  nickname?: string;
  set_primary?: boolean;
}

export async function addCardToken(
  request: AddCardTokenRequest
): Promise<{ data: SavedPaymentMethod | null; error: string | null }> {
  const { data, error } = await callEdgeFunction<RawAddCardTokenResponse>(
    'add-card-token',
    request,
    true // requireAuth
  );

  if (error) {
    return { data: null, error };
  }

  if (!data?.success || !data.data) {
    return { data: null, error: 'Failed to add card' };
  }

  // Map raw response to SavedPaymentMethod
  const raw = data.data;
  return {
    data: {
      id: raw.payment_method_id,
      type: 'card',
      display_name: raw.nickname,
      last_four: raw.card_last4,
      card_network: raw.card_network,
      card_type: raw.card_type,
      card_issuer: raw.card_issuer ?? undefined,
      card_expiry_month: raw.card_expiry_month,
      card_expiry_year: raw.card_expiry_year,
      is_default: raw.is_primary,
      is_verified: true,
      nickname: raw.nickname,
      created_at: new Date().toISOString(),
    },
    error: null,
  };
}

/**
 * Delete a saved payment method.
 *
 * Calls POST /functions/v1/delete-payment-method
 * Edge function expects: { payment_method_id } (NOT { method_id })
 */
export async function deletePaymentMethod(
  methodId: string,
  hardDelete = false
): Promise<{
  success: boolean;
  newPrimaryId: string | null;
  error: string | null;
}> {
  const { data, error } = await callEdgeFunction<RawDeletePaymentMethodResponse>(
    'delete-payment-method',
    {
      payment_method_id: methodId, // Edge function expects payment_method_id, not method_id
      hard_delete: hardDelete,
    },
    true // requireAuth
  );

  if (error) {
    return { success: false, newPrimaryId: null, error };
  }

  if (!data?.success) {
    return { success: false, newPrimaryId: null, error: 'Failed to delete payment method' };
  }

  return {
    success: true,
    newPrimaryId: data.data.new_primary_id,
    error: null,
  };
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

  if (lowerMessage.includes('not authenticated') || lowerMessage.includes('unauthorized')) {
    return { code: 'AUTH_ERROR', message: 'Please sign in to continue' };
  }

  if (lowerMessage.includes('network') || lowerMessage.includes('fetch') || lowerMessage.includes('timed out')) {
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
  return `\u20B9${rupees.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/**
 * Format rupee amount with currency symbol
 */
export function formatRupees(rupees: number): string {
  return `\u20B9${rupees.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
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

// ==============================================
// PAYMENT SCHEDULING
// ==============================================

export interface CreateScheduleRequest {
  tenancy_id: string;
  payment_method: PaymentMethod;
  scheduled_day: number;
  auto_apply_cashback?: boolean;
  upi_vpa?: string;
  card_token?: string;
  bank_code?: string;
}

export interface PaymentSchedule {
  schedule_id: string;
  tenancy_id: string;
  payment_method: string;
  scheduled_day: number;
  auto_apply_cashback: boolean;
  status: 'active' | 'paused' | 'cancelled';
  next_execution_date: string | null;
  monthly_rent_paise: number;
  property_address?: string;
  landlord_name?: string;
  created_at: string;
}

export interface ManageScheduleRequest {
  action: 'cancel' | 'pause' | 'resume';
  schedule_id: string;
}

export async function createPaymentSchedule(
  request: CreateScheduleRequest
): Promise<{ data: PaymentSchedule | null; error: string | null }> {
  const { data, error } = await callEdgeFunction<{ data: PaymentSchedule }>(
    'schedule-payment',
    request as unknown as Record<string, unknown>,
    true,
    'POST'
  );
  if (error) return { data: null, error };
  return { data: data?.data ?? null, error: null };
}

export async function managePaymentSchedule(
  request: ManageScheduleRequest
): Promise<{ data: { schedule_id: string; new_status: string } | null; error: string | null }> {
  const { data, error } = await callEdgeFunction<{ data: { schedule_id: string; new_status: string } }>(
    'schedule-payment',
    request as unknown as Record<string, unknown>,
    true,
    'POST'
  );
  if (error) return { data: null, error };
  return { data: data?.data ?? null, error: null };
}

export async function getPaymentSchedules(
  tenancyId?: string,
  status?: string
): Promise<{ data: PaymentSchedule[] | null; error: string | null }> {
  const queryParams: Record<string, unknown> = {};
  if (tenancyId) queryParams.tenancy_id = tenancyId;
  if (status) queryParams.status = status;

  const { data, error } = await callEdgeFunction<{ data: { schedules: PaymentSchedule[] } }>(
    'get-payment-schedule',
    queryParams,
    true,
    'GET'
  );
  if (error) return { data: null, error };
  return { data: data?.data?.schedules ?? [], error: null };
}

// ==============================================
// CASHBACK HISTORY
// ==============================================

export interface CashbackEntry {
  id: string;
  transaction_type: 'earned' | 'redeemed' | 'reversed' | 'expired';
  amount_paise: number;
  balance_after_paise: number;
  description: string;
  payment_id: string | null;
  tenancy_id: string | null;
  created_at: string;
}

export interface CashbackHistoryData {
  current_balance_paise: number;
  entries: CashbackEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

export async function getCashbackHistory(
  page = 1,
  limit = 20,
  filters?: { tenancy_id?: string; type?: string }
): Promise<{ data: CashbackHistoryData | null; error: string | null }> {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (filters?.tenancy_id) params.set('tenancy_id', filters.tenancy_id);
  if (filters?.type) params.set('type', filters.type);

  const queryParams: Record<string, unknown> = {
    page: String(page),
    limit: String(limit),
  };
  if (filters?.tenancy_id) queryParams.tenancy_id = filters.tenancy_id;
  if (filters?.type) queryParams.type = filters.type;

  const { data, error } = await callEdgeFunction<{ data: CashbackHistoryData }>(
    'get-cashback-history',
    queryParams,
    true,
    'GET'
  );
  if (error) return { data: null, error };
  return { data: data?.data ?? null, error: null };
}
