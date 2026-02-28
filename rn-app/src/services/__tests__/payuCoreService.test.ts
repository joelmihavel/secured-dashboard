/**
 * PayU Core SDK Service -- Unit Tests
 *
 * Tests the CBWrapper payment launcher, mock fallbacks, param building,
 * event listener handling, and helper functions.
 */

import { DeviceEventEmitter } from 'react-native';
import type { PayUSessionParams } from '@/src/stores/payment';
import type {
  CorePaymentOutcome,
  InstrumentParams,
  CorePaymentMode,
} from '../payment/payuCoreService';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockOpenCB = jest.fn();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseSessionParams: PayUSessionParams = {
  key: 'test_merchant_key',
  txnid: 'TXN_001',
  amount: '25000',
  productinfo: 'Rent Payment',
  firstname: 'Arjun',
  email: 'arjun@test.com',
  phone: '9876543210',
  surl: 'https://api.flent.in/success',
  furl: 'https://api.flent.in/failure',
  hash: 'abc123hash',
  vas_hash: 'vashash456',
  prd_hash: 'prdhash789',
  user_credential: 'test_merchant_key:arjun@test.com',
  udf1: 'field1',
  udf2: 'field2',
  udf3: '',
  udf4: '',
  udf5: '',
};

const cardInstrumentParams = {
  bankcode: 'CC' as const,
  card_number: '4111111111111111',
  cvv: '123',
  expiry_year: '2028',
  expiry_month: '12',
  name_on_card: 'Arjun Kumar',
};

const nbInstrumentParams = {
  bankcode: 'HDFCB',
};

const upiInstrumentParams = {
  vpa: 'arjun@okicici',
};

// Type for the service module
interface CoreServiceModule {
  launchCorePayment: (
    mode: CorePaymentMode,
    sessionParams: PayUSessionParams,
    instrumentParams: InstrumentParams,
  ) => Promise<CorePaymentOutcome>;
  isCoreSdkAvailable: () => boolean;
}

/**
 * Load the service with CBWrapper available (mock native module).
 * Uses jest.doMock + jest.resetModules so each describe gets a fresh module.
 */
function loadServiceWithCBWrapper(): CoreServiceModule {
  jest.resetModules();
  mockOpenCB.mockReset();
  jest.doMock('payu-custom-browser-react', () => ({
    default: { openCB: mockOpenCB },
  }), { virtual: true });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../payment/payuCoreService');
}

/**
 * Load the service WITHOUT CBWrapper (simulates Expo Go / missing native module).
 * Mocks the module to throw on require, so the source try/catch sets CBWrapper = null.
 */
