/**
 * Flent Secured v2 - Cashfree Easy Split Shared Module
 *
 * Wraps the Cashfree PG + Easy Split APIs:
 *   - createOrder()           POST /pg/orders                                   (v2025-01-01)
 *   - createVendor()          POST /pg/easy-split/vendors                       (v2025-01-01)
 *   - getVendor()             GET  /pg/easy-split/vendors/{vendor_id}           (v2025-01-01)
 *   - createAdjustment()      POST /pg/easy-split/vendors/{vendor_id}/adjustment (v2023-08-01)
 *   - createRefund()          POST /pg/orders/{order_id}/refunds                (v2025-01-01)
 *   - getOrderPaymentStatus() GET  /pg/orders/{order_id}                        (v2025-01-01)
 *
 * Auth: x-client-id + x-client-secret (same as Cashfree PG credentials)
 * All amounts are in paise internally; converted to rupees at API boundary.
 */

// ==============================================
// CONFIGURATION
// ==============================================

const CF_APP_ID = Deno.env.get("CASHFREE_PG_APP_ID")!;
const CF_SECRET_KEY = Deno.env.get("CASHFREE_PG_APP_SECRET") ?? Deno.env.get("CASHFREE_PG_SECRET_KEY")!;
const CF_BASE_URL = (Deno.env.get("CASHFREE_PG_BASE_URL") ?? "https://sandbox.cashfree.com").replace(/\/$/, "");
const CF_API_VERSION = "2025-01-01";
const FETCH_TIMEOUT_MS = 10000;

// ==============================================
// TYPES
// ==============================================

export interface CashfreeOrder {
  order_id: string;
  order_status: string;
  payment_session_id: string;
  order_amount: number;
}

export interface CashfreeVendor {
  vendor_id: string;
  status:
    | "ACTIVE"
    | "IN_BENE_CREATION"
    | "BENE_CREATION_FAILED"
    | "IN_BANK_VALIDATION"
    | "BANK_VALIDATION_FAILED"
    | "IN_KYC_REVIEW"
    | "ACTION_REQUIRED"
    | "ON_HOLD"
    | "BLOCKED"
    | "DELETED"
    | string;
  name: string;
  email?: string;
  phone?: string;
}

export interface CashfreeVendorInput {
  vendor_id: string;
  name: string;
  phone: string;
  email?: string;
  // Bank account path (traditional)
  account_number?: string; // plaintext — decrypt before passing
  account_holder?: string;
  ifsc?: string;
  // UPI VPA path (alternative — Cashfree accepts either bank or upi)
  upi_vpa?: string;
  pan?: string;
  schedule_option?: number; // 2=T+2 (only enabled schedule). Contact Cashfree to enable 8/14 for faster settlement.
}

export interface CashfreeOrderStatus {
  order_id: string;
  order_status: "ACTIVE" | "PAID" | "EXPIRED" | "TERMINATED" | "TERMINATION_REQUESTED" | string;
  order_amount: number;
  cf_order_id?: string;
}

export class CashfreeError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly raw?: unknown,
  ) {
    super(message);
    this.name = "CashfreeError";
  }
}

// ==============================================
// AUTH HEADERS
// ==============================================

function getHeaders(idempotencyKey?: string, apiVersion?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "x-client-id": CF_APP_ID,
    "x-client-secret": CF_SECRET_KEY,
    "x-api-version": apiVersion ?? CF_API_VERSION,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (idempotencyKey) {
    headers["x-idempotency-key"] = idempotencyKey;
  }
  return headers;
}

// ==============================================
// HTTP HELPER
// ==============================================

