/**
 * PayU Core SDK Service (Mode B — CBWrapper + Core PG)
 *
 * Uses PayU Core PG SDK (payu-core-pg-react) to generate correctly formatted
 * POST body, then passes it to Custom Browser SDK (payu-custom-browser-react)
 * for webview presentation.
 *
 * Mode B only: takes pre-computed hashes from server, salt never on client.
 *
 * Three payment modes:
 * - Card: Core PG → CBWrapper + Custom Browser for 3DS/OTP
 * - Net Banking: Core PG → CBWrapper + Custom Browser for bank login
 * - UPI Collect: Core PG → CBWrapper submit
 */

import { NativeModules, NativeEventEmitter, DeviceEventEmitter, Platform } from 'react-native';
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

interface StoredCardInstrumentParams {
  bankcode: 'CC' | 'DC';
  store_card_token: string;
  storecard_token_type: '0';  // PayU vault token
  cvv: string;
}

interface NBInstrumentParams {
  bankcode: string;
}

interface UPIInstrumentParams {
  vpa: string;
}

export type InstrumentParams = CardInstrumentParams | StoredCardInstrumentParams | NBInstrumentParams | UPIInstrumentParams;

// ===================================================
// SDK LOADING — Safe for New Architecture
// ===================================================

interface CBWrapperModule {
  openCB(
    config: { payu_payment_params: Record<string, unknown> },
    errorCallback: (error: string) => void,
    successCallback: (initMessage: string) => void,
  ): void;
  addListener?: (eventName: string) => void;
  removeListeners?: (count: number) => void;
}

interface PayUSdkModule {
  makePayment(
    params: Record<string, unknown>,
    successCallback: (jsonString: string) => void,
    errorCallback: (error: unknown) => void,
  ): void;
}

// Resolve native modules — all wrapped in try/catch to prevent crashes at import time.
let CBWrapper: CBWrapperModule | null = null;
let PayUSdkNative: PayUSdkModule | null = null;

try {
  const nativeModule = NativeModules.CBWrapper;
  if (nativeModule != null && typeof nativeModule.openCB === 'function') {
    CBWrapper = nativeModule as CBWrapperModule;
  }
} catch {
  // NativeModules access failed
}

if (!CBWrapper) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('payu-custom-browser-react');
    const mod = pkg.default ?? pkg;
    if (mod != null && typeof mod.openCB === 'function') {
      CBWrapper = mod as CBWrapperModule;
    }
  } catch {
    // Module not available (Expo Go, missing native binary)
  }
}

// Load PayU Core PG SDK native module (for generating correctly formatted POST body)
try {
  const payuSdk = NativeModules.PayUSdk;
  if (payuSdk != null && typeof payuSdk.makePayment === 'function') {
    PayUSdkNative = payuSdk as PayUSdkModule;
  }
} catch {
  // PayUSdk not available
}

// Build event emitter LAZILY — constructing NativeEventEmitter at module load
// can crash in bridgeless mode if the native module doesn't have proper bindings.
let _cachedEmitter: NativeEventEmitter | typeof DeviceEventEmitter | null = null;

function getEventEmitter(): NativeEventEmitter | typeof DeviceEventEmitter {
  if (_cachedEmitter) return _cachedEmitter;

  if (CBWrapper) {
    try {
      _cachedEmitter = new NativeEventEmitter(CBWrapper as unknown as ConstructorParameters<typeof NativeEventEmitter>[0]);
      return _cachedEmitter;
    } catch (e) {
      console.warn('[PayU] NativeEventEmitter construction failed, falling back to DeviceEventEmitter:', e);
    }
  }

  _cachedEmitter = DeviceEventEmitter;
  return _cachedEmitter;
}

// Diagnostic log
if (CBWrapper) {
  console.log('[PayU] CBWrapper loaded successfully');
} else {
  try {
    const moduleNames = Object.keys(NativeModules);
    console.warn(
      '[PayU] CBWrapper NOT found. Module count: ' + moduleNames.length +
      '. Sample: ' + moduleNames.slice(0, 15).join(', '),
    );
  } catch {
    console.warn('[PayU] CBWrapper NOT found, could not enumerate NativeModules');
  }
}
console.log('[PayU] PayUSdk native module:', PayUSdkNative ? 'available' : 'NOT available');

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
// CORE PG SDK — POST DATA GENERATION
// ===================================================

