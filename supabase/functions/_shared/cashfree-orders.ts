/**
 * Flent Secured v2 - Cashfree PG Order Operations
 *
 * Payment Gateway order creation, retrieval, payment status,
 * refunds, and settlement reconciliation.
 */

import {
  cashfreeRequest,
  CF_PG_API_VERSION,
  getPgConfig,
  CashfreeError,
} from "./cashfree-common.ts";

// ==============================================
// TYPES
// ==============================================

export interface CashfreeCustomerDetails {
  customer_id: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone: string;
}

export interface CashfreeOrderMeta {
  return_url?: string;
  notify_url?: string;
  payment_methods?: string;
}

export interface CreateOrderParams {
  orderId: string;
  amount: number;
  currency?: string;
  customerDetails: CashfreeCustomerDetails;
  orderMeta?: CashfreeOrderMeta;
  orderTags?: Record<string, string>;
  orderExpiryTime?: string;
}

export interface CashfreeOrderResponse {
  cf_order_id: string;
  order_id: string;
  entity: string;
  order_currency: string;
  order_amount: number;
  order_status: string;
  payment_session_id: string;
  order_expiry_time?: string;
  order_note?: string;
  created_at?: string;
  order_tags?: Record<string, string>;
  order_meta?: CashfreeOrderMeta;
  customer_details?: CashfreeCustomerDetails;
}

export interface CashfreePaymentAttempt {
  cf_payment_id: number;
  order_id: string;
  entity: string;
  payment_currency: string;
  payment_amount: number;
  payment_status: string;
  payment_message?: string;
  payment_time?: string;
  payment_method?: {
    upi?: { upi_id?: string; channel?: string };
    card?: { card_number?: string; card_network?: string; card_type?: string };
    netbanking?: { netbanking_bank_code?: string; netbanking_bank_name?: string };
    wallet?: { channel?: string };
  };
  bank_reference?: string;
  auth_id?: string;
  error_details?: {
    error_code?: string;
    error_description?: string;
    error_reason?: string;
    error_source?: string;
  };
}

export interface InitiateRefundParams {
  refundAmount: number;
  refundId: string;
  refundSpeed?: "STANDARD" | "INSTANT";
  refundNote?: string;
}

export interface CashfreeRefundEntity {
  cf_refund_id: string;
  cf_payment_id: number;
  refund_id: string;
  order_id: string;
  entity: string;
  refund_amount: number;
  refund_currency: string;
  refund_note?: string;
  refund_status: string;
  refund_speed?: string;
  refund_arn?: string;
  created_at?: string;
  processed_at?: string;
  status_description?: string;
}

export interface SettlementFilters {
  startDate: string;
  endDate: string;
  page?: number;
  limit?: number;
}

export interface CashfreeSettlementResponse {
  cursor?: string;
  data?: Array<{
    cf_settlement_id: string;
    settlement_date: string;
    settlement_amount: number;
    settlement_utr?: string;
    order_id?: string;
    cf_payment_id?: number;
    payment_amount?: number;
    service_charge?: number;
    service_tax?: number;
    settlement_tax?: number;
  }>;
}

// ==============================================
// ORDER OPERATIONS
// ==============================================

/**
 * Creates a new Cashfree PG order.
 *
 * @param params - Order creation parameters
 * @returns Order response with cf_order_id and payment_session_id
 * @throws CashfreeError on API failure
 */
export async function createCashfreeOrder(
  params: CreateOrderParams
): Promise<CashfreeOrderResponse> {
  const { appId, secretKey, baseUrl } = getPgConfig();

  // Validate order_id max length
  if (params.orderId.length > 45) {
    throw new CashfreeError(
      `order_id exceeds max length of 45 characters: ${params.orderId.length}`,
      "CASHFREE_VALIDATION_ERROR",
      400
    );
  }

  // Default expiry: 30 minutes from now (ISO 8601)
  const expiryTime =
    params.orderExpiryTime ??
    new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const body = {
    order_id: params.orderId,
    order_amount: parseFloat(params.amount.toFixed(2)),
    order_currency: params.currency ?? "INR",
    customer_details: params.customerDetails,
    order_meta: params.orderMeta,
    order_tags: params.orderTags,
    order_expiry_time: expiryTime,
  };

  const response = await cashfreeRequest<CashfreeOrderResponse>(
    baseUrl,
    "/pg/orders",
    "POST",
    body,
    appId,
    secretKey,
    CF_PG_API_VERSION
  );

  return response.data;
}

