/**
 * Flent Secured v2 - Cashfree Shared Utilities (Payouts Only)
 *
 * Shared HTTP client, config, and error handling for Cashfree Payouts integration.
 * Cashfree Payment Gateway code has been removed; only Payouts remain.
 */

import { AppError } from "./errors.ts";

// ==============================================
// API VERSIONS
// ==============================================

export const CF_PAYOUT_API_VERSION = "2024-01-01";

// ==============================================
// ENVIRONMENT CONFIGURATION
// ==============================================

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
 * @param baseUrl - Base URL (e.g. https://api.cashfree.com)
 * @param path - API path (e.g. /payout/beneficiary)
 * @param method - HTTP method
 * @param body - Optional request body (will be JSON-serialized)
 * @param appId - Cashfree client ID
 * @param secretKey - Cashfree client secret
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
