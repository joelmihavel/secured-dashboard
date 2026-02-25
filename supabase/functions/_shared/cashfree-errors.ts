/**
 * Flent Secured v2 - Cashfree Error and Status Mapping
 *
 * Maps Cashfree payment, order, and refund statuses to internal statuses.
 * Provides user-friendly error message mapping from Cashfree error codes.
 *
 * Reference: https://docs.cashfree.com/docs/webhooks
 *            https://docs.cashfree.com/docs/resources-error-codes
 */

// ==============================================
// PAYMENT STATUS MAPPING
// ==============================================

/**
 * Maps Cashfree PG payment_status to internal payment status.
 *
 * Cashfree payment statuses:
 * - SUCCESS: Payment completed successfully
 * - FAILED: Payment failed (bank decline, insufficient funds, etc.)
 * - CANCELLED: Payment cancelled by the customer
 * - USER_DROPPED: Customer abandoned the payment page
 * - PENDING: Payment is being processed
 * - NOT_ATTEMPTED: Payment session created but no attempt made
 * - VOID: Payment was voided (pre-settlement reversal)
 */
export const CF_STATUS_MAP: Record<string, string> = {
  SUCCESS: "success",
  FAILED: "failed",
  CANCELLED: "failed",
  USER_DROPPED: "failed",
  PENDING: "processing",
  NOT_ATTEMPTED: "initiated",
  VOID: "failed",
};

// ==============================================
// ORDER STATUS MAPPING
// ==============================================

/**
 * Maps Cashfree PG order_status to internal order status.
 *
 * Cashfree order statuses:
 * - PAID: At least one successful payment against this order
 * - ACTIVE: Order is active and accepting payments
 * - EXPIRED: Order expired without successful payment
 * - TERMINATED: Order was terminated (manually or by system)
 */
export const CF_ORDER_STATUS_MAP: Record<string, string> = {
  PAID: "success",
  ACTIVE: "pending",
  EXPIRED: "expired",
  TERMINATED: "failed",
};

// ==============================================
// REFUND STATUS MAPPING
// ==============================================

/**
 * Maps Cashfree PG refund_status to internal refund status.
 *
 * Cashfree refund statuses:
 * - SUCCESS: Refund processed and credited to customer
 * - PENDING: Refund is being processed
 * - ONHOLD: Refund is on hold (requires manual review)
 * - CANCELLED: Refund was cancelled
 */
export const CF_REFUND_STATUS_MAP: Record<string, string> = {
  SUCCESS: "completed",
  PENDING: "processing",
  ONHOLD: "processing",
  CANCELLED: "failed",
};

// ==============================================
// PAYOUT TRANSFER STATUS MAPPING
// ==============================================

/**
 * Maps Cashfree Payout transfer_status to internal payout status.
 */
export const CF_PAYOUT_STATUS_MAP: Record<string, string> = {
  SUCCESS: "completed",
  PENDING: "processing",
  FAILED: "failed",
  REVERSED: "reversed",
  REJECTED: "failed",
  ERROR: "failed",
};

// ==============================================
// WEBHOOK EVENT TYPES
// ==============================================

/**
 * Known Cashfree webhook event types.
 */
export const CF_WEBHOOK_EVENTS = {
  PAYMENT_SUCCESS: "PAYMENT_SUCCESS_WEBHOOK",
  PAYMENT_FAILED: "PAYMENT_FAILED_WEBHOOK",
  PAYMENT_USER_DROPPED: "PAYMENT_USER_DROPPED_WEBHOOK",
  REFUND_STATUS: "REFUND_STATUS_WEBHOOK",
  SETTLEMENT: "SETTLEMENT_WEBHOOK",
} as const;

// ==============================================
// ERROR MAPPING
// ==============================================

/** Structured error info returned by mapCashfreeError. */
export interface MappedCashfreeError {
  /** Internal error code for the app. */
  code: string;
  /** User-friendly error message safe to display in the UI. */
  message: string;
  /** Whether the operation can be retried. */
  isRetryable: boolean;
}

