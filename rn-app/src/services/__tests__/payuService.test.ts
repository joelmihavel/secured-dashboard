/**
 * PayU Service -- Integration Tests
 *
 * Tests payment initiation, PayU SDK launch (mock path), and status verification.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCallEdgeFunction = jest.fn();
const mockSupabaseFrom = jest.fn();

jest.mock('../../services/supabase/client', () => ({
  __esModule: true,
  callEdgeFunction: (...args: unknown[]) => mockCallEdgeFunction(...args),
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
  },
  getFunctionsUrl: jest.fn(),
}));

jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

import {
  initiatePayUPayment,
  launchPayUCheckout,
  mockPayUCheckout,
  verifyPaymentStatus,
  updatePaymentStatus,
} from '../payment/payuService';

import type { PayUPaymentParams } from '../payment/payuService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SAMPLE_PAYU_PARAMS: PayUPaymentParams = {
  key: 'PLycrf',
  txnid: 'txn-001',
  amount: '25000',
  productinfo: 'Rent',
  firstname: 'Test',
  email: 'test@test.com',
  phone: '+91999',
  hash: 'hashvalue',
  surl: 'https://surl',
  furl: 'https://furl',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PayU Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // initiatePayUPayment
  // =========================================================================
  describe('initiatePayUPayment', () => {
    it('maps camelCase params to snake_case and returns paymentId + payuParams', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          data: {
            payment_id: 'pay-001',
            txn_id: 'txn-001',
            amount_paise: 2500000,
            payu: SAMPLE_PAYU_PARAMS,
          },
        },
        error: null,
      });

      const result = await initiatePayUPayment({
        tenancyId: 'ten-001',
        amountPaise: 2500000,
        paymentMethod: 'upi',
        applyCashback: true,
        rentMonth: '2026-02',
      });

      expect(result.data).toEqual({
        paymentId: 'pay-001',
        payuParams: SAMPLE_PAYU_PARAMS,
      });

      const [, body] = mockCallEdgeFunction.mock.calls[0];
      expect(body.tenancy_id).toBe('ten-001');
      expect(body.amount_paise).toBe(2500000);
      expect(body.payment_method).toBe('upi');
      expect(body.apply_cashback).toBe(true);
      expect(body.rent_month).toBe('2026-02');
    });

    it('returns error on edge function failure', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: null,
        error: 'Auth required',
      });

      const result = await initiatePayUPayment({
        tenancyId: 'ten-001',
        amountPaise: 2500000,
        paymentMethod: 'upi',
        applyCashback: false,
        rentMonth: '2026-02',
      });

      expect(result.error).toBe('Auth required');
    });

    it('returns error when success=false', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: { success: false },
        error: null,
      });

      const result = await initiatePayUPayment({
        tenancyId: 'ten-001',
        amountPaise: 2500000,
        paymentMethod: 'card',
        applyCashback: false,
        rentMonth: '2026-02',
      });

      expect(result.error).toBe('Failed to initiate payment');
    });
  });

  // =========================================================================
  // launchPayUCheckout (mock path)
  // =========================================================================
  describe('launchPayUCheckout', () => {
    it('uses mock checkout when SDK is not available (Expo Go)', async () => {
      // PayUBizSdk is null in test environment (no native module)
      // mockPayUCheckout uses setTimeout which needs fake timer advancement
      const resultPromise = launchPayUCheckout(SAMPLE_PAYU_PARAMS);
      jest.advanceTimersByTime(5000);
      const result = await resultPromise;

      // mockPayUCheckout returns success or failure randomly
      expect(['success', 'failure']).toContain(result.status);
    });
  });

  // =========================================================================
  // mockPayUCheckout
  // =========================================================================
  describe('mockPayUCheckout', () => {
    it('simulates checkout with delay', async () => {
      // mockPayUCheckout uses setTimeout internally, must advance timers
      const resultPromise = mockPayUCheckout(SAMPLE_PAYU_PARAMS, 10);
      jest.advanceTimersByTime(100);
      const result = await resultPromise;

      expect(['success', 'failure']).toContain(result.status);
      if (result.status === 'success') {
        expect(result.txnid).toBe('txn-001');
        expect(result.payuResponse?.status).toBe('success');
      }
    });

    it('returns txnid in success case', async () => {
      // Force success by mocking Math.random
      jest.spyOn(Math, 'random').mockReturnValue(0.1); // < 0.9 threshold

      const resultPromise = mockPayUCheckout(SAMPLE_PAYU_PARAMS, 10);
      jest.advanceTimersByTime(100);
      const result = await resultPromise;

      expect(result.status).toBe('success');
      expect(result.txnid).toBe('txn-001');
      expect(result.payuResponse?.amount).toBe('25000');

      jest.restoreAllMocks();
    });

    it('returns failure when random > threshold', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.95); // > 0.9 threshold

      const resultPromise = mockPayUCheckout(SAMPLE_PAYU_PARAMS, 10);
      jest.advanceTimersByTime(100);
      const result = await resultPromise;

      expect(result.status).toBe('failure');
      expect(result.error).toBe('Payment declined by bank');

      jest.restoreAllMocks();
    });
  });

  // =========================================================================
  // verifyPaymentStatus
  // =========================================================================
  describe('verifyPaymentStatus', () => {
    function mockSelectSingle(data: unknown, error: unknown = null) {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data, error }),
      };
      mockSupabaseFrom.mockReturnValue(chain);
      return chain;
    }

    it('returns success for success status', async () => {
      mockSelectSingle({ status: 'success' });

      const result = await verifyPaymentStatus('pay-001');

      expect(result.status).toBe('success');
    });

    it('returns failure for failed status', async () => {
      mockSelectSingle({ status: 'failed' });

      const result = await verifyPaymentStatus('pay-001');

      expect(result.status).toBe('failure');
    });

    it('returns failure for refunded status', async () => {
      mockSelectSingle({ status: 'refunded' });

      const result = await verifyPaymentStatus('pay-001');

      expect(result.status).toBe('failure');
    });

    it('returns pending for processing status', async () => {
      mockSelectSingle({ status: 'processing' });

      const result = await verifyPaymentStatus('pay-001');

      expect(result.status).toBe('pending');
    });

    it('returns pending for initiated status', async () => {
      mockSelectSingle({ status: 'initiated' });

      const result = await verifyPaymentStatus('pay-001');

      expect(result.status).toBe('pending');
    });

    it('returns pending with error on supabase error', async () => {
      mockSelectSingle(null, { message: 'Row not found' });

      const result = await verifyPaymentStatus('pay-nonexistent');

      expect(result.status).toBe('pending');
      expect(result.error).toBe('Row not found');
    });

    it('returns pending with error when data is null', async () => {
      mockSelectSingle(null);

      const result = await verifyPaymentStatus('pay-nonexistent');

      expect(result.status).toBe('pending');
      expect(result.error).toBe('Payment not found');
    });
  });

  // =========================================================================
  // updatePaymentStatus
  // =========================================================================
  describe('updatePaymentStatus', () => {
    function mockUpdateChain(error: unknown = null) {
      const chain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error }),
      };
      mockSupabaseFrom.mockReturnValue(chain);
      return chain;
    }

    it('stores client SDK response as metadata', async () => {
      const chain = mockUpdateChain();

      const result = await updatePaymentStatus('pay-001', {
        status: 'success',
        txnid: 'txn-001',
      });

      expect(result.success).toBe(true);
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_method_details: expect.objectContaining({
            client_sdk_response: { status: 'success', txnid: 'txn-001' },
            client_reported_status: 'success',
          }),
        })
      );
    });

    it('returns error on supabase failure', async () => {
      mockUpdateChain({ message: 'Update denied' });

      const result = await updatePaymentStatus('pay-001', { status: 'failure' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update denied');
    });
  });
});
