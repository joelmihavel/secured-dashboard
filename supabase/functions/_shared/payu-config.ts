/**
 * Shared PayU Configuration
 *
 * Centralizes PayU credentials, URLs, and sandbox detection.
 * Import from here instead of reading env vars directly.
 */

// ── Credentials ─────────────────────────────────────────────────────────────

export const PAYU_MERCHANT_KEY = (Deno.env.get("PAYU_MERCHANT_KEY") ?? "").trim();
export const PAYU_MERCHANT_SALT = (Deno.env.get("PAYU_MERCHANT_SALT") ?? "").trim();

// OAuth credentials for PayU REST API (refunds, settlements, etc.)
export const PAYU_CLIENT_ID = (Deno.env.get("PAYU_CLIENT_ID") ?? "").trim();
export const PAYU_CLIENT_SECRET = (Deno.env.get("PAYU_CLIENT_SECRET") ?? "").trim();

// ── URLs ────────────────────────────────────────────────────────────────────

/**
 * Base URL for PayU payment pages / Custom Browser.
 * Production: https://secure.payu.in  |  Sandbox: https://test.payu.in
 */
export const PAYU_BASE_URL =
  (Deno.env.get("PAYU_BASE_URL") ?? "https://secure.payu.in").trim();

/**
 * Info/API URL for PayU server-to-server calls
 * (verify_payment, get_settlement_details, cancel_refund_transaction, validate_vpa, etc.)
 * Production: https://info.payu.in/merchant/postservice  |  Sandbox: https://test.payu.in/merchant/postservice
 */
export const PAYU_INFO_URL =
  Deno.env.get("PAYU_INFO_URL") ?? "https://info.payu.in/merchant/postservice";

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

// ── PayU Response Parsing ─────────────────────────────────────────────────

/**
 * Parse a PayU API response that may be JSON or PHP-serialized.
 * PayU production endpoints return PHP-serialized strings like:
 *   a:4:{s:6:"status";s:7:"SUCCESS";s:3:"vpa";s:16:"9099926845@ptsbi";...}
 * Some sandbox endpoints return JSON.
 */
export function parsePayUResponse(text: string): Record<string, unknown> {
  const trimmed = text.trim();

  // Try JSON first
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Fall through to PHP parser
    }
  }

  // PHP-serialized flat array: a:N:{...}
  if (trimmed.startsWith("a:")) {
    return parsePhpSerializedFlat(trimmed);
  }

  throw new Error(`PayU response is neither JSON nor PHP-serialized: ${trimmed.slice(0, 100)}`);
}

/**
 * Length-delimited PHP serialized parser for flat key-value arrays.
 * Handles s:LEN:"VALUE" (strings) and i:VALUE (integers).
 * Uses byte-aware extraction (PHP s:LEN uses byte length, not char length).
 */
function parsePhpSerializedFlat(raw: string): Record<string, unknown> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const bytes = encoder.encode(raw);
  const result: Record<string, unknown> = {};

  // Find the opening { after a:N:
  let pos = 0;
  while (pos < bytes.length && bytes[pos] !== 0x7B /* { */) pos++;
  pos++; // skip {

  while (pos < bytes.length) {
    // Skip whitespace
    while (pos < bytes.length && (bytes[pos] === 0x20 || bytes[pos] === 0x0A)) pos++;

    // Check for closing }
    if (pos >= bytes.length || bytes[pos] === 0x7D /* } */) break;

    // Read key (must be a string: s:LEN:"KEY";)
    const key = readPhpValue(bytes, pos, decoder);
    if (key === null) break;
    pos = key.nextPos;

    // Read value
    const val = readPhpValue(bytes, pos, decoder);
    if (val === null) break;
    pos = val.nextPos;

    if (typeof key.value === "string") {
      result[key.value] = val.value;
    }
  }

  return result;
}

