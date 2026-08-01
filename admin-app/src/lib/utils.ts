import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(paise: number | null | undefined): string {
  if (paise == null) return "—";
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

export function formatCurrencyShort(paise: number | null | undefined): string {
  if (paise == null) return "—";
  const rupees = paise / 100;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(0)}K`;
  return `₹${rupees}`;
}

/**
 * Mask a phone for admin display. Output shape: "<+CC> <head>XX <last4>".
 *
 * Two storage shapes are supported because we have both:
 *   1. E.164 (auth.users.phone, payments.user_phone): "+919876543210". The
 *      country code is embedded — countryCode arg is ignored.
 *   2. Local subscriber digits + separate country code (tenancies.landlord_phone
 *      paired with tenancies.country_code): "9876543210" + "+91". countryCode
 *      MUST be passed; the function never assumes +91, because Indian tenants
 *      frequently have NRI landlords (+1, +44, +61, +971, ...).
 *
 * When phone has no leading '+' and no countryCode is supplied, the country
 * code is omitted from the output rather than guessed — surfacing the missing
 * data to the admin instead of mis-attributing a number to India.
 */
export function maskPhone(
  phone: string | null | undefined,
  countryCode?: string | null,
): string {
  if (!phone) return "—";
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 6) return trimmed || "—";

  let cc: string;
  let subscriber: string;
  if (trimmed.startsWith("+") && digits.length > 10) {
    // Embedded E.164 — split off the last 10 as subscriber, the rest as CC.
    cc = `+${digits.slice(0, digits.length - 10)}`;
    subscriber = digits.slice(-10);
  } else {
    cc = countryCode?.trim() || "";
    if (cc && !cc.startsWith("+")) cc = `+${cc}`;
    subscriber = digits;
  }

  const formatted = subscriber.length === 10
    ? `${subscriber.slice(0, 5)} ${subscriber.slice(5)}`
    : subscriber;
  return cc ? `${cc} ${formatted}` : formatted;
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}

export function formatRelativeTime(date: string | null | undefined): string {
  if (!date) return "—";
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(date);
}

export function formatTAT(date: string | null | undefined): string {
  if (!date) return "—";
  const diffMs = Date.now() - new Date(date).getTime();
  if (diffMs < 0) return "—";
  const diffHr = Math.floor(diffMs / 3600000);
  if (diffHr < 1) return "<1h";
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w`;
  return `${Math.floor(diffDay / 30)}mo`;
}

export function tatColor(date: string | null | undefined): string {
  if (!date) return "text-muted-foreground/30";
  const diffDay = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (diffDay <= 2) return "text-success";
  if (diffDay <= 7) return "text-warning";
  return "text-destructive";
}

/**
 * Normalise `extracted_rental_info.extraction_confidence` to a 0..100 percent.
 *
 * The column is DECIMAL(5,4) — it stores a 0..1 fraction (0.9500 = 95%), and
 * the DB rejects anything >= 10. Every consumer in this app previously read it
 * as if it were already a percent, which made a 95% extraction render as
 * "0.95%" and fall below every `>= 70` threshold, so good extractions showed
 * as failing. Route all reads through this helper.
 *
 * Values > 1 are treated as already-percent so any legacy 0..100 rows (or a
 * future column change) degrade gracefully instead of reporting 9500%.
 */
export function confidencePercent(
  confidence: number | null | undefined,
): number | null {
  if (confidence == null) return null;
  return Math.round(confidence > 1 ? confidence : confidence * 100);
}