/**
 * Known Cashfree error codes and their user-friendly mappings.
 */
const CF_ERROR_MAP: Record<
  string,
  { code: string; message: string; isRetryable: boolean }
> = {
  // Authentication errors
  authentication_failed: {
    code: "PAYMENT_AUTH_FAILED",
    message: "Payment service authentication failed. Please try again later.",
    isRetryable: false,
  },
  // Order errors
  order_id_already_exists: {
    code: "PAYMENT_DUPLICATE_ORDER",
    message: "This payment has already been initiated. Please check your payment history.",
    isRetryable: false,
  },
  order_not_found: {
    code: "PAYMENT_ORDER_NOT_FOUND",
    message: "Payment order not found. Please initiate a new payment.",
    isRetryable: false,
  },
  order_expired: {
    code: "PAYMENT_ORDER_EXPIRED",
    message: "Payment session has expired. Please start a new payment.",
    isRetryable: true,
  },
  // Payment errors
  insufficient_balance: {
    code: "PAYMENT_INSUFFICIENT_FUNDS",
    message: "Insufficient balance in your account. Please try a different payment method.",
    isRetryable: true,
  },
  transaction_declined: {
    code: "PAYMENT_DECLINED",
    message: "Transaction was declined by your bank. Please try again or use a different payment method.",
    isRetryable: true,
  },
  bank_not_available: {
    code: "PAYMENT_BANK_UNAVAILABLE",
    message: "Your bank is currently unavailable. Please try again in some time.",
    isRetryable: true,
  },
  card_declined: {
    code: "PAYMENT_CARD_DECLINED",
    message: "Your card was declined. Please check your card details or try a different card.",
    isRetryable: true,
  },
  invalid_card_number: {
    code: "PAYMENT_INVALID_CARD",
    message: "Invalid card number. Please check and try again.",
    isRetryable: false,
  },
  card_expired: {
    code: "PAYMENT_CARD_EXPIRED",
    message: "Your card has expired. Please use a different card.",
    isRetryable: false,
  },
  // UPI errors
  upi_collect_expired: {
    code: "PAYMENT_UPI_EXPIRED",
    message: "UPI payment request expired. Please try again.",
    isRetryable: true,
  },
  upi_invalid_vpa: {
    code: "PAYMENT_INVALID_VPA",
    message: "Invalid UPI ID. Please check and try again.",
    isRetryable: false,
  },
  upi_transaction_failed: {
    code: "PAYMENT_UPI_FAILED",
    message: "UPI transaction failed. Please try again.",
    isRetryable: true,
  },
  // Refund errors
  refund_not_allowed: {
    code: "REFUND_NOT_ALLOWED",
    message: "Refund is not allowed for this transaction.",
    isRetryable: false,
  },
  refund_amount_exceeded: {
    code: "REFUND_AMOUNT_EXCEEDED",
    message: "Refund amount exceeds the original payment amount.",
    isRetryable: false,
  },
  // Rate limiting
  rate_limit_exceeded: {
    code: "PAYMENT_RATE_LIMITED",
    message: "Too many payment requests. Please wait a moment and try again.",
    isRetryable: true,
  },
  // Payout errors
  beneficiary_not_found: {
    code: "PAYOUT_BENEFICIARY_NOT_FOUND",
    message: "Beneficiary details not found. Please re-add the bank account.",
    isRetryable: false,
  },
  insufficient_payout_balance: {
    code: "PAYOUT_INSUFFICIENT_BALANCE",
    message: "Payout could not be processed at this time. Please try again later.",
    isRetryable: true,
  },
  transfer_failed: {
    code: "PAYOUT_TRANSFER_FAILED",
    message: "Fund transfer failed. Please try again or contact support.",
    isRetryable: true,
  },
};

/**
 * Human-readable descriptions for common Cashfree error sub-codes.
 * Used for logging and detailed diagnostics (NOT shown to end users).
 */