/**
 * Map our CorePaymentMode to PayU Core PG SDK paymentType strings.
 * These are the values PayU's native SDK expects for createRequestWithPaymentParam.
 */
function getPaymentType(mode: CorePaymentMode): string {
  switch (mode) {
    case 'CC':
    case 'DC':
      return 'Credit / Debit Cards';
    case 'NB':
      return 'Net Banking';
    case 'upi':
      return 'UPI';
  }
}

/**
 * Use PayU Core PG SDK's native makePayment() to generate the correctly
 * formatted POST body. On iOS, makePayment returns {data: postParams, url}
 * via successCallback WITHOUT opening any UI.
 *
 * This ensures the POST body format matches exactly what PayU's server expects
 * for hash verification — eliminates encoding/formatting mismatches from manual
 * construction.
 *
 * Returns null if Core PG SDK is unavailable or fails.
 */
async function getCorePgPostData(
  mode: CorePaymentMode,
  sessionParams: PayUSessionParams,
  instrumentParams: InstrumentParams,
  sdkEnvironment: string,
): Promise<{ postData: string; paymentUrl: string } | null> {
  // Core PG makePayment only returns {data, url} on iOS.
  // On Android it opens the Custom Browser directly.
  if (Platform.OS !== 'ios' || !PayUSdkNative) {
    return null;
  }

  // Build params using Core PG SDK field names (camelCase)
  const corePgParams: Record<string, unknown> = {
    key: sessionParams.key,
    environment: sdkEnvironment,
    amount: sessionParams.amount,
    txnId: sessionParams.txnid,
    phone: sessionParams.phone || '9999999999',
    email: sessionParams.email,
    surl: sessionParams.surl,
    furl: sessionParams.furl,
    productInfo: sessionParams.productinfo,
    firstname: sessionParams.firstname,
    hash: sessionParams.hash,
    userCredentials: sessionParams.user_credential,
    udf1: sessionParams.udf1 ?? '',
    udf2: sessionParams.udf2 ?? '',
    udf3: sessionParams.udf3 ?? '',
    udf4: sessionParams.udf4 ?? '',
    udf5: sessionParams.udf5 ?? '',
    paymentType: getPaymentType(mode),
  };

  // Instrument-specific params using Core PG SDK field names
  if ('bankcode' in instrumentParams && (mode === 'NB' || mode === 'CC' || mode === 'DC')) {
    corePgParams.bankCode = instrumentParams.bankcode;
  }
  if ('vpa' in instrumentParams) {
    corePgParams.vpa = (instrumentParams as UPIInstrumentParams).vpa;
  }
  if ('card_number' in instrumentParams) {
    const cardParams = instrumentParams as CardInstrumentParams;
    corePgParams.cardNumber = cardParams.card_number;
    corePgParams.cvv = cardParams.cvv;
    corePgParams.expiryMonth = cardParams.expiry_month;
    corePgParams.expiryYear = cardParams.expiry_year;
    corePgParams.nameOnCard = cardParams.name_on_card;
    if (cardParams.store_card) {
      corePgParams.store_card = cardParams.store_card;
    }
  }
  if ('store_card_token' in instrumentParams) {
    const storedParams = instrumentParams as StoredCardInstrumentParams;
    corePgParams.store_card_token = storedParams.store_card_token;
    corePgParams.storecard_token_type = storedParams.storecard_token_type;
    corePgParams.cvv = storedParams.cvv;
  }

  // Enforce paymethod
  if (sessionParams.enforce_paymethod) {
    corePgParams.enforce_paymethod = sessionParams.enforce_paymethod;
  }

  // CRITICAL: Apply iOS field name mappings.
  // The JS SDK's ParseEsentials() normally does this, but we call the native
  // module directly so we must map these ourselves.
  // PayUModelPaymentParams.fromJSONObject() expects uppercase iOS keys.
  if (Platform.OS === 'ios') {
    corePgParams.SURL = corePgParams.surl;
    corePgParams.FURL = corePgParams.furl;
    corePgParams.transactionID = corePgParams.txnId;
    if (corePgParams.cvv) {
      corePgParams.CVV = corePgParams.cvv;
    }
  }

  // Log the keys being sent (no sensitive values)
  console.log('[PayU] Core PG params keys:', Object.keys(corePgParams).join(', '));
  console.log('[PayU] Core PG paymentType:', corePgParams.paymentType, 'txnId:', corePgParams.txnId, 'transactionID:', corePgParams.transactionID);

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      console.warn('[PayU] Core PG makePayment timed out (5s)');
      resolve(null);
    }, 5000);

    try {
      PayUSdkNative!.makePayment(
        corePgParams,
        (jsonString: string) => {
          clearTimeout(timeoutId);
          try {
            const result = JSON.parse(jsonString);
            if (result.data && result.url) {
              console.log('[PayU] Core PG generated POST data successfully, url:', result.url);
              // NEVER log postData — it contains ccnum/ccvv (PCI DSS scope)
              resolve({ postData: result.data, paymentUrl: result.url });
            } else {
              console.warn('[PayU] Core PG returned unexpected format:', Object.keys(result));
              resolve(null);
            }
          } catch (e) {
            console.warn('[PayU] Core PG response parse failed:', e);
            resolve(null);
          }
        },
        (error: unknown) => {
          clearTimeout(timeoutId);
          console.warn('[PayU] Core PG makePayment error:', error);
          resolve(null);
        },
      );
    } catch (e) {
      clearTimeout(timeoutId);
      console.warn('[PayU] Core PG makePayment threw:', e);
      resolve(null);
    }
  });
}

