/**
 * PayU Core SDK Service (Mode B — CBWrapper)
 *
 * Wraps payu-custom-browser-react CBWrapper for secure payment execution.
 * Mode B only: takes pre-computed hashes from server, salt never on client.
 *
 * Three payment modes:
 * - Card: CBWrapper + Custom Browser for 3DS/OTP
 * - Net Banking: CBWrapper + Custom Browser for bank login
 * - UPI Collect: CBWrapper submit (no Custom Browser)
 */

import { DeviceEventEmitter, Platform } from 'react-native';
import type { EmitterSubscription } from 'react-native';
import type { PayUSessionParams } from '@/src/stores/payment';

// ===================================================
// TYPES
// ===================================================

export type CorePaymentMode = 'CC' | 'DC' | 'NB' | 'upi';

export interface CorePaymentOutcome {
  status: 'success' | 'failure' | 'cancelled' | 'blocked';
  isTxnInitiated?: boolean;
  payuResponse?: Record<string, unknown>;
  error?: string;
}

interface CardInstrumentParams {
  bankcode: 'CC' | 'DC';
  card_number: string;
  cvv: string;
  expiry_year: string;
  expiry_month: string;
  name_on_card: string;
  store_card?: string;
}

interface NBInstrumentParams {
  bankcode: string;
}

interface UPIInstrumentParams {
  vpa: string;
}

export type InstrumentParams = CardInstrumentParams | NBInstrumentParams | UPIInstrumentParams;

// ===================================================
// SDK LOADING (Expo Go safe)
// ===================================================

interface CBWrapperModule {
  startPayment(
    config: { payUPaymentParams: Record<string, unknown> },
    paymentMode: string,
    errorCallback: (error: string) => void,
    successCallback: (payuResponse: string) => void,
  ): void;
}

let CBWrapper: CBWrapperModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  CBWrapper = require('payu-custom-browser-react').default;
} catch {
  CBWrapper = null;
}

// ===================================================
// MOCK (Expo Go fallback)
// ===================================================

const MOCK_SUCCESS_RATE = 0.9;

async function mockCorePayment(
  _mode: CorePaymentMode,
  sessionParams: PayUSessionParams,
): Promise<CorePaymentOutcome> {
  if (__DEV__) {
    console.warn('PayU Core SDK not available — using mock payment');
  }
  await new Promise((r) => setTimeout(r, 2000));

  if (Math.random() < MOCK_SUCCESS_RATE) {
    return {
      status: 'success',
      payuResponse: {
        status: 'success',
        txnid: sessionParams.txnid,
        amount: sessionParams.amount,
      },
    };
  }
  return { status: 'failure', error: 'Payment declined by bank (mock)' };
}

// ===================================================
// CORE PAYMENT LAUNCHER
// ===================================================

/**
 * Launch a payment via PayU Core SDK (CBWrapper Mode B).
 *
 * @param mode Payment mode: CC, DC, NB, or upi
 * @param sessionParams PayU session params from initiate-payment edge fn
 * @param instrumentParams Instrument-specific params (card details / bankcode / VPA)
 */
