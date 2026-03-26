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

import { CFPaymentGatewayService } from 'react-native-cashfree-pg-sdk';
import {
  CFEnvironment,
  CFSession,
  CFDropCheckoutPayment,
  CFUPIIntentCheckoutPayment,
  CFPaymentComponentBuilder,
  CFPaymentModes,
  CFThemeBuilder,
} from 'cashfree-pg-api-contract';

// ==============================================
// ENVIRONMENT
// ==============================================

const ENV = __DEV__ ? CFEnvironment.SANDBOX : CFEnvironment.PRODUCTION;

// ==============================================
// THEME — matches app design system
// ==============================================

function buildTheme() {
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
  CFPaymentGatewayService.setCallback({ onVerify, onError });
}

export function removeCallbacks() {
  CFPaymentGatewayService.removeCallback();
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
  const session = new CFSession(paymentSessionId, orderId, ENV);
  const theme = buildTheme();
  const payment = new CFUPIIntentCheckoutPayment(session, theme);
  CFPaymentGatewayService.doUPIPayment(payment);
}
