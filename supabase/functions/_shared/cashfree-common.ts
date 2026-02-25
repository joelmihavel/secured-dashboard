/**
 * Flent Secured v2 - Cashfree Common Utilities
 *
 * Shared HTTP client, config, error handling, and webhook verification
 * for Cashfree Payment Gateway and Payouts integration.
 */

import { AppError } from "./errors.ts";
import { timingSafeCompare, hmacSha256Base64 } from "./crypto.ts";

// ==============================================
// API VERSIONS
// ==============================================

export const CF_PG_API_VERSION = "2025-01-01";
export const CF_PAYOUT_API_VERSION = "2024-01-01";

// ==============================================
// ENVIRONMENT CONFIGURATION
// ==============================================

/**
 * Returns PG (Payment Gateway) credentials from environment.
 * @throws Error if required env vars are missing.
 */
export function getPgConfig(): {
  appId: string;
  secretKey: string;
  baseUrl: string;
} {
  const appId = Deno.env.get("CASHFREE_PG_APP_ID");
  const secretKey = Deno.env.get("CASHFREE_PG_SECRET_KEY");
  const baseUrl = Deno.env.get("CASHFREE_PG_BASE_URL");

  if (!appId || !secretKey || !baseUrl) {
    throw new Error(
      "Missing required Cashfree PG environment variables. " +
        "Ensure CASHFREE_PG_APP_ID, CASHFREE_PG_SECRET_KEY, and CASHFREE_PG_BASE_URL are set."
    );
  }

  return { appId, secretKey, baseUrl };
}

/**
 * Returns Payout credentials from environment.
 * @throws Error if required env vars are missing.
 */
export function getPayoutConfig(): {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
} {
  const clientId = Deno.env.get("CASHFREE_PAYOUT_CLIENT_ID");
  const clientSecret = Deno.env.get("CASHFREE_PAYOUT_CLIENT_SECRET");
  const baseUrl = Deno.env.get("CASHFREE_PAYOUT_BASE_URL");

  if (!clientId || !clientSecret || !baseUrl) {
    throw new Error(
      "Missing required Cashfree Payout environment variables. " +
        "Ensure CASHFREE_PAYOUT_CLIENT_ID, CASHFREE_PAYOUT_CLIENT_SECRET, and CASHFREE_PAYOUT_BASE_URL are set."
    );
  }

  return { clientId, clientSecret, baseUrl };
}

// ==============================================
// ERROR TYPES
// ==============================================

/**
 * Cashfree-specific error with additional error code and sub-type fields.
 */
export class CashfreeError extends AppError {
  public cfErrorCode: string | undefined;
  public cfErrorSubType: string | undefined;

  constructor(
    message: string,
    code: string = "CASHFREE_ERROR",
    status: number = 502,
    cfErrorCode?: string,
    cfErrorSubType?: string,
    details?: unknown
  ) {
    super(message, code, status, details);
    this.name = "CashfreeError";
    this.cfErrorCode = cfErrorCode;
    this.cfErrorSubType = cfErrorSubType;
  }
}

// ==============================================
// HTTP CLIENT
// ==============================================

/**
 * Response structure from Cashfree API calls.
 */
export interface CashfreeApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

/**
 * Makes an authenticated HTTP request to a Cashfree API endpoint.
 *
 * @param baseUrl - Base URL (e.g. https://api.cashfree.com or https://sandbox.cashfree.com/pg)
 * @param path - API path (e.g. /pg/orders)
 * @param method - HTTP method
 * @param body - Optional request body (will be JSON-serialized)
 * @param appId - Cashfree app/client ID
 * @param secretKey - Cashfree secret key
 * @param apiVersion - API version header value
 * @returns Parsed response with status
 * @throws CashfreeError on non-2xx responses
 */