function readPhpValue(
  bytes: Uint8Array,
  pos: number,
  decoder: TextDecoder,
): { value: string | number | boolean; nextPos: number } | null {
  if (pos >= bytes.length) return null;

  const typeChar = decoder.decode(bytes.slice(pos, pos + 1));

  if (typeChar === "s") {
    // String: s:LEN:"VALUE";
    // Find the colon after 's'
    pos++; // skip 's'
    if (bytes[pos] !== 0x3A /* : */) return null;
    pos++; // skip ':'

    // Read length number
    let lenStr = "";
    while (pos < bytes.length && bytes[pos] !== 0x3A /* : */) {
      lenStr += decoder.decode(bytes.slice(pos, pos + 1));
      pos++;
    }
    pos++; // skip ':'

    const byteLen = parseInt(lenStr, 10);
    if (isNaN(byteLen)) return null;

    // Skip opening quote
    if (bytes[pos] !== 0x22 /* " */) return null;
    pos++; // skip '"'

    // Read exactly byteLen bytes
    const valueBytes = bytes.slice(pos, pos + byteLen);
    const value = decoder.decode(valueBytes);
    pos += byteLen;

    // Skip closing quote and semicolon: ";
    if (bytes[pos] === 0x22 /* " */) pos++;
    if (bytes[pos] === 0x3B /* ; */) pos++;

    return { value, nextPos: pos };
  }

  if (typeChar === "i") {
    // Integer: i:VALUE;
    pos++; // skip 'i'
    if (bytes[pos] !== 0x3A /* : */) return null;
    pos++; // skip ':'

    let numStr = "";
    while (pos < bytes.length && bytes[pos] !== 0x3B /* ; */) {
      numStr += decoder.decode(bytes.slice(pos, pos + 1));
      pos++;
    }
    pos++; // skip ';'

    return { value: parseInt(numStr, 10), nextPos: pos };
  }

  if (typeChar === "b") {
    // Boolean: b:0; or b:1;
    pos++; // skip 'b'
    if (bytes[pos] !== 0x3A /* : */) return null;
    pos++; // skip ':'

    const boolVal = bytes[pos] === 0x31; // '1' = true
    pos++; // skip value
    if (bytes[pos] === 0x3B /* ; */) pos++;

    return { value: boolVal, nextPos: pos };
  }

  // Unknown type — skip to next semicolon
  while (pos < bytes.length && bytes[pos] !== 0x3B) pos++;
  pos++;
  return null;
}

// ── PayU VPA Validation ───────────────────────────────────────────────────

import { sha512 } from "./crypto.ts";
import { ExternalServiceError } from "./errors.ts";

export interface VpaValidationResult {
  status: "VALID" | "INVALID";
  name_at_bank: string | null;
  bank_account: null;
  ifsc: null;
  utr: null;
  ifsc_details: null;
  message: string;
}

const NA_NAMES = new Set(["NA", "N/A", "na", "n/a", ""]);

/**
 * Validate a UPI VPA via PayU's validateVpa command.
 * Returns the same interface as the old Cashfree UPI penny drop for drop-in replacement.
 */
export async function callPayUValidateVpa(vpa: string): Promise<VpaValidationResult> {
  if (!PAYU_MERCHANT_KEY || !PAYU_MERCHANT_SALT) {
    throw new ExternalServiceError(
      "PayU",
      "PayU credentials not configured (PAYU_MERCHANT_KEY / PAYU_MERCHANT_SALT)",
      "CONFIG_ERROR",
    );
  }

  const command = "validateVpa";
  const hashInput = `${PAYU_MERCHANT_KEY}|${command}|${vpa}|${PAYU_MERCHANT_SALT}`;
  const hash = await sha512(hashInput);

  const formData = new URLSearchParams();
  formData.set("key", PAYU_MERCHANT_KEY);
  formData.set("command", command);
  formData.set("var1", vpa);
  formData.set("hash", hash);

  let response: Response;
  try {
    response = await fetchWithTimeout(PAYU_INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });
  } catch (err) {
    throw new ExternalServiceError(
      "PayU",
      err instanceof Error ? err.message : "Network error",
      "NETWORK_ERROR",
      err instanceof Error ? err : undefined,
    );
  }

  if (!response.ok) {
    throw new ExternalServiceError(
      "PayU",
      `HTTP ${response.status}: ${response.statusText}`,
      "HTTP_ERROR",
    );
  }

  const rawText = await response.text();
  let parsed: Record<string, unknown>;
  try {
    parsed = parsePayUResponse(rawText);
  } catch (err) {
    throw new ExternalServiceError(
      "PayU",
      `Failed to parse response: ${rawText.slice(0, 200)}`,
      "PARSE_ERROR",
      err instanceof Error ? err : undefined,
    );
  }

  // Guard: PayU returns status=SUCCESS for valid API calls, ERROR for bad hash/config
  const payuStatus = String(parsed.status ?? "").toUpperCase();
  if (payuStatus !== "SUCCESS") {
    throw new ExternalServiceError(
      "PayU",
      String(parsed.message ?? parsed.msg ?? `Unexpected status: ${payuStatus}`),
      "API_ERROR",
    );
  }

  const isValid = parsed.isVPAValid === 1 || parsed.isVPAValid === "1";
  const rawName = String(parsed.payerAccountName ?? "").trim();
  const nameAtBank = NA_NAMES.has(rawName) ? null : rawName || null;

  return {
    status: isValid ? "VALID" : "INVALID",
    name_at_bank: nameAtBank,
    bank_account: null,
    ifsc: null,
    utr: null,
    ifsc_details: null,
    message: isValid ? "VPA validated successfully" : "Invalid VPA",
  };
}
