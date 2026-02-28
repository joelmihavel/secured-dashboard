/**
 * Flent Secured v2 - Input Validation
 *
 * Request validation utilities for Edge Functions.
 */

import { ValidationError } from "./errors.ts";

// ==============================================
// TYPES
// ==============================================

export interface ValidationRule<T> {
  validate: (value: T) => boolean;
  message: string;
}

export interface FieldValidation {
  required?: boolean;
  type?: "string" | "number" | "boolean" | "array" | "object";
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: unknown[];
  custom?: (value: unknown) => boolean | string;
}

export type ValidationSchema = Record<string, FieldValidation>;

// ==============================================
// VALIDATION FUNCTIONS
// ==============================================

/**
 * Validates an object against a schema.
 * Throws ValidationError if validation fails.
 */
export function validateSchema<T>(
  data: unknown,
  schema: ValidationSchema,
  allowExtra = false
): T {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new ValidationError("Request body must be a JSON object");
  }

  const obj = data as Record<string, unknown>;
  const errors: Record<string, string> = {};

  // Check each field in schema
  for (const [field, rules] of Object.entries(schema)) {
    const value = obj[field];
    const error = validateField(value, field, rules);
    if (error) {
      errors[field] = error;
    }
  }

  // Check for extra fields
  if (!allowExtra) {
    for (const field of Object.keys(obj)) {
      if (!(field in schema)) {
        errors[field] = `Unknown field: ${field}`;
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError("Validation failed", errors);
  }

  return obj as T;
}

/**
 * Validates a single field value.
 */
function validateField(
  value: unknown,
  field: string,
  rules: FieldValidation
): string | null {
  // Required check
  if (rules.required && (value === undefined || value === null || value === "")) {
    return `${field} is required`;
  }

  // Skip other validations if value is not present and not required
  if (value === undefined || value === null) {
    return null;
  }

  // Type check
  if (rules.type) {
    const actualType = Array.isArray(value) ? "array" : typeof value;
    if (actualType !== rules.type) {
      return `${field} must be a ${rules.type}`;
    }
  }

  // String validations
  if (typeof value === "string") {
    if (rules.minLength && value.length < rules.minLength) {
      return `${field} must be at least ${rules.minLength} characters`;
    }
    if (rules.maxLength && value.length > rules.maxLength) {
      return `${field} must be at most ${rules.maxLength} characters`;
    }
    if (rules.pattern && !rules.pattern.test(value)) {
      return `${field} has invalid format`;
    }
  }

  // Number validations
  if (typeof value === "number") {
    if (rules.min !== undefined && value < rules.min) {
      return `${field} must be at least ${rules.min}`;
    }
    if (rules.max !== undefined && value > rules.max) {
      return `${field} must be at most ${rules.max}`;
    }
  }

  // Enum validation
  if (rules.enum && !rules.enum.includes(value)) {
    return `${field} must be one of: ${rules.enum.join(", ")}`;
  }

  // Custom validation
  if (rules.custom) {
    const result = rules.custom(value);
    if (result !== true) {
      return typeof result === "string" ? result : `${field} is invalid`;
    }
  }

  return null;
}

// ==============================================
// COMMON VALIDATORS
// ==============================================

/**
 * Validates an Indian phone number.
 */
export function isValidIndianPhone(phone: string): boolean {
  // Remove any spaces or dashes
  const cleaned = phone.replace(/[\s-]/g, "");
  // Indian mobile: 10 digits starting with 6-9, or [+]91 prefix followed by 10 digits
  return /^(\+?91)?[6-9]\d{9}$/.test(cleaned);
}

/**
 * Country-aware phone validation.
 * Validates phone number length based on country code.
 */
const COUNTRY_PHONE_LENGTH: Record<string, number> = {
  "+91": 10,   // India
  "+1": 10,    // US / Canada
  "+44": 10,   // UK
  "+971": 9,   // UAE
  "+61": 9,    // Australia
  "+65": 8,    // Singapore
  "+60": 10,   // Malaysia
  "+49": 11,   // Germany
  "+33": 9,    // France
  "+966": 9,   // Saudi Arabia
  "+974": 8,   // Qatar
  "+968": 8,   // Oman
  "+977": 10,  // Nepal
  "+94": 9,    // Sri Lanka
};

export function isValidPhone(phone: string, countryCode: string): boolean {
  const cleaned = phone.replace(/\D/g, "");
  const expectedLength = COUNTRY_PHONE_LENGTH[countryCode];
  if (expectedLength) {
    return cleaned.length === expectedLength;
  }
  // Fallback: accept 7-15 digit numbers (ITU E.164 range)
  return cleaned.length >= 7 && cleaned.length <= 15;
}

/**
 * Validates an E.164 phone number (with or without + prefix).
 * E.164: 1-3 digit country code + subscriber number, total 7-15 digits.
 */
export function isValidE164Phone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.length >= 7 && cleaned.length <= 15;
}

