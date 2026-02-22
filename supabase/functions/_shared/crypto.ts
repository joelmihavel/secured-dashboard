/**
 * Flent Secured v2 - Cryptography Helpers
 *
 * Encryption and hashing utilities for sensitive data.
 */

// ==============================================
// CONFIGURATION
// ==============================================

const ENCRYPTION_KEY = Deno.env.get("ENCRYPTION_KEY");

// ==============================================
// AES-256-GCM ENCRYPTION
// ==============================================

/**
 * Custom error for encryption failures.
 */
export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EncryptionError";
  }
}

/**
 * Encrypts sensitive data using AES-256-GCM.
 * Returns base64-encoded ciphertext with IV prepended.
 * @throws EncryptionError if ENCRYPTION_KEY is not configured
 */
export async function encrypt(plaintext: string): Promise<string> {
  if (!ENCRYPTION_KEY) {
    throw new EncryptionError(
      "ENCRYPTION_KEY environment variable is not configured. " +
      "Refusing to store sensitive data in plaintext."
    );
  }

  // Decode the base64 key
  const keyData = base64ToArrayBuffer(ENCRYPTION_KEY);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const encoder = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );

  // Combine IV + ciphertext and encode as base64
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return arrayBufferToBase64(combined.buffer);
}

/**
 * Decrypts data encrypted with encrypt().
 * @throws EncryptionError if ENCRYPTION_KEY is not configured
 */
export async function decrypt(ciphertext: string): Promise<string> {
  if (!ENCRYPTION_KEY) {
    throw new EncryptionError(
      "ENCRYPTION_KEY environment variable is not configured. " +
      "Cannot decrypt sensitive data."
    );
  }

  // Decode the base64 key
  const keyData = base64ToArrayBuffer(ENCRYPTION_KEY);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  // Decode the combined IV + ciphertext
  const combined = new Uint8Array(base64ToArrayBuffer(ciphertext));

  // Extract IV and ciphertext
  const iv = combined.slice(0, 12);
  const encryptedData = combined.slice(12);

  // Decrypt
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encryptedData
  );

  const decoder = new TextDecoder();
  return decoder.decode(plaintext);
}

// ==============================================
// HASHING
// ==============================================

/**
 * Computes SHA-256 hash of input string.
 */
export async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return arrayBufferToHex(hashBuffer);
}

/**
 * Computes SHA-512 hash of input string.
 */
export async function sha512(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-512", data);
  return arrayBufferToHex(hashBuffer);
}

/**
 * Computes HMAC-SHA256.
 */
export async function hmacSha256(
  message: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message)
  );

  return arrayBufferToHex(signature);
}

/**
 * Computes HMAC-SHA512.
 */
export async function hmacSha512(
  message: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message)
  );

  return arrayBufferToHex(signature);
}

// ==============================================
// PAYU HASH GENERATION
// ==============================================

/**
 * Generates PayU hash for payment initiation.
 * Formula: sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt)
 */
export async function generatePayUHash(params: {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  salt: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
}): Promise<string> {
  const {
    key,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    salt,
    udf1 = "",
    udf2 = "",
    udf3 = "",
    udf4 = "",
    udf5 = "",
  } = params;

  const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${salt}`;

  return sha512(hashString);
}

/**
 * Verifies PayU webhook hash.
 * Formula: sha512(salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
 */
export async function verifyPayUWebhookHash(params: {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  status: string;
  salt: string;
  hash: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
}): Promise<boolean> {
  const {
    key,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    status,
    salt,
    hash,
    udf1 = "",
    udf2 = "",
    udf3 = "",
    udf4 = "",
    udf5 = "",
  } = params;

  // Reverse hash for verification
  const hashString = `${salt}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;

  const computedHash = await sha512(hashString);
  return timingSafeCompare(computedHash, hash);
}

/**
 * Timing-safe string comparison to prevent timing attacks on hash verification.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBuf = encoder.encode(a.toLowerCase());
  const bBuf = encoder.encode(b.toLowerCase());
  if (aBuf.length !== bBuf.length) return false;
  try {
    return crypto.subtle.timingSafeEqual(aBuf, bBuf);
  } catch {
    // Fallback: constant-time comparison
    let result = 0;
    for (let i = 0; i < aBuf.length; i++) {
      result |= aBuf[i] ^ bBuf[i];
    }
    return result === 0;
  }
}

/**
 * Verifies PayU webhook hash when additional_charges are present.
 * Formula with additional_charges:
 * sha512(additionalCharges|salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
 */
export async function verifyPayUWebhookHashWithCharges(params: {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  status: string;
  salt: string;
  hash: string;
  additionalCharges?: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
}): Promise<boolean> {
  const { additionalCharges, ...baseParams } = params;

  if (additionalCharges && parseFloat(additionalCharges) > 0) {
    const hashString = `${additionalCharges}|${baseParams.salt}|${baseParams.status}||||||${baseParams.udf5 ?? ""}|${baseParams.udf4 ?? ""}|${baseParams.udf3 ?? ""}|${baseParams.udf2 ?? ""}|${baseParams.udf1 ?? ""}|${baseParams.email}|${baseParams.firstname}|${baseParams.productinfo}|${baseParams.amount}|${baseParams.txnid}|${baseParams.key}`;
    const computedHash = await sha512(hashString);
    return timingSafeCompare(computedHash, baseParams.hash);
  }

  return verifyPayUWebhookHash(baseParams);
}

/**
 * Generates a hash for PayU SDK commands.
 * Formula: sha512(key|command|var1|salt)
 */
export async function generateSDKHash(params: {
  key: string;
  salt: string;
  command: string;
  var1: string;
}): Promise<string> {
  const hashString = `${params.key}|${params.command}|${params.var1}|${params.salt}`;
  return sha512(hashString);
}

// ==============================================
// UTILITY FUNCTIONS
// ==============================================

/**
 * Converts ArrayBuffer to hex string.
 */
function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Converts ArrayBuffer to base64 string.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts base64 string to ArrayBuffer.
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generates a secure random string.
 */
export function generateSecureRandom(length = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return arrayBufferToHex(bytes.buffer).slice(0, length);
}

/**
 * Generates a transaction ID.
 */
export function generateTransactionId(prefix = "TXN"): string {
  const timestamp = Date.now().toString(36);
  const random = generateSecureRandom(8);
  return `${prefix}${timestamp}${random}`.toUpperCase();
}
