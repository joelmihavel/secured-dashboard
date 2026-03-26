/**
 * Flent Secured v2 - Cashfree Easy Split Shared Module
 *
 * Wraps the Cashfree PG + Easy Split APIs:
 *   - createOrder()           POST /pg/orders
 *   - createVendor()          POST /pg/easy-split/vendors
 *   - getVendor()             GET  /pg/easy-split/vendors/{vendor_id}
 *   - onDemandTransfer()      POST /pg/easy-split/vendors/{vendor_id}/transfer
 *   - getOrderPaymentStatus() GET  /pg/orders/{order_id}
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
  account_number: string; // plaintext — decrypt before passing
  account_holder: string;
  ifsc: string;
  pan?: string;
  schedule_option?: number; // 1=T+1, 2=T+2, 7=weekly. Default: 1
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

function getHeaders(idempotencyKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "x-client-id": CF_APP_ID,
    "x-client-secret": CF_SECRET_KEY,
    "x-api-version": CF_API_VERSION,
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
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  // Log request body with sensitive fields redacted
  if (body) {
    const redacted = JSON.parse(JSON.stringify(body));
    if (redacted?.bank?.account_number) redacted.bank.account_number = "***";
    if (redacted?.kyc_details?.pan) redacted.kyc_details.pan = "***";
    console.log(`[cashfree] ${method} ${CF_BASE_URL}${path} body:`, JSON.stringify(redacted));
  } else {
    console.log(`[cashfree] ${method} ${CF_BASE_URL}${path}`);
  }

  let response: Response;
  try {
    response = await fetch(`${CF_BASE_URL}${path}`, {
      method,
      headers: getHeaders(idempotencyKey),
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
 * Registers a landlord bank account as a Cashfree Easy Split vendor.
 * Status will initially be IN_BENE_CREATION — sync-vendors polls until ACTIVE.
 *
 * SECURITY: account_number must be plaintext. Decrypt before calling.
 *           Never log the account_number value.
 */
export async function createVendor(input: CashfreeVendorInput): Promise<CashfreeVendor> {
  const body: Record<string, unknown> = {
    vendor_id: input.vendor_id,
    status: "ACTIVE",
    name: input.name,
    phone: input.phone,
    verify_account: true, // penny-drop verification required in production
    schedule_option: input.schedule_option ?? 2, // T+2 (T+1 not enabled for this merchant)
    bank: {
      account_number: input.account_number,
      account_holder: input.account_holder,
      ifsc: input.ifsc,
    },
  };

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
// 4. ON-DEMAND TRANSFER (MERCHANT → VENDOR)
// ==============================================

/**
 * Transfers funds from merchant's unsettled balance to a vendor.
 * Not tied to any specific order — draws from aggregate merchant balance.
 *
 * Use case: Landlord receives full rent even when customer paid a discounted amount.
 * Merchant tops up Cashfree balance manually to cover the difference.
 *
 * Requires: vendor status = ACTIVE, sufficient merchant balance.
 *
 * @param vendorId    - Cashfree vendor_id (bank_accounts.cf_beneficiary_id)
 * @param amountPaise - Full rent amount to transfer to landlord
 * @param paymentId   - Our payment UUID (used as idempotency key)
 * @param remark      - Optional description for the transfer
 */
export interface OnDemandTransferResult {
  settlement_id: number;
  transfer_details?: {
    vendor_id: string;
    transfer_from: string;
    transfer_type: string;
    transfer_amount: number;
    remark?: string;
    tags?: Record<string, string>;
  };
  balances?: {
    merchant_id: number;
    vendor_id: string;
    merchant_unsettled: number;
    vendor_unsettled: number;
  };
  charges?: {
    service_charges: number;
    service_tax: number;
    amount: number;
    billed_to: string;
    is_postpaid: boolean;
  };
}

export async function onDemandTransfer(params: {
  vendorId: string;
  amountPaise: number;
  paymentId: string;
  remark?: string;
}): Promise<OnDemandTransferResult> {
  const { vendorId, amountPaise, paymentId, remark } = params;

  if (amountPaise <= 0) {
    throw new CashfreeError("Transfer amount must be greater than 0", 0);
  }

  const body = {
    transfer_from: "MERCHANT",
    transfer_type: "ON_DEMAND",
    transfer_amount: parseFloat((amountPaise / 100).toFixed(2)),
    remark: remark ?? `Rent settlement - ${paymentId}`,
  };

  const result = await cfFetch(
    "POST",
    `/pg/easy-split/vendors/${encodeURIComponent(vendorId)}/transfer`,
    body,
    `odt-${paymentId}`, // deterministic idempotency key
  ) as OnDemandTransferResult;

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