function loadServiceWithoutCBWrapper(): CoreServiceModule {
  jest.resetModules();
  jest.doMock('payu-custom-browser-react', () => {
    throw new Error('Cannot find native module');
  }, { virtual: true });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../payment/payuCoreService');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('payuCoreService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    DeviceEventEmitter.removeAllListeners('CBListener');
  });

  // ===================================================
  // MOCK FALLBACK (CBWrapper unavailable)
  // ===================================================

  describe('mock fallback when CBWrapper is null', () => {
    let service: CoreServiceModule;

    beforeAll(() => {
      service = loadServiceWithoutCBWrapper();
    });

    it('runs mockCorePayment in __DEV__ mode (2s delay, 90% success)', async () => {
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const promise = service.launchCorePayment('CC', baseSessionParams, cardInstrumentParams);

      // Advance past the 2-second mock delay
      jest.advanceTimersByTime(2000);

      const result = await promise;

      expect(result.status).toBe('success');
      expect(result.payuResponse).toEqual({
        status: 'success',
        txnid: 'TXN_001',
        amount: '25000',
      });
      expect(warnSpy).toHaveBeenCalledWith(
        'PayU Core SDK not available \u2014 using mock payment'
      );

      randomSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('mock returns failure when random >= MOCK_SUCCESS_RATE', async () => {
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.95);
      jest.spyOn(console, 'warn').mockImplementation(() => {});

      const promise = service.launchCorePayment('NB', baseSessionParams, nbInstrumentParams);
      jest.advanceTimersByTime(2000);

      const result = await promise;

      expect(result.status).toBe('failure');
      expect(result.error).toBe('Payment declined by bank (mock)');

      randomSpy.mockRestore();
    });

    it('returns immediate failure in production when CBWrapper is null', async () => {
      const originalDev = (global as Record<string, unknown>).__DEV__;
      (global as Record<string, unknown>).__DEV__ = false;

      // Re-import with __DEV__ false
      const prodService = loadServiceWithoutCBWrapper();

      const result = await prodService.launchCorePayment('CC', baseSessionParams, cardInstrumentParams);

      expect(result.status).toBe('failure');
      expect(result.error).toBe('PayU Core SDK not available. Please update the app.');

      (global as Record<string, unknown>).__DEV__ = originalDev;
      // Reload service for remaining tests in this block
      service = loadServiceWithoutCBWrapper();
    });

    it('isCoreSdkAvailable returns false when CBWrapper is null', () => {
      expect(service.isCoreSdkAvailable()).toBe(false);
    });
  });

  // ===================================================
  // PARAM BUILDING (CBWrapper available)
  // ===================================================

  describe('param building', () => {
    let service: CoreServiceModule;

    beforeAll(() => {
      service = loadServiceWithCBWrapper();
    });

    it('builds CC/DC params with card instrument merged', () => {
      service.launchCorePayment('CC', baseSessionParams, cardInstrumentParams);

      expect(mockOpenCB).toHaveBeenCalledTimes(1);
      const callArgs = mockOpenCB.mock.calls[0];
      const config = callArgs[0];
      // Native SDK expects snake_case key
      const params = config.payu_payment_params;

      // Core fields
      expect(params.key).toBe('test_merchant_key');
      expect(params.transaction_id).toBe('TXN_001');
      expect(params.amount).toBe('25000');

      // Hashes
      expect(params.hashes).toEqual({
        payment: 'abc123hash',
        vas: 'vashash456',
        payment_related_details: 'prdhash789',
      });

      // Additional params
      expect(params.additional_param).toEqual({
        udf1: 'field1',
        udf2: 'field2',
        udf3: '',
        udf4: '',
        udf5: '',
      });

      // Card instrument merged at top level
      expect(params.bankcode).toBe('CC');
      expect(params.card_number).toBe('4111111111111111');
      expect(params.cvv).toBe('123');
      expect(params.expiry_year).toBe('2028');
      expect(params.expiry_month).toBe('12');
      expect(params.name_on_card).toBe('Arjun Kumar');

      // openCB takes 3 args: config, errorCb, successCb (no mode arg)
      expect(callArgs).toHaveLength(3);
      expect(typeof callArgs[1]).toBe('function'); // errorCallback
      expect(typeof callArgs[2]).toBe('function'); // successCallback
    });

    it('builds NB params with bankcode merged', () => {
      service.launchCorePayment('NB', baseSessionParams, nbInstrumentParams);

      const params = mockOpenCB.mock.calls[0][0].payu_payment_params;

      expect(params.bankcode).toBe('HDFCB');
      expect(params.key).toBe('test_merchant_key');
      expect(params.hashes.payment).toBe('abc123hash');
    });

    it('builds UPI params with vpa merged', () => {
      service.launchCorePayment('upi', baseSessionParams, upiInstrumentParams);

      const params = mockOpenCB.mock.calls[0][0].payu_payment_params;

      expect(params.vpa).toBe('arjun@okicici');
      expect(params.key).toBe('test_merchant_key');
    });

    it('sets environment to "1" in __DEV__ mode', () => {
      service.launchCorePayment('CC', baseSessionParams, cardInstrumentParams);

      const params = mockOpenCB.mock.calls[0][0].payu_payment_params;
      expect(params.environment).toBe('1');
    });

    it('sets environment to "0" in production', () => {
      const originalDev = (global as Record<string, unknown>).__DEV__;
      (global as Record<string, unknown>).__DEV__ = false;

      const prodService = loadServiceWithCBWrapper();
      prodService.launchCorePayment('CC', baseSessionParams, cardInstrumentParams);

      const params = mockOpenCB.mock.calls[0][0].payu_payment_params;
      expect(params.environment).toBe('0');

      (global as Record<string, unknown>).__DEV__ = originalDev;
      service = loadServiceWithCBWrapper();
    });

    it('omits vas and prd hashes when not provided', () => {
      const sessionWithoutOptionalHashes: PayUSessionParams = {
        ...baseSessionParams,
        vas_hash: undefined,
        prd_hash: undefined,
      };

      service.launchCorePayment('CC', sessionWithoutOptionalHashes, cardInstrumentParams);

      const params = mockOpenCB.mock.calls[0][0].payu_payment_params;
      expect(params.hashes).toEqual({
        payment: 'abc123hash',
      });
      expect(params.hashes.vas).toBeUndefined();
      expect(params.hashes.payment_related_details).toBeUndefined();
    });
  });

  // ===================================================
  // SUCCESS / FAILURE CALLBACKS
  // ===================================================

  describe('callbacks', () => {
    let service: CoreServiceModule;

    beforeAll(() => {
      service = loadServiceWithCBWrapper();
    });

    it('does NOT resolve on successCallback (webview presented, not payment success)', async () => {
      // successCallback means "webview opened" — promise should NOT resolve yet
      mockOpenCB.mockImplementation(
        (_config: unknown, _errorCb: (e: string) => void, successCb: (r: string) => void) => {
          successCb('Payment Initiated');
        }
      );

      const promise = service.launchCorePayment('CC', baseSessionParams, cardInstrumentParams);

      let resolved = false;
      promise.then(() => { resolved = true; });
      jest.advanceTimersByTime(0);
      expect(resolved).toBe(false);

      // Now emit actual payment success via CBListener
      DeviceEventEmitter.emit('CBListener', {
        eventType: 'onPaymentSuccess',
        payuResult: JSON.stringify({ status: 'success', txnid: 'TXN_001', amount: '25000' }),
      });

      const result = await promise;
      expect(result.status).toBe('success');
      expect(result.payuResponse).toEqual({ status: 'success', txnid: 'TXN_001', amount: '25000' });
    });

    it('resolves failure when errorCallback is invoked', async () => {
      mockOpenCB.mockImplementation(
        (_config: unknown, errorCb: (e: string) => void) => {
          errorCb('Bank server down');
        }
      );

      const result = await service.launchCorePayment('NB', baseSessionParams, nbInstrumentParams);

      expect(result.status).toBe('failure');
      expect(result.error).toBe('Bank server down');
    });
  });

  // ===================================================
  // CBLISTENER EVENTS
  // ===================================================

  describe('CBListener events', () => {
    let service: CoreServiceModule;

    beforeAll(() => {
      service = loadServiceWithCBWrapper();
    });

    beforeEach(() => {
      // Simulate SDK opening webview (successCallback fires, promise stays pending)
      mockOpenCB.mockImplementation(
        (_config: unknown, _errorCb: (e: string) => void, successCb: (r: string) => void) => {
          successCb('Payment Initiated');
        }
      );
    });

    it('resolves success on onPaymentSuccess event', async () => {
      const promise = service.launchCorePayment('CC', baseSessionParams, cardInstrumentParams);

      DeviceEventEmitter.emit('CBListener', {
        eventType: 'onPaymentSuccess',
        payuResult: JSON.stringify({
          status: 'success',
          txnid: 'TXN_001',
          amount: '25000',
        }),
      });

      const result = await promise;

      expect(result.status).toBe('success');
      expect(result.payuResponse).toEqual({
        status: 'success',
        txnid: 'TXN_001',
        amount: '25000',
      });
    });

    it('resolves failure on onPaymentFailure event', async () => {
      const promise = service.launchCorePayment('CC', baseSessionParams, cardInstrumentParams);

      DeviceEventEmitter.emit('CBListener', {
        eventType: 'onPaymentFailure',
        payuResult: JSON.stringify({
          status: 'failure',
          error_Message: 'Insufficient funds',
          txnid: 'TXN_001',
        }),
      });

      const result = await promise;

      expect(result.status).toBe('failure');
      expect(result.payuResponse).toEqual({
        status: 'failure',
        error_Message: 'Insufficient funds',
        txnid: 'TXN_001',
      });
      expect(result.error).toBe('Insufficient funds');
    });

    it('resolves cancelled on onPaymentTerminate without txn initiated', async () => {
      const promise = service.launchCorePayment('CC', baseSessionParams, cardInstrumentParams);

      DeviceEventEmitter.emit('CBListener', {
        eventType: 'onPaymentTerminate',
        isTxnInitiated: false,
      });

      const result = await promise;

      expect(result.status).toBe('cancelled');
      expect(result.isTxnInitiated).toBe(false);
    });

    it('resolves cancelled on onPaymentTerminate with txn initiated', async () => {
      const promise = service.launchCorePayment('CC', baseSessionParams, cardInstrumentParams);

      DeviceEventEmitter.emit('CBListener', {
        eventType: 'onPaymentTerminate',
        isTxnInitiated: true,
      });

      const result = await promise;

      expect(result.status).toBe('cancelled');
      expect(result.isTxnInitiated).toBe(true);
    });

    it('resolves failure on onCBErrorReceived event', async () => {
      const promise = service.launchCorePayment('CC', baseSessionParams, cardInstrumentParams);

      DeviceEventEmitter.emit('CBListener', {
        eventType: 'onCBErrorReceived',
        error: 'Custom Browser crashed',
      });

      const result = await promise;

      expect(result.status).toBe('failure');
      expect(result.error).toBe('Custom Browser crashed');
    });

    it('resolves cancelled on onBackButton event', async () => {
      const promise = service.launchCorePayment('CC', baseSessionParams, cardInstrumentParams);

      DeviceEventEmitter.emit('CBListener', {
        eventType: 'onBackButton',
      });

      const result = await promise;

      expect(result.status).toBe('cancelled');
      expect(result.isTxnInitiated).toBe(false);
    });

    it('resolves cancelled on onBackApprove event', async () => {
      const promise = service.launchCorePayment('CC', baseSessionParams, cardInstrumentParams);

      DeviceEventEmitter.emit('CBListener', {
        eventType: 'onBackApprove',
      });

      const result = await promise;

      expect(result.status).toBe('cancelled');
      expect(result.isTxnInitiated).toBe(false);
    });

    it('resolves cancelled on onBackDismiss event', async () => {
      const promise = service.launchCorePayment('CC', baseSessionParams, cardInstrumentParams);

      DeviceEventEmitter.emit('CBListener', {
        eventType: 'onBackDismiss',
      });

      const result = await promise;

      expect(result.status).toBe('cancelled');
      expect(result.isTxnInitiated).toBe(false);
    });

    it('ignores unknown CBListener event (promise stays pending)', () => {
      const promise = service.launchCorePayment('CC', baseSessionParams, cardInstrumentParams);

      DeviceEventEmitter.emit('CBListener', {
        eventType: 'someRandomEvent',
      });

      // The promise should NOT have resolved yet.
      let resolved = false;
      promise.then(() => {
        resolved = true;
      });

      // Flush microtask queue
      jest.advanceTimersByTime(0);

      expect(resolved).toBe(false);
    });

    it('handles eveneType typo from SDK', async () => {
      const promise = service.launchCorePayment('CC', baseSessionParams, cardInstrumentParams);

      // SDK sends "eveneType" instead of "eventType" on some events
      DeviceEventEmitter.emit('CBListener', {
        eveneType: 'onPaymentTerminate',
        isTxnInitiated: false,
      });

      const result = await promise;

      expect(result.status).toBe('cancelled');
      expect(result.isTxnInitiated).toBe(false);
    });
  });

  // ===================================================
  // SDK EXCEPTION HANDLING
  // ===================================================

  describe('SDK startup exception', () => {
    let service: CoreServiceModule;

    beforeAll(() => {
      service = loadServiceWithCBWrapper();
    });

    it('resolves failure when openCB throws', async () => {
      mockOpenCB.mockImplementation(() => {
        throw new Error('Native module crash');
      });

      const result = await service.launchCorePayment('CC', baseSessionParams, cardInstrumentParams);

      expect(result.status).toBe('failure');
      expect(result.error).toBe('Native module crash');
    });

    it('resolves failure with generic message for non-Error throw', async () => {
      mockOpenCB.mockImplementation(() => {
        throw 'some string error'; // eslint-disable-line no-throw-literal
      });

      const result = await service.launchCorePayment('CC', baseSessionParams, cardInstrumentParams);

      expect(result.status).toBe('failure');
      expect(result.error).toBe('Failed to start payment');
    });
  });

  // ===================================================
  // DOUBLE RESOLUTION GUARD
  // ===================================================

  describe('double resolution guard', () => {
    let service: CoreServiceModule;

    beforeAll(() => {
      service = loadServiceWithCBWrapper();
    });

    it('prevents second resolution after first', async () => {
      mockOpenCB.mockImplementation(
        (_config: unknown, errorCb: (e: string) => void, successCb: (r: string) => void) => {
          // errorCb fires first, then late successCb — second should be ignored
          errorCb('Init error');
          successCb('Payment Initiated');
        }
      );

      const result = await service.launchCorePayment('CC', baseSessionParams, cardInstrumentParams);

      expect(result.status).toBe('failure');
      expect(result.error).toBe('Init error');
    });

    it('prevents CBListener event from resolving after callback already resolved', async () => {
      mockOpenCB.mockImplementation(
        (_config: unknown, errorCb: (e: string) => void) => {
          errorCb('Callback error');
        }
      );

      const promise = service.launchCorePayment('CC', baseSessionParams, cardInstrumentParams);

      // This event fires after the error callback already resolved the promise
      DeviceEventEmitter.emit('CBListener', {
        eventType: 'onPaymentFailure',
        payuResult: '{"status":"failure"}',
      });

      const result = await promise;

      expect(result.status).toBe('failure');
      expect(result.error).toBe('Callback error');
    });
  });

  // ===================================================
  // parseSDKResponse (tested indirectly via callbacks)
  // ===================================================

  describe('parseSDKResponse behavior (via CBListener events)', () => {
    let service: CoreServiceModule;

    beforeAll(() => {
      service = loadServiceWithCBWrapper();
    });

    beforeEach(() => {
      mockOpenCB.mockImplementation(
        (_config: unknown, _errorCb: (e: string) => void, successCb: (r: string) => void) => {
          successCb('Payment Initiated');
        }
      );
    });

    it('passes through object responses', async () => {
      const responseObj = { status: 'success', txnid: 'TXN_001' };
      const promise = service.launchCorePayment('CC', baseSessionParams, cardInstrumentParams);

      DeviceEventEmitter.emit('CBListener', {
        eventType: 'onPaymentSuccess',
        payuResult: responseObj,
      });

      const result = await promise;
      expect(result.payuResponse).toEqual(responseObj);
    });

    it('handles null/undefined response gracefully', async () => {
      const promise = service.launchCorePayment('CC', baseSessionParams, cardInstrumentParams);

      DeviceEventEmitter.emit('CBListener', {
        eventType: 'onPaymentSuccess',
        payuResult: null,
        merchantResponse: null,
      });

      const result = await promise;
      expect(result.status).toBe('success');
      expect(result.payuResponse).toBeUndefined();
    });

    it('handles invalid JSON string gracefully', async () => {
      const promise = service.launchCorePayment('CC', baseSessionParams, cardInstrumentParams);

      DeviceEventEmitter.emit('CBListener', {
        eventType: 'onPaymentSuccess',
        payuResult: 'not valid json {{{',
      });

      const result = await promise;
      expect(result.status).toBe('success');
      expect(result.payuResponse).toBeUndefined();
    });

    it('parses valid JSON string', async () => {
      const promise = service.launchCorePayment('CC', baseSessionParams, cardInstrumentParams);

      DeviceEventEmitter.emit('CBListener', {
        eventType: 'onPaymentSuccess',
        payuResult: '{"status":"success","amount":"25000"}',
      });

      const result = await promise;
      expect(result.payuResponse).toEqual({ status: 'success', amount: '25000' });
    });
  });

  // ===================================================
  // isCoreSdkAvailable
  // ===================================================

  describe('isCoreSdkAvailable', () => {
    it('returns true when CBWrapper is loaded', () => {
      const service = loadServiceWithCBWrapper();
      expect(service.isCoreSdkAvailable()).toBe(true);
    });

    it('returns false when CBWrapper is null', () => {
      const service = loadServiceWithoutCBWrapper();
      expect(service.isCoreSdkAvailable()).toBe(false);
    });
  });
});