// ===================================================
// FALLBACK POST DATA BUILDER
// ===================================================

/**
 * Fallback: manually build the URL-encoded POST body.
 * Used when Core PG SDK is unavailable (Android or missing native module).
 */
function buildPostDataFallback(
  mode: CorePaymentMode,
  sessionParams: PayUSessionParams,
  instrumentParams: InstrumentParams,
): string {
  const params: Record<string, string> = {
    key: sessionParams.key,
    txnid: sessionParams.txnid,
    amount: sessionParams.amount,
    productinfo: sessionParams.productinfo,
    firstname: sessionParams.firstname,
    email: sessionParams.email,
    phone: sessionParams.phone || '9999999999',
    surl: sessionParams.surl,
    furl: sessionParams.furl,
    hash: sessionParams.hash,
    udf1: sessionParams.udf1 ?? '',
    udf2: sessionParams.udf2 ?? '',
    udf3: sessionParams.udf3 ?? '',
    udf4: sessionParams.udf4 ?? '',
    udf5: sessionParams.udf5 ?? '',
    user_credentials: sessionParams.user_credential,
  };

  if (mode === 'upi') {
    params.pg = 'UPI';
    params.bankcode = 'UPI';
  } else if (mode === 'NB') {
    params.pg = 'NB';
  } else {
    params.pg = mode;
  }

  if ('vpa' in instrumentParams) {
    params.vpa = instrumentParams.vpa;
  }
  if ('bankcode' in instrumentParams) {
    params.bankcode = instrumentParams.bankcode;
  }
  if ('card_number' in instrumentParams) {
    params.ccnum = instrumentParams.card_number;
    params.ccvv = instrumentParams.cvv;
    params.ccexpmon = instrumentParams.expiry_month;
    params.ccexpyr = instrumentParams.expiry_year;
    params.ccname = instrumentParams.name_on_card;
    if ('store_card' in instrumentParams && instrumentParams.store_card) {
      params.store_card = instrumentParams.store_card;
    }
  }
  if ('store_card_token' in instrumentParams) {
    params.store_card_token = instrumentParams.store_card_token;
    params.storecard_token_type = instrumentParams.storecard_token_type;
    params.ccvv = instrumentParams.cvv;
  }

  if (sessionParams.enforce_paymethod) {
    params.enforce_paymethod = sessionParams.enforce_paymethod;
  }

  // DO NOT URL-encode values. The PayU Custom Browser SDK splits by & and =,
  // does NOT URL-decode, then creates a JS form whose submit() URL-encodes.
  // Pre-encoding causes double-encoding → hash mismatch.
  // Raw values are safe here because none contain & or = characters.
  return Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
}

