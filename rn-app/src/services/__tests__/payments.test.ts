/**
 * Payments API Service -- Integration Tests
 *
 * Tests payment initiation, history, receipts, saved payment methods,
 * scheduling, cashback history, and utility formatters.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCallEdgeFunction = jest.fn();

jest.mock('../supabase/client', () => ({
  __esModule: true,
  callEdgeFunction: (...args: unknown[]) => mockCallEdgeFunction(...args),
  supabase: {},
  getFunctionsUrl: jest.fn(),
}));

// Mock the dynamic import used by getSavedPaymentMethods in __DEV__ mode
jest.mock('../api/__mocks__/payments-mock', () => ({
  __esModule: true,
  MOCK_SAVED_PAYMENT_METHODS: [
    {
      id: 'pm-mock-upi-001',
      type: 'upi',
      display_name: 'UPI - ICICI',
      is_default: true,
      is_verified: true,
      nickname: null,
      created_at: '2025-08-15T10:00:00Z',
      vpa: 'rishabh@icici',
      upi_provider: 'ICICI',
    },
  ],
}));

import {
  initiatePayment,
  fetchPaymentHistory,
  generateReceipt,
  getSavedPaymentMethods,
  addUpiVpa,
  addCardToken,
  deletePaymentMethod,
  createPaymentSchedule,
  managePaymentSchedule,
  getPaymentSchedules,
  getSavingsHistory,
  formatAmount,
  formatRupees,
  getCurrentRentMonth,
  sanitizeErrorForUI,
  checkPaymentStatus,
  fetchPaymentStamps,
  verifyUpiVpa,
  setDefaultPaymentMethod,
} from '../api/payments';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Payments API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // initiatePayment
  // =========================================================================
  describe('initiatePayment', () => {
    it('returns payment data with PayU params on success', async () => {
      const payuParams = {
        key: 'PLycrf',
        txnid: 'txn-001',
        amount: '25000',
        productinfo: 'Rent Feb 2026',
        firstname: 'Test',
        email: 'test@flent.in',
        phone: '+91999',
        hash: 'abc123hash',
        surl: 'https://surl',
        furl: 'https://furl',
        curl: 'https://curl',
        udf1: '', udf2: '', udf3: '',
      };

      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          data: {
            payment_id: 'pay-001',
            txn_id: 'txn-001',
            amount_paise: 2500000,
            pg_fee_paise: 50000,
            cashback_applied_paise: 0,
            total_paise: 2550000,
            payment_method: 'upi',
            payu: payuParams,
          },
        },
        error: null,
      });

      const result = await initiatePayment({
        tenancy_id: 'ten-001',
        payment_method: 'upi',
        rent_month: '2026-02',
      });

      expect(result.data?.payment_id).toBe('pay-001');
      expect(result.data?.payu).toEqual(payuParams);
      expect(result.error).toBeNull();
    });

    it('maps "already paid" error', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: null,
        error: 'Payment already paid for this month',
      });

      const result = await initiatePayment({
        tenancy_id: 'ten-001',
        payment_method: 'upi',
        rent_month: '2026-02',
      });

      expect(result.error?.code).toBe('ALREADY_PAID');
    });

    it('maps "payment in progress" error', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: null,
        error: 'Another payment in progress',
      });

      const result = await initiatePayment({
        tenancy_id: 'ten-001',
        payment_method: 'card',
        rent_month: '2026-02',
      });

      expect(result.error?.code).toBe('PAYMENT_IN_PROGRESS');
    });

    it('maps auth error', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: null,
        error: 'Not authenticated',
      });

      const result = await initiatePayment({
        tenancy_id: 'ten-001',
        payment_method: 'upi',
        rent_month: '2026-02',
      });

      expect(result.error?.code).toBe('AUTH_ERROR');
    });

    it('returns INITIATION_FAILED when success=false', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: { success: false },
        error: null,
      });

      const result = await initiatePayment({
        tenancy_id: 'ten-001',
        payment_method: 'upi',
        rent_month: '2026-02',
      });

      expect(result.error?.code).toBe('INITIATION_FAILED');
    });
  });

  // =========================================================================
  // fetchPaymentHistory
  // =========================================================================
  describe('fetchPaymentHistory', () => {
    it('returns mapped payment history on success', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          data: {
            payments: [
              {
                id: 'pay-001',
                amount: 25000,
                pg_fee: 500,
                cashback_applied: 200,
                cashback_earned: 200,
                net_amount: 24800,
                status: 'success',
                payment_method: 'upi',
                rent_month: '2026-01',
                created_at: '2026-01-05T10:00:00Z',
                paid_at: '2026-01-05T10:30:00Z',
                can_download_receipt: true,
                tenancy: { id: 'ten-001', property_address: '42 St', landlord_name: 'Priya' },
              },
            ],
            pagination: { page: 1, limit: 20, total: 1, total_pages: 1, has_next: false, has_previous: false },
            summary: { total_paid: 25000, total_cashback_earned: 200, successful_payments: 1, failed_payments: 0 },
            filters_applied: {},
          },
        },
        error: null,
      });

      const result = await fetchPaymentHistory(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.data![0].amount).toBe(25000);
      expect(result.data![0].amount_paise).toBe(2500000); // derived
      expect(result.pagination?.total).toBe(1);
      expect(result.summary?.total_paid).toBe(25000);
      expect(result.error).toBeNull();
    });

    it('builds query params with filters', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: { success: true, data: { payments: [], pagination: {}, summary: {} } },
        error: null,
      });

      await fetchPaymentHistory(2, 10, { status: 'success', tenancy_id: 'ten-001' });

      const [functionName] = mockCallEdgeFunction.mock.calls[0];
      expect(functionName).toContain('page=2');
      expect(functionName).toContain('limit=10');
      expect(functionName).toContain('status=success');
      expect(functionName).toContain('tenancy_id=ten-001');
    });

    it('returns error on edge function failure', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: null,
        error: 'Service unavailable',
      });

      const result = await fetchPaymentHistory();

      expect(result.error).toBe('Service unavailable');
      expect(result.data).toBeNull();
    });
  });

  // =========================================================================
  // generateReceipt
  // =========================================================================
  describe('generateReceipt', () => {
    it('returns mapped receipt data', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          data: {
            receipt_number: 'R-001',
            generated_at: '2026-01-10T10:00:00Z',
            payment: {
              id: 'pay-001',
              transaction_id: 'txn-001',
              payment_gateway_id: 'pg-001',
              amount: 25000,
              pg_fee: 500,
              cashback_applied: 0,
              cashback_earned: 200,
              net_amount_paid: 25500,
              payment_method: 'upi',
              status: 'success',
              rent_month: '2026-01',
              rent_month_display: 'January 2026',
              paid_at: '2026-01-05T10:30:00Z',
            },
            tenant: { name: 'Alice', phone: '+91999', email: null },
            property: { address: '42 St', city: 'Bangalore' },
            landlord: { name: 'Bob', bank_account_masked: '****1234' },
            company: {
              name: 'Flent',
              address: '123 Co Rd',
              gstin: 'GST123',
              support_email: 'help@flent.in',
              support_phone: '+91800',
            },
          },
        },
        error: null,
      });

      const result = await generateReceipt('pay-001');

      expect(result.data?.receiptNumber).toBe('R-001');
      expect(result.data?.payment.transactionId).toBe('txn-001');
      expect(result.data?.landlord.bankAccountMasked).toBe('****1234');
      expect(result.data?.company.supportEmail).toBe('help@flent.in');
    });

    it('returns error on failure', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: null,
        error: 'Receipt generation failed',
      });

      const result = await generateReceipt('pay-001');

      expect(result.error).toBe('Receipt generation failed');
    });
  });

  // =========================================================================
  // getSavedPaymentMethods
  // =========================================================================
  describe('getSavedPaymentMethods', () => {
    // NOTE: DEV_USE_MOCK_PAYMENTS is disabled during Jest (process.env.JEST_WORKER_ID),
    // so these tests verify the real edge function integration path.

    it('returns mapped payment methods from edge function', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          data: {
            payment_methods: [
              {
                id: 'pm-1',
                type: 'upi',
                display_name: 'UPI - ICICI',
                is_default: true,
                is_verified: true,
                nickname: null,
                created_at: '2025-08-15T10:00:00Z',
                upi_vpa: 'rishabh@icici',
                upi_provider: 'ICICI',
              },
            ],
            primary_method_id: 'pm-1',
            grouped_methods: { upi: [], cards: [], netbanking: [] },
            total_count: 1,
          },
        },
        error: null,
      });

      const result = await getSavedPaymentMethods();

      expect(result.data).toBeTruthy();
      expect(result.data!.length).toBe(1);
      expect(result.data![0].is_default).toBe(true);
      expect(result.data![0].vpa).toBe('rishabh@icici');
      expect(result.primaryMethodId).toBe('pm-1');
      expect(mockCallEdgeFunction).toHaveBeenCalledWith('get-saved-payment-methods', {}, true, 'GET');
    });

    it('returns error when edge function fails', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: null,
        error: 'Auth error',
      });

      const result = await getSavedPaymentMethods();

      expect(result.data).toBeNull();
      expect(result.error).toBe('Auth error');
    });
  });

  // =========================================================================
  // addUpiVpa
  // =========================================================================
  describe('addUpiVpa', () => {
    it('sends upi_vpa (not vpa) to edge function', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          data: {
            payment_method_id: 'pm-new',
            upi_vpa: 'test@icici',
            upi_provider: 'ICICI',
            is_verified: true,
            is_primary: false,
            nickname: 'Test UPI',
          },
        },
        error: null,
      });

      const result = await addUpiVpa('test@icici', 'Test UPI', false);

      const [, body] = mockCallEdgeFunction.mock.calls[0];
      expect(body.upi_vpa).toBe('test@icici');
      expect(body.nickname).toBe('Test UPI');
      expect(result.data?.type).toBe('upi');
      expect(result.data?.vpa).toBe('test@icici');
    });
  });

  // =========================================================================
  // addCardToken
  // =========================================================================
  describe('addCardToken', () => {
    it('returns mapped card method on success', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          data: {
            payment_method_id: 'pm-card',
            card_last4: '9999',
            card_network: 'mastercard',
            card_type: 'debit',
            card_issuer: 'SBI',
            card_expiry_month: 12,
            card_expiry_year: 2028,
            is_primary: true,
            nickname: 'MC ****9999',
          },
        },
        error: null,
      });

      const result = await addCardToken({
        card_token: 'tok-123',
        card_last4: '9999',
        card_network: 'mastercard',
        card_type: 'debit',
        card_expiry_month: 12,
        card_expiry_year: 2028,
      });

      expect(result.data?.type).toBe('card');
      expect(result.data?.last_four).toBe('9999');
      expect(result.data?.is_default).toBe(true);
    });
  });

  // =========================================================================
  // deletePaymentMethod
  // =========================================================================
  describe('deletePaymentMethod', () => {
    it('sends payment_method_id (not method_id) and returns new primary', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          data: {
            deleted_id: 'pm-001',
            was_primary: true,
            new_primary_id: 'pm-002',
            hard_deleted: false,
          },
        },
        error: null,
      });

      const result = await deletePaymentMethod('pm-001');

      const [, body] = mockCallEdgeFunction.mock.calls[0];
      expect(body.payment_method_id).toBe('pm-001');
      expect(result.success).toBe(true);
      expect(result.newPrimaryId).toBe('pm-002');
    });

    it('returns error on failure', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: null,
        error: 'Method not found',
      });

      const result = await deletePaymentMethod('pm-nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Method not found');
    });
  });

  // =========================================================================
  // Payment scheduling
  // =========================================================================
  describe('createPaymentSchedule', () => {
    it('returns schedule data on success', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          data: {
            schedule_id: 'sch-001',
            tenancy_id: 'ten-001',
            payment_method: 'upi',
            scheduled_day: 5,
            auto_apply_cashback: true,
            status: 'active',
            next_execution_date: '2026-03-05',
            monthly_rent_paise: 2500000,
            created_at: '2026-02-01T00:00:00Z',
          },
        },
        error: null,
      });

      const result = await createPaymentSchedule({
        tenancy_id: 'ten-001',
        payment_method: 'upi',
        scheduled_day: 5,
      });

      expect(result.data?.schedule_id).toBe('sch-001');
      expect(result.data?.status).toBe('active');
    });
  });

  describe('managePaymentSchedule', () => {
    it('returns new status after action', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          data: { schedule_id: 'sch-001', new_status: 'paused' },
        },
        error: null,
      });

      const result = await managePaymentSchedule({
        action: 'pause',
        schedule_id: 'sch-001',
      });

      expect(result.data?.new_status).toBe('paused');
    });
  });

  describe('getPaymentSchedules', () => {
    it('returns list of schedules', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          data: { schedules: [{ id: 'sch-001' }, { id: 'sch-002' }] },
        },
        error: null,
      });

      const result = await getPaymentSchedules('ten-001', 'active');

      expect(result.data).toHaveLength(2);
    });
  });

  // =========================================================================
  // Cashback history
  // =========================================================================
  describe('getSavingsHistory', () => {
    it('returns cashback entries with pagination', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          data: {
            current_balance_paise: 20000,
            entries: [
              {
                id: 'cb-001',
                transaction_type: 'earned',
                amount_paise: 5000,
                balance_after_paise: 20000,
                description: 'January cashback',
                payment_id: 'pay-001',
                tenancy_id: 'ten-001',
                created_at: '2026-01-10T00:00:00Z',
              },
            ],
            pagination: { page: 1, limit: 20, total: 1, total_pages: 1, has_next: false, has_previous: false },
          },
        },
        error: null,
      });

      const result = await getSavingsHistory(1, 20);

      expect(result.data?.current_balance_paise).toBe(20000);
      expect(result.data?.entries).toHaveLength(1);
    });
  });

  // =========================================================================
  // Utility functions
  // =========================================================================
  describe('formatAmount', () => {
    it('converts paise to rupees with currency symbol', () => {
      expect(formatAmount(2500000)).toContain('25,000');
    });

    it('handles zero paise', () => {
      expect(formatAmount(0)).toContain('0');
    });
  });

  describe('formatRupees', () => {
    it('formats rupees with currency symbol', () => {
      expect(formatRupees(25000)).toContain('25,000');
    });
  });

  describe('getCurrentRentMonth', () => {
    it('returns current month in YYYY-MM format', () => {
      const result = getCurrentRentMonth();
      expect(result).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  // =========================================================================
  // sanitizeErrorForUI
  // =========================================================================
  describe('sanitizeErrorForUI', () => {
    it('sanitizes SQL SELECT statements', () => {
      expect(sanitizeErrorForUI('SELECT * FROM payments WHERE id = 1')).toBe(
        'Something went wrong. Please try again.'
      );
    });

    it('sanitizes SQL INSERT statements', () => {
      expect(sanitizeErrorForUI('INSERT INTO payments VALUES (1, 2)')).toBe(
        'Something went wrong. Please try again.'
      );
    });

    it('sanitizes SQL UPDATE statements', () => {
      expect(sanitizeErrorForUI('UPDATE payments SET status = "failed"')).toBe(
        'Something went wrong. Please try again.'
      );
    });

    it('sanitizes SQL DELETE statements', () => {
      expect(sanitizeErrorForUI('DELETE FROM payments WHERE id = 1')).toBe(
        'Something went wrong. Please try again.'
      );
    });

    it('sanitizes column name errors', () => {
      expect(
        sanitizeErrorForUI('column "payment_gateway_id" does not exist')
      ).toBe('Something went wrong. Please try again.');
    });

    it('sanitizes constraint violation errors', () => {
      expect(
        sanitizeErrorForUI(
          'violates unique constraint "payments_txn_id_key"'
        )
      ).toBe('Something went wrong. Please try again.');
    });

    it('sanitizes pg_ prefix errors', () => {
      expect(sanitizeErrorForUI('pg_catalog.pg_type error occurred')).toBe(
        'Something went wrong. Please try again.'
      );
    });

    it('passes through safe user-facing messages', () => {
      expect(sanitizeErrorForUI('Payment already completed for this month')).toBe(
        'Payment already completed for this month'
      );
    });

    it('returns default message for empty string', () => {
      expect(sanitizeErrorForUI('')).toBe(
        'Something went wrong. Please try again.'
      );
    });
  });

  // =========================================================================
  // checkPaymentStatus
  // =========================================================================
  describe('checkPaymentStatus', () => {
    it('returns full status response on success', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          data: {
            payment_id: 'pay-001',
            status: 'success',
            gateway_verified: true,
            amount_paise: 2500000,
            cashback_earned_paise: 20000,
            paid_at: '2026-02-05T10:30:00Z',
            error_message: null,
          },
        },
        error: null,
      });

      const result = await checkPaymentStatus('pay-001');

      expect(result.data?.payment_id).toBe('pay-001');
      expect(result.data?.status).toBe('success');
      expect(result.data?.gateway_verified).toBe(true);
      expect(result.data?.amount_paise).toBe(2500000);
      expect(result.data?.cashback_earned_paise).toBe(20000);
      expect(result.data?.paid_at).toBe('2026-02-05T10:30:00Z');
      expect(result.data?.error_message).toBeNull();
      expect(result.error).toBeNull();
    });

    it('returns error when edge function fails', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: null,
        error: 'Payment not found',
      });

      const result = await checkPaymentStatus('pay-nonexistent');

      expect(result.data).toBeNull();
      expect(result.error).toBe('Payment not found');
    });

    it('calls edge function with GET method and encoded payment_id', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: { data: { payment_id: 'pay-001', status: 'processing' } },
        error: null,
      });

      await checkPaymentStatus('pay-001');

      const [functionName, , , method] = mockCallEdgeFunction.mock.calls[0];
      expect(functionName).toContain('check-payment-status');
      expect(functionName).toContain('payment_id=pay-001');
      expect(method).toBe('GET');
    });
  });

  // =========================================================================
  // fetchPaymentStamps
  // =========================================================================
  describe('fetchPaymentStamps', () => {
    it('returns stamps and summary on success', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          data: {
            stamps: [
              {
                month: '2026-01',
                month_display: 'January 2026',
                status: 'on_time',
                payment_id: 'pay-001',
                paid_at: '2026-01-05T10:30:00Z',
                due_date: '2026-01-10',
                days_late: null,
                amount_paise: 2500000,
              },
              {
                month: '2026-02',
                month_display: 'February 2026',
                status: 'pending',
                payment_id: null,
                paid_at: null,
                due_date: '2026-02-10',
                days_late: null,
                amount_paise: null,
              },
            ],
            summary: {
              total_months: 2,
              on_time: 1,
              late: 0,
              missed: 0,
              pending: 1,
            },
          },
        },
        error: null,
      });

      const result = await fetchPaymentStamps('ten-001');

      expect(result.data?.stamps).toHaveLength(2);
      expect(result.data?.stamps[0].status).toBe('on_time');
      expect(result.data?.stamps[1].status).toBe('pending');
      expect(result.data?.summary.total_months).toBe(2);
      expect(result.data?.summary.on_time).toBe(1);
      expect(result.error).toBeNull();
    });

    it('encodes tenancy_id in query parameter', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: { success: true, data: { stamps: [], summary: {} } },
        error: null,
      });

      await fetchPaymentStamps('ten-with spaces');

      const [functionName] = mockCallEdgeFunction.mock.calls[0];
      expect(functionName).toContain(
        `tenancy_id=${encodeURIComponent('ten-with spaces')}`
      );
    });

    it('returns error when edge function fails', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: null,
        error: 'Service unavailable',
      });

      const result = await fetchPaymentStamps('ten-001');

      expect(result.data).toBeNull();
      expect(result.error).toBe('Service unavailable');
    });

    it('returns error when success is false', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: { success: false },
        error: null,
      });

      const result = await fetchPaymentStamps('ten-001');

      expect(result.data).toBeNull();
      expect(result.error).toBe('Failed to fetch payment stamps');
    });
  });

  // =========================================================================
  // verifyUpiVpa
  // =========================================================================
  describe('verifyUpiVpa', () => {
    it('returns valid VPA with account holder name', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          data: {
            valid: true,
            account_holder_name: 'Rishabh Sharma',
            upi_vpa: 'rishabh@okicici',
          },
        },
        error: null,
      });

      const result = await verifyUpiVpa('rishabh@okicici');

      expect(result.valid).toBe(true);
      expect(result.name).toBe('Rishabh Sharma');
      expect(result.vpa).toBe('rishabh@okicici');
    });

    it('sends upi_vpa with verify_only flag', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          data: { valid: true, upi_vpa: 'test@okicici' },
        },
        error: null,
      });

      await verifyUpiVpa('test@okicici');

      const [, body] = mockCallEdgeFunction.mock.calls[0];
      expect(body.upi_vpa).toBe('test@okicici');
      expect(body.verify_only).toBe(true);
    });

    it('returns error when edge function returns an error', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: null,
        error: 'VPA not found',
      });

      const result = await verifyUpiVpa('invalid@nowhere');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('VPA not found');
    });

    it('returns error when success is false', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: { success: false },
        error: null,
      });

      const result = await verifyUpiVpa('bad@vpa');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('VPA verification failed');
    });
  });

  // =========================================================================
  // setDefaultPaymentMethod
  // =========================================================================
  describe('setDefaultPaymentMethod', () => {
    it('returns success on valid response', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const result = await setDefaultPaymentMethod('pm-001');

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });

    it('sends payment_method_id in body', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      await setDefaultPaymentMethod('pm-002');

      const [, body] = mockCallEdgeFunction.mock.calls[0];
      expect(body.payment_method_id).toBe('pm-002');
    });

    it('returns error when edge function fails', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: null,
        error: 'Method not found',
      });

      const result = await setDefaultPaymentMethod('pm-nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Method not found');
    });

    it('returns error when success is false', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: { success: false },
        error: null,
      });

      const result = await setDefaultPaymentMethod('pm-001');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to set default payment method');
    });
  });
});
