/**
 * Cashfree Payment Gateway Service
 *
 * Wraps react-native-cashfree-pg-sdk for:
 * - Card payments (Drop Checkout with themed UI)
 * - UPI Intent payments (native app picker)
 *
 * UPI Collect and Net Banking are API-driven via cashfree-pay-order edge function.
 * Card data never touches our code — zero PCI scope.
 */

let CFPaymentGatewayService: typeof import('react-native-cashfree-pg-sdk').CFPaymentGatewayService | null = null;
let CFEnvironment: typeof import('cashfree-pg-api-contract').CFEnvironment | null = null;
let CFSession: typeof import('cashfree-pg-api-contract').CFSession | null = null;
let CFDropCheckoutPayment: typeof import('cashfree-pg-api-contract').CFDropCheckoutPayment | null = null;
let CFUPIIntentCheckoutPayment: typeof import('cashfree-pg-api-contract').CFUPIIntentCheckoutPayment | null = null;
let CFPaymentComponentBuilder: typeof import('cashfree-pg-api-contract').CFPaymentComponentBuilder | null = null;
let CFPaymentModes: typeof import('cashfree-pg-api-contract').CFPaymentModes | null = null;
let CFThemeBuilder: typeof import('cashfree-pg-api-contract').CFThemeBuilder | null = null;

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
  CFDropCheckoutPayment = contract.CFDropCheckoutPayment;
  CFUPIIntentCheckoutPayment = contract.CFUPIIntentCheckoutPayment;
  CFPaymentComponentBuilder = contract.CFPaymentComponentBuilder;
  CFPaymentModes = contract.CFPaymentModes;
  CFThemeBuilder = contract.CFThemeBuilder;
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
// THEME — matches app design system
// ==============================================

function buildTheme() {
  if (!CFThemeBuilder) return null;
  return new CFThemeBuilder()
    .setNavigationBarBackgroundColor('#131313')
    .setNavigationBarTextColor('#FFFFFF')
    .setButtonBackgroundColor('#FF9A6D')
    .setButtonTextColor('#000000')
    .setPrimaryTextColor('#CBCBCB')
    .setSecondaryTextColor('#878787')
    .build();
}

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
// PAYMENT METHODS
// ==============================================

/**
 * Launch Cashfree Drop Checkout for card payments.
 * Shows card number, expiry, CVV input + 3DS/OTP.
 * PCI scope: ZERO — card data stays within SDK.
 */
export function launchCardPayment(paymentSessionId: string, orderId: string) {
  if (!CFPaymentGatewayService || !CFSession || !CFPaymentComponentBuilder || !CFPaymentModes || !CFDropCheckoutPayment || !ENV) {
    throw new Error('Cashfree SDK not available. Please update the app.');
  }
  const session = new CFSession(paymentSessionId, orderId, ENV);
  const components = new CFPaymentComponentBuilder()
    .add(CFPaymentModes.CARD)
    .build();
  const theme = buildTheme();
  const payment = new CFDropCheckoutPayment(session, components, theme);
  CFPaymentGatewayService.doPayment(payment);
}

/**
 * Launch native UPI Intent flow.
 * Shows installed UPI apps (GPay, PhonePe, Paytm, etc.)
 * User selects app -> approves in the UPI app -> returns.
 */
export function launchUPIIntent(paymentSessionId: string, orderId: string) {
  if (!CFPaymentGatewayService || !CFSession || !CFUPIIntentCheckoutPayment || !ENV) {
    throw new Error('Cashfree SDK not available. Please update the app.');
  }
  const session = new CFSession(paymentSessionId, orderId, ENV);
  const theme = buildTheme();
  const payment = new CFUPIIntentCheckoutPayment(session, theme);
  CFPaymentGatewayService.doUPIPayment(payment);
}

// ==============================================
// WEB CHECKOUT (Card / Debit Card / Net Banking)
// ==============================================

const CF_WEB_CHECKOUT_BASE = IS_SANDBOX
  ? 'https://sandbox.cashfree.com/pg/order/#'
  : 'https://payments.cashfree.com/order/#';

/**
 * Get the Cashfree Web Checkout URL for a payment session.
 * The order's `payment_methods` restriction (set server-side) ensures
 * only the selected method (cc/dc/nb) is shown.
 */
export function getWebCheckoutUrl(paymentSessionId: string): string {
  return `${CF_WEB_CHECKOUT_BASE}/${paymentSessionId}`;
}