/**
 * Validates an IFSC code.
 */
export function isValidIfsc(ifsc: string): boolean {
  // IFSC: 4 letters (bank code) + 0 + 6 alphanumeric (branch code)
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase());
}

/**
 * Validates a PAN number.
 */
export function isValidPan(pan: string): boolean {
  // PAN: 5 letters + 4 digits + 1 letter
  return /^[A-Z]{5}\d{4}[A-Z]$/.test(pan.toUpperCase());
}

/**
 * Validates a UUID.
 */
export function isValidUuid(uuid: unknown): boolean {
  if (typeof uuid !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    uuid
  );
}

/**
 * Validates an email address.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validates amount in paise (positive integer).
 */
export function isValidAmountPaise(amount: unknown): boolean {
  return (
    typeof amount === "number" &&
    Number.isInteger(amount) &&
    amount > 0 &&
    amount <= 100_000_000_00 // Max 100 crore
  );
}

/**
 * Validates a date string (YYYY-MM-DD format).
 */
export function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Validates rent due day (1-28).
 */
export function isValidRentDueDay(day: unknown): boolean {
  return (
    typeof day === "number" &&
    Number.isInteger(day) &&
    day >= 1 &&
    day <= 28
  );
}

// ==============================================
// SANITIZATION FUNCTIONS
// ==============================================

/**
 * Sanitizes a phone number to E.164 digits (with country code, no +).
 * Examples: "+91 98765 43210" -> "919876543210", "14155551234" -> "14155551234"
 * Legacy: bare 10-digit Indian numbers -> prepends "91" for backward compat.
 */
export function sanitizePhone(phone: string): string {
  const hadPlusPrefix = phone.trimStart().startsWith("+");
  const cleaned = phone.replace(/\D/g, "");

  // Already has country code (11+ digits) -- return as-is
  if (cleaned.length >= 11) {
    return cleaned;
  }

  // If original had + prefix, the number already has a country code
  // even if total digits < 11 (e.g., Singapore +65 = 10 digits)
  if (hadPlusPrefix) {
    return cleaned;
  }

  // Legacy: bare 10-digit number starting with 6-9 -> assume Indian, prepend 91
  if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
    return `91${cleaned}`;
  }

  // Short numbers (7-10 digits from other countries) -- return as-is
  // The caller is responsible for providing E.164 format
  return cleaned;
}

/**
 * Formats a phone number to E.164 with + prefix.
 * If the phone already starts with +, normalizes it.
 * Otherwise, sanitizes and adds + prefix.
 */
export function formatPhoneWithCountryCode(phone: string): string {
  if (phone.startsWith("+")) {
    return `+${phone.replace(/\D/g, "")}`;
  }
  return `+${sanitizePhone(phone)}`;
}

/**
 * Sanitizes an IFSC code to uppercase.
 */
export function sanitizeIfsc(ifsc: string): string {
  return ifsc.toUpperCase().trim();
}

/**
 * Masks a bank account number (show last 4 digits).
 */
export function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) {
    return accountNumber;
  }
  const last4 = accountNumber.slice(-4);
  return `${"X".repeat(accountNumber.length - 4)}${last4}`;
}

/**
 * Masks an Aadhaar number (show last 4 digits).
 */
export function maskAadhaar(aadhaar: string): string {
  const cleaned = aadhaar.replace(/\D/g, "");
  if (cleaned.length !== 12) {
    return "XXXX XXXX XXXX";
  }
  return `XXXX XXXX ${cleaned.slice(-4)}`;
}

/**
 * Masks a PAN number (show first 2 and last 2 characters).
 */
export function maskPan(pan: string): string {
  if (pan.length !== 10) {
    return "XXXXX****X";
  }
  return `${pan.slice(0, 2)}${"X".repeat(6)}${pan.slice(-2)}`;
}
