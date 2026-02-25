/**
 * Cashfree PG SDK Service
 *
 * Integrates with Cashfree's React Native SDK (react-native-cashfree-pg-sdk) for native checkout.
 * Uses Supabase edge functions for secure session creation (server-side).
 *
 * Payment flow:
 * 1. Client calls initiate-payment edge function to get orderId + paymentSessionId
 * 2. Client launches Cashfree SDK web checkout (CFPaymentGatewayService.doWebPayment)
 * 3. SDK fires onVerify / onError callbacks
 * 4. CRITICAL: onVerify does NOT mean success — it means "go verify server-side"
 * 5. Cashfree sends webhook to payment-webhook edge function (S2S)
 * 6. Client navigates to processing screen and polls payment status
 */

import { NativeModules } from 'react-native';
import { callEdgeFunction } from '../supabase';

// ==============================================
// SDK AVAILABILITY CHECK
// ==============================================

// Check if Cashfree native module is available (null in Expo Go)
const isCashfreeAvailable = NativeModules.CashfreePgApi != null;

// ==============================================
// SDK LOADING (dynamic require for Expo Go safety)
// ==============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let CFPaymentGatewayService: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let CFSession: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let CFEnvironment: any = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sdk = require('react-native-cashfree-pg-sdk');
  CFPaymentGatewayService = sdk.CFPaymentGatewayService;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const contract = require('cashfree-pg-api-contract');
  CFSession = contract.CFSession;
  CFEnvironment = contract.CFEnvironment;
} catch {
  // SDK not available (expected in Expo Go)
}

// ==============================================
// TYPES
// ==============================================

export interface InitiatePaymentParams {
  tenancyId: string;
  paymentMethod: 'upi' | 'card' | 'netbanking';
  rentMonth: string;
}

export interface CheckoutResult {
  status: 'verify' | 'cancelled' | 'failure';
  orderId?: string;
  error?: string;
}

// ==============================================
// ENVIRONMENT
// ==============================================

const CASHFREE_ENV = process.env.EXPO_PUBLIC_CASHFREE_ENV ?? 'SANDBOX';

// ==============================================
// CONCURRENCY GUARD
// ==============================================

// Cashfree SDK does NOT prevent double invocation — guard it client-side
let isCheckoutActive = false;

// ==============================================
// SERVICE FUNCTIONS
// ==============================================

/**
 * Initialize Cashfree payment by calling the initiate-payment edge function.
 * Returns paymentId, orderId, and paymentSessionId needed for SDK checkout.
 */
export async function initiateCashfreePayment(
  params: InitiatePaymentParams
): Promise<{
  data: { paymentId: string; orderId: string; paymentSessionId: string } | null;
  error: string | null;
}> {
  const { data, error } = await callEdgeFunction<{
    success: boolean;
    data: {
      payment_id: string;
      order_id: string;
      payment_session_id: string;
    };
  }>('initiate-payment', {
    tenancy_id: params.tenancyId,
    payment_method: params.paymentMethod,
    rent_month: params.rentMonth,
  }, true);

  if (error) {
    return { data: null, error };
  }

  if (!data?.success || !data.data) {
    return { data: null, error: 'Failed to initiate payment' };
  }

  return {
    data: {
      paymentId: data.data.payment_id,
      orderId: data.data.order_id,
      paymentSessionId: data.data.payment_session_id,
    },
    error: null,
  };
}

/**
 * Launch Cashfree SDK web checkout.
 *
 * Registers callbacks BEFORE invoking doWebPayment.
 * CRITICAL: onVerify does NOT mean payment succeeded — it means the client should
 * verify the payment status server-side via verifyPaymentStatus().
 */