export async function cashfreeRequest<T = unknown>(
  baseUrl: string,
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  body: unknown | undefined,
  appId: string,
  secretKey: string,
  apiVersion: string
): Promise<CashfreeApiResponse<T>> {
  const url = `${baseUrl.replace(/\/+$/, "")}${path}`;

  const headers: Record<string, string> = {
    "x-client-id": appId,
    "x-client-secret": secretKey,
    "x-api-version": apiVersion,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const requestId = crypto.randomUUID();
  headers["x-request-id"] = requestId;

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (body !== undefined && method !== "GET") {
    fetchOptions.body = JSON.stringify(body);
  }

  console.log(
    `[cashfree] ${method} ${path} request_id=${requestId}`
  );

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (err) {
    throw new CashfreeError(
      `Network error calling Cashfree API: ${err instanceof Error ? err.message : String(err)}`,
      "CASHFREE_NETWORK_ERROR",
      502
    );
  }

  let responseData: T;
  const responseText = await response.text();

  try {
    responseData = responseText ? JSON.parse(responseText) as T : ({} as T);
  } catch {
    throw new CashfreeError(
      `Invalid JSON response from Cashfree API: ${responseText.slice(0, 200)}`,
      "CASHFREE_PARSE_ERROR",
      502
    );
  }

  if (!response.ok) {
    const errorBody = responseData as Record<string, unknown>;
    const cfMessage = (errorBody?.message as string) ?? response.statusText;
    const cfCode = errorBody?.code as string | undefined;
    const cfType = errorBody?.type as string | undefined;

    console.error(
      `[cashfree] ${method} ${path} failed status=${response.status} code=${cfCode} type=${cfType} message=${cfMessage}`
    );

    throw new CashfreeError(
      `Cashfree API error: ${cfMessage}`,
      "CASHFREE_API_ERROR",
      response.status >= 500 ? 502 : response.status,
      cfCode,
      cfType,
      errorBody
    );
  }

  console.log(
    `[cashfree] ${method} ${path} success status=${response.status}`
  );

  return {
    ok: true,
    status: response.status,
    data: responseData,
  };
}

// ==============================================
// WEBHOOK VERIFICATION
// ==============================================

/** Maximum allowed age of a webhook timestamp (5 minutes). */
const WEBHOOK_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Verifies a Cashfree webhook signature using HMAC-SHA256 with Base64 output.
 *
 * Cashfree sends:
 * - `x-webhook-timestamp` header
 * - `x-webhook-signature` header (Base64-encoded HMAC-SHA256)
 *
 * The HMAC input is: `timestamp + rawBody`
 * The secret is the PG client secret.
 *
 * @param rawBody - The raw request body string
 * @param timestamp - The x-webhook-timestamp header value
 * @param signature - The x-webhook-signature header value (Base64)
 * @param clientSecret - Cashfree PG secret key
 * @returns true if signature is valid and timestamp is within tolerance
 * @throws CashfreeError if timestamp is too old or missing
 */
export async function verifyCashfreeWebhookSignature(
  rawBody: string,
  timestamp: string,
  signature: string,
  clientSecret: string
): Promise<boolean> {
  // Validate timestamp is present
  if (!timestamp || !signature) {
    throw new CashfreeError(
      "Missing webhook timestamp or signature",
      "CASHFREE_WEBHOOK_INVALID",
      400
    );
  }

  // Validate timestamp is within tolerance window (5 minutes)
  const webhookTime = parseInt(timestamp, 10);
  if (isNaN(webhookTime)) {
    throw new CashfreeError(
      "Invalid webhook timestamp format",
      "CASHFREE_WEBHOOK_INVALID",
      400
    );
  }

  const now = Date.now();
  // Cashfree may send timestamp in seconds or milliseconds.
  // If < 1e12 it is seconds (10-digit epoch); convert to ms.
  const webhookTimeMs = webhookTime < 1e12 ? webhookTime * 1000 : webhookTime;
  const ageMs = Math.abs(now - webhookTimeMs);

  if (ageMs > WEBHOOK_TIMESTAMP_TOLERANCE_MS) {
    throw new CashfreeError(
      `Webhook timestamp too old: ${ageMs}ms (max ${WEBHOOK_TIMESTAMP_TOLERANCE_MS}ms)`,
      "CASHFREE_WEBHOOK_EXPIRED",
      400
    );
  }

  // Compute HMAC-SHA256 of (timestamp + rawBody) with Base64 output
  const computedSignature = await hmacSha256Base64(timestamp + rawBody, clientSecret);

  // Timing-safe comparison to prevent timing attacks
  return timingSafeCompare(computedSignature, signature);
}