// ===================================================
// CORE PAYMENT LAUNCHER
// ===================================================

/**
 * Launch a payment via PayU SDKs.
 *
 * Flow (iOS):
 * 1. Core PG SDK generates properly formatted POST body + payment URL
 * 2. Custom Browser SDK (CBWrapper) loads the webview with that POST data
 * 3. CBListener events report success/failure/cancel
 *
 * Falls back to manually constructed POST data if Core PG SDK unavailable.
 */
export async function launchCorePayment(
  mode: CorePaymentMode,
  sessionParams: PayUSessionParams,
  instrumentParams: InstrumentParams,
): Promise<CorePaymentOutcome> {
  // Expo Go fallback
  if (!CBWrapper) {
    if (__DEV__) {
      return mockCorePayment(mode, sessionParams);
    }
    console.error('[PayU] launchCorePayment: CBWrapper is null — native module not linked');
    return {
      status: 'failure',
      error: 'PayU Core SDK not available. Please update the app.',
    };
  }

  const sdkEnvironment = sessionParams.environment ?? (__DEV__ ? '1' : '0');

  // Use server-built POST data if available (exact encoding that passes PayU hash verification).
  // Falls back to client-built POST data only if server didn't provide it.
  const serverPostData = (sessionParams as Record<string, unknown>).post_data as string | undefined;
  const serverPaymentUrl = (sessionParams as Record<string, unknown>).payment_url as string | undefined;
  const paymentUrl = serverPaymentUrl ?? (sdkEnvironment === '1'
    ? 'https://test.payu.in/_payment'
    : 'https://secure.payu.in/_payment');

  let postData: string;
  if (serverPostData) {
    // Server-built POST body with RAW (un-encoded) values.
    // Instrument params (card/UPI/NB details) must also be raw — no encoding.
    // The SDK will URL-encode everything once when creating the JS form.
    const instrumentParts: string[] = [];
    if ('vpa' in instrumentParams) {
      instrumentParts.push(`pg=UPI&bankcode=UPI&vpa=${instrumentParams.vpa}`);
    } else if ('bankcode' in instrumentParams && mode === 'NB') {
      instrumentParts.push(`pg=NB&bankcode=${instrumentParams.bankcode}`);
    } else if ('card_number' in instrumentParams) {
      const cp = instrumentParams as CardInstrumentParams;
      instrumentParts.push(`pg=${mode}`);
      instrumentParts.push(`bankcode=${cp.bankcode}`);
      instrumentParts.push(`ccnum=${cp.card_number}`);
      instrumentParts.push(`ccvv=${cp.cvv}`);
      instrumentParts.push(`ccexpmon=${cp.expiry_month}`);
      instrumentParts.push(`ccexpyr=${cp.expiry_year}`);
      instrumentParts.push(`ccname=${cp.name_on_card}`);
      if (cp.store_card) instrumentParts.push(`store_card=${cp.store_card}`);
    } else if ('store_card_token' in instrumentParams) {
      const sp = instrumentParams as StoredCardInstrumentParams;
      instrumentParts.push(`pg=${mode}`);
      instrumentParts.push(`bankcode=${sp.bankcode}`);
      instrumentParts.push(`store_card_token=${sp.store_card_token}`);
      instrumentParts.push(`storecard_token_type=${sp.storecard_token_type}`);
      instrumentParts.push(`ccvv=${sp.cvv}`);
    }
    if (sessionParams.enforce_paymethod) {
      instrumentParts.push(`enforce_paymethod=${sessionParams.enforce_paymethod}`);
    }
    postData = instrumentParts.length > 0
      ? `${serverPostData}&${instrumentParts.join('&')}`
      : serverPostData;
    console.log('[PayU] Using SERVER-built POST data (verified encoding)');
  } else {
    postData = buildPostDataFallback(mode, sessionParams, instrumentParams);
    console.log('[PayU] Using CLIENT-built POST data (server post_data not available)');
  }

  // 10-minute timeout
  const SDK_TIMEOUT_MS = 10 * 60 * 1000;

  let cbListenerSub: EmitterSubscription | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let resolved = false;

  return new Promise<CorePaymentOutcome>((resolve) => {
    const finish = (outcome: CorePaymentOutcome) => {
      if (resolved) return;
      resolved = true;
      console.log('[PayU] Payment outcome:', outcome.status, outcome.error ?? '');
      if (cbListenerSub) { cbListenerSub.remove(); cbListenerSub = null; }
      if (timeoutId !== null) { clearTimeout(timeoutId); timeoutId = null; }
      resolve(outcome);
    };

    timeoutId = setTimeout(() => {
      console.warn('[PayU] SDK timeout reached (10 min)');
      finish({
        status: 'failure',
        error: 'Payment timed out. Check your payment status in the app.',
      });
    }, SDK_TIMEOUT_MS);

    // Listen for CBListener events
    const emitter = getEventEmitter();
    cbListenerSub = emitter.addListener('CBListener', (event) => {
      const eventType: string = event.eventType ?? event.eveneType ?? '';
      console.log('[PayU] CBListener event:', eventType);

      switch (eventType) {
        case 'onPaymentSuccess': {
          const response = parseSDKResponse(event.payuResult ?? event.merchantResponse);
          finish({ status: 'success', payuResponse: response ?? undefined });
          break;
        }
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
          finish({ status: 'cancelled', isTxnInitiated: false });
          break;
        default:
          console.log('[PayU] Unknown CBListener event type:', eventType);
          break;
      }
    });

    // Step 2: Build CBWrapper params with cb_config
    const pgValue = mode === 'upi' ? 'UPI' : mode;

    const payUPaymentParams: Record<string, unknown> = {
      key: sessionParams.key,
      transaction_id: sessionParams.txnid,
      amount: sessionParams.amount,
      product_info: sessionParams.productinfo,
      first_name: sessionParams.firstname,
      email: sessionParams.email,
      phone: sessionParams.phone || '9999999999',
      ios_surl: sessionParams.surl,
      ios_furl: sessionParams.furl,
      android_surl: sessionParams.surl,
      android_furl: sessionParams.furl,
      environment: sdkEnvironment,
      user_credentials: sessionParams.user_credential,
      pg: pgValue,
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
      cb_config: {
        url: paymentUrl,
        post_data: postData,
        auto_approve: 'true',
        auto_select_otp: 'true',
        merchant_response_timeout: '5',
      },
      ...(sessionParams.enforce_paymethod && {
        enforce_paymethod: sessionParams.enforce_paymethod,
      }),
      ...instrumentParams,
    };

    // Diagnostic logging (no sensitive data — card numbers/CVV are NOT logged)
    console.log('[PayU] Opening CBWrapper — mode:', mode, 'pg:', pgValue, 'env:', sdkEnvironment, 'url:', paymentUrl);
    console.log('[PayU] Hash-relevant fields:', {
      key: sessionParams.key,
      txnid: sessionParams.txnid,
      amount: sessionParams.amount,
      productinfo: sessionParams.productinfo,
      firstname: sessionParams.firstname,
      email: sessionParams.email,
      udf1: sessionParams.udf1 ?? '',
      udf2: sessionParams.udf2 ?? '',
      udf3: sessionParams.udf3 ?? '',
      hash: sessionParams.hash?.slice(0, 16) + '...',
    });

    try {
      CBWrapper!.openCB(
        { payu_payment_params: payUPaymentParams },
        (error: string) => {
          console.error('[PayU] openCB errorCallback:', error);
          finish({ status: 'failure', error });
        },
        (_initMessage: string) => {
          console.log('[PayU] openCB successCallback — CB presented');
        },
      );
    } catch (err) {
      console.error('[PayU] openCB threw:', err);
      finish({
        status: 'failure',
        error: err instanceof Error ? err.message : 'Failed to start payment',
      });
    }
  });
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
  return CBWrapper != null;
}
