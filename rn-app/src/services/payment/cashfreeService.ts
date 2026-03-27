/**
 * Cashfree Payment Gateway Service
 *
 * Wraps react-native-cashfree-pg-sdk using Web Checkout for ALL payment methods.
 * Server-side `order_meta.payment_methods` restricts which methods appear.
 * All card/bank data stays within Cashfree's hosted WebView — zero PCI scope.
 */

let CFPaymentGatewayService: typeof import('react-native-cashfree-pg-sdk').CFPaymentGatewayService | null = null;
let CFEnvironment: typeof import('cashfree-pg-api-contract').CFEnvironment | null = null;
let CFSession: typeof import('cashfree-pg-api-contract').CFSession | null = null;

try {
  const sdk = require('react-native-cashfree-pg-sdk');
  CFPaymentGatewayService = sdk.CFPaymentGatewayService;
} catch (e) {
  console.warn('[Cashfree] SDK not available:', (e as Error).message);
}

try {
  const contract = require('cashfree-pg-api-contract');
  CFEnvironment = contract.CFEnvironment;
  CFSession = contract.CFSession;
} catch (e) {
  console.warn('[Cashfree] API contract not available:', (e as Error).message);
}

export function isCashfreeAvailable(): boolean {
  return CFPaymentGatewayService != null && CFSession != null;
}

// ==============================================
// ENVIRONMENT
// ==============================================

const IS_SANDBOX = process.env.EXPO_PUBLIC_CASHFREE_ENV?.toLowerCase() === 'sandbox';
const ENV = CFEnvironment ? (IS_SANDBOX ? CFEnvironment.SANDBOX : CFEnvironment.PRODUCTION) : null;

// ==============================================
// CALLBACKS
// ==============================================

export function setupCallbacks(
  onVerify: (orderId: string) => void,
  onError: (error: unknown, orderId: string) => void,
) {
  if (!CFPaymentGatewayService) {
    console.error('[Cashfree] SDK not available — cannot set callbacks');
    return;
  }
  CFPaymentGatewayService.setCallback({ onVerify, onError });
}

export function removeCallbacks() {
  CFPaymentGatewayService?.removeCallback();
}

// ==============================================
// WEB CHECKOUT — single method for all payments
// ==============================================

/**
 * Launch Cashfree Web Checkout for any payment method.
 * Opens a full-screen WebView managed by Cashfree's native SDK.
 * Which methods appear is controlled server-side via order_meta.payment_methods
 * (cc, dc, nb, upi, etc.) set during order creation.
 *
 * Requires callbacks set up via setupCallbacks() before calling.
 */
export function launchCheckout(paymentSessionId: string, orderId: string) {
  if (!CFPaymentGatewayService || !CFSession || !ENV) {
    throw new Error('Cashfree SDK not available. Please update the app.');
  }
  const session = new CFSession(paymentSessionId, orderId, ENV);
  CFPaymentGatewayService.doWebPayment(session);
}