async function cfFetch(
  method: string,
  path: string,
  body?: unknown,
  idempotencyKey?: string,
  apiVersion?: string,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  // Log request body with sensitive fields redacted
  if (body) {
    const redacted = JSON.parse(JSON.stringify(body));
    if (redacted?.bank?.account_number) redacted.bank.account_number = "***";
    if (redacted?.upi?.vpa) redacted.upi.vpa = "***@***";
    if (redacted?.kyc_details?.pan) redacted.kyc_details.pan = "***";
    console.log(`[cashfree] ${method} ${CF_BASE_URL}${path} body:`, JSON.stringify(redacted));
  } else {
    console.log(`[cashfree] ${method} ${CF_BASE_URL}${path}`);
  }

  let response: Response;
  try {
    response = await fetch(`${CF_BASE_URL}${path}`, {
      method,
      headers: getHeaders(idempotencyKey, apiVersion),
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new CashfreeError("Cashfree API request timed out", 0);
    }
    throw new CashfreeError(`Cashfree API network error: ${(err as Error).message}`, 0);
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!response.ok) {
    const msg = (json as Record<string, unknown>)?.message as string
      ?? (json as Record<string, unknown>)?.error as string
      ?? `HTTP ${response.status}`;
    throw new CashfreeError(msg, response.status, json);
  }

  return json;
}

// ==============================================
// 1. CREATE ORDER
// ==============================================

/**
 * Creates a Cashfree PG order for rent collection.
 * Returns order_id (cf_order_id) and payment_session_id for the SDK.
 *
 * @param amountPaise - Amount in paise
 * @param orderId     - Our internal order ID (stored as gateway_order_id)
 * @param customerId  - User UUID
 * @param customerPhone - User phone number
 * @param notifyUrl   - Webhook URL for payment events
 */
export async function createOrder(params: {
  amountPaise: number;
  orderId: string;
  customerId: string;
  customerPhone: string;
  notifyUrl: string;
  paymentMethods?: string;
  returnUrl?: string;
}): Promise<CashfreeOrder> {
  const { amountPaise, orderId, customerId, customerPhone, notifyUrl, paymentMethods, returnUrl } = params;

  const orderMeta: Record<string, string> = {
    notify_url: notifyUrl,
  };
  if (paymentMethods) orderMeta.payment_methods = paymentMethods;
  if (returnUrl) orderMeta.return_url = returnUrl;

  const body = {
    order_id: orderId,
    order_amount: parseFloat((amountPaise / 100).toFixed(2)),
    order_currency: "INR",
    customer_details: {
      customer_id: customerId,
      customer_phone: customerPhone,
    },
    order_meta: orderMeta,
  };

  const result = await cfFetch("POST", "/pg/orders", body, orderId) as CashfreeOrder;
  return result;
}

// ==============================================
// 2. CREATE VENDOR
// ==============================================

/**
 * Registers a landlord as a Cashfree Easy Split vendor.
 * Supports two paths:
 *   - Bank account: provide account_number + account_holder + ifsc
 *   - UPI VPA: provide upi_vpa (Cashfree accepts either bank or upi)
 *
 * Status will initially be IN_BENE_CREATION — sync-vendors polls until ACTIVE.
 *
 * SECURITY: account_number must be plaintext. Decrypt before calling.
 *           Never log the account_number value.
 */
export async function createVendor(input: CashfreeVendorInput): Promise<CashfreeVendor> {
  const isUpi = !!input.upi_vpa;
  const isBank = !!(input.account_number && input.ifsc);

  if (!isUpi && !isBank) {
    throw new CashfreeError(
      "Either bank details (account_number + ifsc) or upi_vpa is required to create a vendor",
      0,
    );
  }

  const body: Record<string, unknown> = {
    vendor_id: input.vendor_id,
    status: "ACTIVE",
    name: input.name,
    phone: input.phone,
    verify_account: true,
    schedule_option: input.schedule_option ?? 2, // T+2 (only enabled schedule for merchant 1215890)
  };

  if (isUpi) {
    body.upi = { vpa: input.upi_vpa, account_holder: input.name };
  } else {
    body.bank = {
      account_number: input.account_number,
      account_holder: input.account_holder ?? input.name,
      ifsc: input.ifsc,
    };
  }

  // email is required by Cashfree API — use placeholder if not provided
  body.email = input.email ?? `vendor-${input.vendor_id}@flent.app`;

  // PAN is mandatory for Individual account type — Cashfree returns 500 (not 400) if missing
  if (!input.pan) {
    throw new CashfreeError("PAN is required to register an Individual vendor in Cashfree Easy Split", 0);
  }

  body.kyc_details = {
    account_type: "Individual",
    business_type: "Real Estate, Housing, Rentals",
    pan: input.pan,
  };

  const result = await cfFetch("POST", "/pg/easy-split/vendors", body) as CashfreeVendor;
  return result;
}

// ==============================================
// 3. GET VENDOR
// ==============================================

/**
 * Fetches the current status of a registered Cashfree vendor.
 * Used by sync-vendors to check if a vendor has become ACTIVE.
 */
export async function getVendor(vendorId: string): Promise<CashfreeVendor> {
  const result = await cfFetch("GET", `/pg/easy-split/vendors/${encodeURIComponent(vendorId)}`) as CashfreeVendor;
  return result;
}

// ==============================================
// 3b. UPDATE VENDOR
// ==============================================

/**
 * Updates an existing Cashfree Easy Split vendor.
 * Use to change settlement schedule, bank/UPI details, or KYC.
 */
export async function updateVendor(
  vendorId: string,
  updates: {
    schedule_option?: number;
    name?: string;
    email?: string;
    phone?: string;
    upi_vpa?: string;
    account_number?: string;
    account_holder?: string;
    ifsc?: string;
    pan?: string;
  },
): Promise<CashfreeVendor> {
  const body: Record<string, unknown> = {};

  if (updates.schedule_option !== undefined) body.schedule_option = updates.schedule_option;
  if (updates.name) body.name = updates.name;
  if (updates.email) body.email = updates.email;
  if (updates.phone) body.phone = updates.phone;

  if (updates.upi_vpa) {
    body.upi = { vpa: updates.upi_vpa, account_holder: updates.name };
  } else if (updates.account_number && updates.ifsc) {
    body.bank = {
      account_number: updates.account_number,
      account_holder: updates.account_holder ?? updates.name,
      ifsc: updates.ifsc,
    };
  }

  if (updates.pan) {
    body.kyc_details = {
      account_type: "Individual",
      business_type: "Real Estate, Housing, Rentals",
      pan: updates.pan,
    };
  }

  const result = await cfFetch(
    "PATCH",
    `/pg/easy-split/vendors/${encodeURIComponent(vendorId)}`,
    body,
  ) as CashfreeVendor;
  return result;
}

// ==============================================
// 4. CREATE ADJUSTMENT (MERCHANT → VENDOR LEDGER)
// ==============================================

/**
 * Credits funds from merchant ledger to vendor ledger on Cashfree.
 * Cashfree then auto-settles vendor balance to their bank on the vendor's
 * schedule (Instant Settlement = 1 hour).
 *
 * Uses API version 2023-08-01 (only version where this endpoint exists).
 *
 * @param vendorId    - Cashfree vendor_id (bank_accounts.cf_beneficiary_id)
 * @param amountPaise - Amount to credit to vendor in paise
 * @param paymentId   - Our payment UUID (used for idempotency + remarks)
 * @param remark      - Optional description
 */
const CF_ADJUSTMENT_API_VERSION = "2023-08-01";

export interface AdjustmentResult {
  message: string;
  status: string;
  adjustment_id?: number;
}

export async function createAdjustment(params: {
  vendorId: string;
  amountPaise: number;
  paymentId: string;
  remark?: string;
}): Promise<AdjustmentResult> {
  const { vendorId, amountPaise, paymentId, remark } = params;

  if (amountPaise <= 0) {
    throw new CashfreeError("Adjustment amount must be greater than 0", 0);
  }

  // adjustment_id is a long (number) — derive from paymentId UUID by hashing to a numeric value
  // Use last 15 digits of a numeric hash to stay within safe integer range
  const hashNum = Array.from(new TextEncoder().encode(paymentId))
    .reduce((acc, byte) => (acc * 31 + byte) % 999_999_999_999_999, 0);
  const adjustmentId = hashNum || Date.now(); // fallback to timestamp if hash is 0

  const body = {
    adjustment_id: adjustmentId,
    vendor_id: vendorId,
    amount: parseFloat((amountPaise / 100).toFixed(2)),
    type: "CREDIT",
    remarks: remark ?? `Rent settlement - ${paymentId}`,
  };

  const result = await cfFetch(
    "POST",
    `/pg/easy-split/vendors/${encodeURIComponent(vendorId)}/adjustment`,
    body,
    `adj-${paymentId}`,
    CF_ADJUSTMENT_API_VERSION,
  ) as AdjustmentResult;

  // Attach the adjustment_id so caller can store it for settlement webhook matching
  result.adjustment_id = adjustmentId;
  return result;
}

// ==============================================
// 5. CREATE REFUND (REFUND PAYMENT TO CUSTOMER)
// ==============================================

/**
 * Initiates a refund for a Cashfree PG payment via the order_id.
 * Used when settlement to landlord fails after 36 hours.
 *
 * When Easy Split is active, use refund_splits to specify how much to
 * debit from each vendor vs merchant balance.
 *
 * @param orderId     - Cashfree order_id (cf_order_id or gateway_order_id)
 * @param amountPaise - Refund amount in paise
 * @param refundId    - Unique refund identifier
 * @param note        - Refund reason/note
 * @param vendorId    - Optional: vendor to debit via refund_splits
 * @param vendorAmount - Optional: amount in rupees to debit from vendor
 */
export interface CashfreeRefundResult {
  cf_payment_id?: string;
  cf_refund_id?: string;
  refund_id: string;
  order_id: string;
  refund_amount: number;
  refund_status: "SUCCESS" | "PENDING" | "CANCELLED" | "ONHOLD" | string;
  refund_arn?: string;
  refund_note?: string;
  status_description?: string;
  created_at?: string;
  processed_at?: string;
}

export async function createRefund(params: {
  orderId: string;
  amountPaise: number;
  refundId: string;
  note?: string;
  vendorId?: string;
  vendorAmountPaise?: number;
}): Promise<CashfreeRefundResult> {
  const { orderId, amountPaise, refundId, note, vendorId, vendorAmountPaise } = params;

  if (amountPaise <= 0) {
    throw new CashfreeError("Refund amount must be greater than 0", 0);
  }

  // Cashfree limits: refund_id = 3-40 chars alphanumeric/underscore, refund_note = max 100 chars
  const safeRefundId = refundId.replace(/-/g, "_").slice(0, 40);
  const safeNote = (note ?? "Settlement failed - automatic refund").slice(0, 100);

  const body: Record<string, unknown> = {
    refund_amount: parseFloat((amountPaise / 100).toFixed(2)),
    refund_id: safeRefundId,
    refund_note: safeNote,
    refund_speed: "STANDARD",
  };

  if (vendorId && vendorAmountPaise) {
    body.refund_splits = [{
      vendor_id: vendorId,
      amount: parseFloat((vendorAmountPaise / 100).toFixed(2)),
    }];
  }

  const result = await cfFetch(
    "POST",
    `/pg/orders/${encodeURIComponent(orderId)}/refunds`,
    body,
    `refund-${refundId}`,
  ) as CashfreeRefundResult;

  return result;
}

// ==============================================
// 6. GET ORDER PAYMENT STATUS
// ==============================================

/**
 * Fetches the current status of a Cashfree PG order.
 * Used by poll-settlement-status to reconcile stuck payments.
 */
export async function getOrderPaymentStatus(cfOrderId: string): Promise<CashfreeOrderStatus> {
  const result = await cfFetch("GET", `/pg/orders/${encodeURIComponent(cfOrderId)}`) as CashfreeOrderStatus;
  return result;
}