/**
 * Retrieves a Cashfree PG order by order ID.
 *
 * @param orderId - The merchant order ID
 * @returns Full order object
 * @throws CashfreeError on API failure
 */
export async function getCashfreeOrder(
  orderId: string
): Promise<CashfreeOrderResponse> {
  const { appId, secretKey, baseUrl } = getPgConfig();

  const response = await cashfreeRequest<CashfreeOrderResponse>(
    baseUrl,
    `/pg/orders/${encodeURIComponent(orderId)}`,
    "GET",
    undefined,
    appId,
    secretKey,
    CF_PG_API_VERSION
  );

  return response.data;
}

/**
 * Retrieves all payment attempts for a Cashfree PG order.
 *
 * @param orderId - The merchant order ID
 * @returns Array of payment attempts
 * @throws CashfreeError on API failure
 */
export async function getCashfreePayments(
  orderId: string
): Promise<CashfreePaymentAttempt[]> {
  const { appId, secretKey, baseUrl } = getPgConfig();

  const response = await cashfreeRequest<CashfreePaymentAttempt[]>(
    baseUrl,
    `/pg/orders/${encodeURIComponent(orderId)}/payments`,
    "GET",
    undefined,
    appId,
    secretKey,
    CF_PG_API_VERSION
  );

  return response.data;
}

/**
 * Initiates a refund for a Cashfree PG order.
 *
 * Note: UPI refunds do not support INSTANT speed. This function
 * automatically forces STANDARD speed for safety. If you are certain
 * the payment method supports INSTANT, pass refundSpeed explicitly.
 *
 * @param orderId - The merchant order ID
 * @param params - Refund parameters
 * @returns Refund entity with status
 * @throws CashfreeError on API failure
 */
export async function initiateCashfreeRefund(
  orderId: string,
  params: InitiateRefundParams
): Promise<CashfreeRefundEntity> {
  const { appId, secretKey, baseUrl } = getPgConfig();

  // UPI refunds only support STANDARD speed.
  // Default to STANDARD for safety; caller can override for card/netbanking INSTANT.
  const refundSpeed = params.refundSpeed ?? "STANDARD";

  const body = {
    refund_amount: parseFloat(params.refundAmount.toFixed(2)),
    refund_id: params.refundId,
    refund_speed: refundSpeed,
    refund_note: params.refundNote,
  };

  const response = await cashfreeRequest<CashfreeRefundEntity>(
    baseUrl,
    `/pg/orders/${encodeURIComponent(orderId)}/refunds`,
    "POST",
    body,
    appId,
    secretKey,
    CF_PG_API_VERSION
  );

  return response.data;
}

/**
 * Retrieves a specific refund for a Cashfree PG order.
 *
 * @param orderId - The merchant order ID
 * @param refundId - The merchant refund ID
 * @returns Refund entity with current status
 * @throws CashfreeError on API failure
 */
export async function getCashfreeRefund(
  orderId: string,
  refundId: string
): Promise<CashfreeRefundEntity> {
  const { appId, secretKey, baseUrl } = getPgConfig();

  const response = await cashfreeRequest<CashfreeRefundEntity>(
    baseUrl,
    `/pg/orders/${encodeURIComponent(orderId)}/refunds/${encodeURIComponent(refundId)}`,
    "GET",
    undefined,
    appId,
    secretKey,
    CF_PG_API_VERSION
  );

  return response.data;
}

/**
 * Retrieves settlement reconciliation data from Cashfree.
 *
 * @param filters - Date range and pagination filters
 * @returns Settlement records
 * @throws CashfreeError on API failure
 */
export async function getCashfreeSettlements(
  filters: SettlementFilters
): Promise<CashfreeSettlementResponse> {
  const { appId, secretKey, baseUrl } = getPgConfig();

  const body = {
    start_date: filters.startDate,
    end_date: filters.endDate,
    page: filters.page ?? 1,
    limit: filters.limit ?? 25,
  };

  const response = await cashfreeRequest<CashfreeSettlementResponse>(
    baseUrl,
    "/pg/settlement/recon",
    "POST",
    body,
    appId,
    secretKey,
    CF_PG_API_VERSION
  );

  return response.data;
}