export function launchCorePayment(
  mode: CorePaymentMode,
  sessionParams: PayUSessionParams,
  instrumentParams: InstrumentParams,
): Promise<CorePaymentOutcome> {
  // Expo Go fallback
  if (!CBWrapper) {
    if (__DEV__) {
      return mockCorePayment(mode, sessionParams);
    }
    return Promise.resolve({
      status: 'failure' as const,
      error: 'PayU Core SDK not available. Please update the app.',
    });
  }

  // 10-minute timeout — safety net for Card/NB if SDK crashes or app is backgrounded
  const SDK_TIMEOUT_MS = 10 * 60 * 1000;

  const sdkPromise = new Promise<CorePaymentOutcome>((resolve) => {
    let cbListenerSub: EmitterSubscription | null = null;
    let resolved = false;

    const finish = (outcome: CorePaymentOutcome) => {
      if (resolved) return;
      resolved = true;
      cbListenerSub?.remove();
      resolve(outcome);
    };

    // Listen for CBListener events (failure, cancel, errors)
    cbListenerSub = DeviceEventEmitter.addListener('CBListener', (event) => {
      // Defensive: SDK has known typo "eveneType" on some events
      const eventType: string = event.eventType ?? event.eveneType ?? '';

      switch (eventType) {
        case 'onPaymentFailure': {
          const response = parseSDKResponse(event.payuResult ?? event.merchantResponse);
          finish({
            status: 'failure',
            payuResponse: response ?? undefined,
            error: String(response?.error_Message ?? response?.error ?? 'Payment failed'),
          });
          break;
        }
        case 'onPaymentTerminate': {
          // User cancelled — check if txn was already initiated
          const isTxnInitiated = Boolean(
            event.isTxnInitiated ?? event.ixTxnInitiated ?? false,
          );
          finish({ status: 'cancelled', isTxnInitiated });
          break;
        }
        case 'onCBErrorReceived':
          finish({
            status: 'failure',
            error: event.error ?? 'Custom Browser error',
          });
          break;
        case 'onBackButton':
        case 'onBackApprove':
        case 'onBackDismiss':
          // Back pressed without explicit cancel — treat as cancel
          finish({ status: 'cancelled', isTxnInitiated: false });
          break;
        default:
          // Unknown event — ignore (don't resolve)
          break;
      }
    });

    // Build CBWrapper params
    // environment: '1' = sandbox, '0' = production — server decides based on PAYU_BASE_URL
    const sdkEnvironment = sessionParams.environment ?? (__DEV__ ? '1' : '0');
    const payUPaymentParams: Record<string, unknown> = {
      key: sessionParams.key,
      transaction_id: sessionParams.txnid,
      amount: sessionParams.amount,
      product_info: sessionParams.productinfo,
      first_name: sessionParams.firstname,
      email: sessionParams.email,
      phone: sessionParams.phone,
      ios_surl: sessionParams.surl,
      ios_furl: sessionParams.furl,
      android_surl: sessionParams.surl,
      android_furl: sessionParams.furl,
      environment: sdkEnvironment,
      user_credentials: sessionParams.user_credential,
      hashes: {
        payment: sessionParams.hash,
        ...(sessionParams.vas_hash && { vas: sessionParams.vas_hash }),
        ...(sessionParams.prd_hash && { payment_related_details: sessionParams.prd_hash }),
      },
      additional_param: {
        udf1: sessionParams.udf1 ?? '',
        udf2: sessionParams.udf2 ?? '',
        udf3: sessionParams.udf3 ?? '',
        udf4: sessionParams.udf4 ?? '',
        udf5: sessionParams.udf5 ?? '',
      },
      // Server-enforced payment method restriction
      ...(sessionParams.enforce_paymethod && {
        enforce_paymethod: sessionParams.enforce_paymethod,
      }),
      // Merge instrument-specific params
      ...instrumentParams,
    };

    try {
      CBWrapper!.startPayment(
        { payUPaymentParams },
        mode,
        // Error callback
        (error: string) => {
          finish({ status: 'failure', error });
        },
        // Success callback — payment succeeded
        (payuResponse: string) => {
          const parsed = parseSDKResponse(payuResponse);
          finish({ status: 'success', payuResponse: parsed ?? undefined });
        },
      );
    } catch (err) {
      finish({
        status: 'failure',
        error: err instanceof Error ? err.message : 'Failed to start payment',
      });
    }
  });

  const timeoutPromise = new Promise<CorePaymentOutcome>((resolve) => {
    setTimeout(() => {
      resolve({
        status: 'failure',
        error: 'Payment timed out. Check your payment status in the app.',
      });
    }, SDK_TIMEOUT_MS);
  });

  return Promise.race([sdkPromise, timeoutPromise]);
}

// ===================================================
// HELPERS
// ===================================================

function parseSDKResponse(raw: string | Record<string, unknown> | undefined | null): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Check if Core SDK is available (native module linked).
 */
export function isCoreSdkAvailable(): boolean {
  return CBWrapper !== null;
}
