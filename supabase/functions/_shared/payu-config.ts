/**
 * Shared PayU Configuration
 *
 * Centralizes PayU credentials, URLs, and sandbox detection.
 * Import from here instead of reading env vars directly.
 */

// ── Credentials ─────────────────────────────────────────────────────────────

export const PAYU_MERCHANT_KEY = Deno.env.get("PAYU_MERCHANT_KEY") ?? "";
export const PAYU_MERCHANT_SALT = Deno.env.get("PAYU_MERCHANT_SALT") ?? "";

// ── URLs ────────────────────────────────────────────────────────────────────

/**
 * Base URL for PayU payment pages / Custom Browser.
 * Sandbox: https://test.payu.in  |  Production: https://secure.payu.in
 */
export const PAYU_BASE_URL =
  Deno.env.get("PAYU_BASE_URL") ?? "https://test.payu.in";

/**
 * Info/API URL for PayU server-to-server calls
 * (verify_payment, get_settlement_details, cancel_refund_transaction, validate_vpa, etc.)
 * Sandbox: https://test.payu.in/merchant/postservice  |  Production: https://info.payu.in/merchant/postservice
 */
export const PAYU_INFO_URL =
  Deno.env.get("PAYU_INFO_URL") ?? "https://test.payu.in/merchant/postservice";

// ── Sandbox Detection ───────────────────────────────────────────────────────

/**
 * true when running against PayU sandbox/test credentials.
 * Derived from PAYU_BASE_URL — no separate env var needed.
 */
export const IS_SANDBOX =
  PAYU_BASE_URL.includes("test") || PAYU_BASE_URL.includes("sandbox");

/**
 * PayU SDK environment value for client-side CBWrapper.
 * '1' = test/sandbox, '0' = production.
 */
export const PAYU_SDK_ENVIRONMENT: "0" | "1" = IS_SANDBOX ? "1" : "0";

// ── Timeout Helper ──────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 15_000; // 15 seconds

/**
 * fetch() with an AbortController timeout.
 * Prevents edge functions from hanging when PayU is unresponsive.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`PayU API timeout after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Validation ──────────────────────────────────────────────────────────────

/**
 * Throws at import time if PayU credentials are missing.
 * Call this at the top of any function that MUST have PayU keys.
 */
export function requirePayUCredentials(): void {
  if (!PAYU_MERCHANT_KEY || !PAYU_MERCHANT_SALT) {
    throw new Error(
      "FATAL: PayU credentials not configured. " +
      "Set PAYU_MERCHANT_KEY and PAYU_MERCHANT_SALT environment variables.",
    );
  }
}