export const CF_ERROR_DESCRIPTIONS: Record<string, string> = {
  // Payment failures
  TRANSACTION_DECLINED: "Transaction was declined by the bank.",
  INSUFFICIENT_BALANCE: "Insufficient balance in the account.",
  BANK_REFUSED: "Payment refused by the issuing bank.",
  AUTHENTICATION_FAILED: "3DS/OTP authentication failed.",
  RISK_REJECTED: "Payment flagged by risk/fraud engine.",
  TIMEOUT: "Payment timed out before completion.",
  USER_CANCELLED: "User cancelled the payment.",

  // UPI specific
  UPI_COLLECT_EXPIRED: "UPI collect request expired.",
  UPI_DECLINED_BY_USER: "UPI payment declined by user.",
  UPI_INVALID_VPA: "Invalid UPI VPA/handle.",

  // Card specific
  CARD_EXPIRED: "Card has expired.",
  CARD_DECLINED: "Card was declined.",
  INVALID_CVV: "Invalid CVV entered.",
  CARD_NOT_ENABLED: "Card not enabled for online transactions.",

  // Netbanking specific
  NETBANKING_FAILED: "Netbanking transaction failed.",
  SESSION_EXPIRED: "Bank session expired.",
};

/**
 * Maps a Cashfree API error to a user-friendly error structure.
 *
 * @param cfError - Error object from Cashfree API response
 * @returns Mapped error with internal code, user message, and retry flag
 */
export function mapCashfreeError(cfError: {
  code?: string;
  message?: string;
  type?: string;
}): MappedCashfreeError {
  const errorCode = cfError.code?.toLowerCase();

  // Look up known error code
  if (errorCode && CF_ERROR_MAP[errorCode]) {
    return CF_ERROR_MAP[errorCode];
  }

  // Check if the error type suggests retryability
  const errorType = cfError.type?.toLowerCase();
  const isServerError =
    errorType === "server_error" ||
    errorType === "internal_server_error" ||
    errorType === "gateway_error";

  // Fallback: use the Cashfree message with a generic code
  return {
    code: errorCode
      ? `CASHFREE_${errorCode.toUpperCase()}`
      : "PAYMENT_UNKNOWN_ERROR",
    message: isServerError
      ? "Payment service is temporarily unavailable. Please try again in a few minutes."
      : cfError.message ?? "An unexpected payment error occurred. Please try again.",
    isRetryable: isServerError,
  };
}

// ==============================================
// STATUS HELPERS
// ==============================================

/**
 * Resolves a Cashfree payment status to an internal status string.
 * Returns "unknown" if the status is not recognized.
 */
export function resolvePaymentStatus(cfStatus: string): string {
  return CF_STATUS_MAP[cfStatus] ?? "unknown";
}

/**
 * Resolves a Cashfree order status to an internal status string.
 * Returns "unknown" if the status is not recognized.
 */
export function resolveOrderStatus(cfStatus: string): string {
  return CF_ORDER_STATUS_MAP[cfStatus] ?? "unknown";
}

/**
 * Resolves a Cashfree refund status to an internal status string.
 * Returns "unknown" if the status is not recognized.
 */
export function resolveRefundStatus(cfStatus: string): string {
  return CF_REFUND_STATUS_MAP[cfStatus] ?? "unknown";
}

/**
 * Resolves a Cashfree payout transfer status to an internal status string.
 * Returns "unknown" if the status is not recognized.
 */
export function resolvePayoutStatus(cfStatus: string): string {
  return CF_PAYOUT_STATUS_MAP[cfStatus] ?? "unknown";
}

/**
 * Checks whether a Cashfree payment status is terminal (no further changes expected).
 */
export function isTerminalPaymentStatus(cfStatus: string): boolean {
  return ["SUCCESS", "FAILED", "CANCELLED", "USER_DROPPED", "VOID"].includes(
    cfStatus
  );
}

/**
 * Checks whether a Cashfree order status is terminal.
 */
export function isTerminalOrderStatus(cfStatus: string): boolean {
  return ["PAID", "EXPIRED", "TERMINATED"].includes(cfStatus);
}
