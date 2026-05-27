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

  const last4 = subscriber.slice(-4);
  const visibleHead = subscriber.slice(0, Math.max(0, subscriber.length - 4)).slice(0, 3);
  const masked = `${visibleHead}XX ${last4}`;
  return cc ? `${cc} ${masked}` : masked;
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
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