export async function launchCashfreeCheckout(
  paymentId: string,
  orderId: string,
  paymentSessionId: string
): Promise<CheckoutResult> {
  // Production safety guard
  if (!isCashfreeAvailable || !CFPaymentGatewayService || !CFSession || !CFEnvironment) {
    if (__DEV__) {
      console.warn('Cashfree SDK not available in Expo Go - using mock checkout');
      return mockCashfreeCheckout(orderId);
    }
    // In production, throw if SDK unavailable
    throw new Error('Cashfree SDK not available. Please update the app.');
  }

  // Concurrency guard — SDK does not prevent double invocation
  if (isCheckoutActive) {
    throw new Error('Checkout already in progress');
  }
  isCheckoutActive = true;

  return new Promise<CheckoutResult>((resolve) => {
    // Set callbacks BEFORE launching checkout
    CFPaymentGatewayService.setCallback({
      /**
       * onVerify is called when the SDK believes the transaction reached a terminal state.
       * CRITICAL: This does NOT mean the payment succeeded. The client MUST verify
       * the payment status server-side. Resolve with status 'verify' so the caller
       * knows to poll/verify.
       */
      onVerify(orderID: string) {
        isCheckoutActive = false;
        resolve({
          status: 'verify',
          orderId: orderID,
        });
      },

      /**
       * onError is called when the SDK encounters an error or the user cancels.
       * Check error.code for 'user_cancelled' to distinguish cancellation from failure.
       */
      onError(error: { code?: string; message?: string }, orderID: string) {
        isCheckoutActive = false;

        if (error.code === 'user_cancelled') {
          resolve({
            status: 'cancelled',
            orderId: orderID,
          });
          return;
        }

        resolve({
          status: 'failure',
          orderId: orderID,
          error: error.message ?? 'Cashfree SDK error',
        });
      },
    });

    // Create session and launch checkout
    try {
      const environment =
        CASHFREE_ENV === 'PRODUCTION'
          ? CFEnvironment.PRODUCTION
          : CFEnvironment.SANDBOX;

      const session = new CFSession(paymentSessionId, orderId, environment);
      CFPaymentGatewayService.doWebPayment(JSON.stringify(session));
    } catch (err) {
      isCheckoutActive = false;
      resolve({
        status: 'failure',
        orderId,
        error: err instanceof Error ? err.message : 'Failed to open checkout',
      });
    }
  });
}

// ==============================================
// PAYMENT STATUS POLLING (gateway-agnostic)
// ==============================================

/**
 * Verify payment status by polling the payments table directly.
 * The payment-webhook edge function updates status server-side.
 * This is gateway-agnostic — same logic as PayU's verifyPaymentStatus.
 */
export async function verifyPaymentStatus(
  paymentId: string
): Promise<{ status: 'success' | 'failure' | 'pending'; error?: string }> {
  try {
    // Import supabase lazily to avoid circular deps
    const { supabase } = await import('../supabase');

    const { data, error } = await supabase
      .from('payments')
      .select('status')
      .eq('id', paymentId)
      .single();

    if (error) {
      return { status: 'pending', error: error.message };
    }

    if (!data) {
      return { status: 'pending', error: 'Payment not found' };
    }

    const paymentStatus = data.status as string;

    if (paymentStatus === 'success') {
      return { status: 'success' };
    } else if (['failed', 'refunded', 'expired'].includes(paymentStatus)) {
      return { status: 'failure' };
    } else {
      return { status: 'pending' };
    }
  } catch (error) {
    return {
      status: 'pending',
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

// ==============================================
// MOCK CHECKOUT (Development Only)
// ==============================================

const MOCK_SUCCESS_RATE = 0.9;
const DEFAULT_MOCK_DELAY_MS = 2000;

/**
 * Mock Cashfree checkout for development/testing.
 * WARNING: This is NOT a real payment - for development only.
 */
export async function mockCashfreeCheckout(
  orderId: string,
  simulatedDelay = DEFAULT_MOCK_DELAY_MS
): Promise<CheckoutResult> {
  if (__DEV__) {
    console.warn('Using MOCK Cashfree checkout - not a real payment');
  }

  await new Promise((resolve) => setTimeout(resolve, simulatedDelay));

  const isSuccess = Math.random() < MOCK_SUCCESS_RATE;

  if (isSuccess) {
    return {
      status: 'verify',
      orderId,
    };
  } else {
    return {
      status: 'failure',
      orderId,
      error: 'Payment declined by bank',
    };
  }
}
