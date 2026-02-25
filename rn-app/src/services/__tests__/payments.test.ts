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
    it('maps is_primary to is_default, upi_vpa to vpa, card_last4 to last_four', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          data: {
            payment_methods: [
              {
                id: 'pm-001',
                type: 'upi',
                display_name: 'UPI - ICICI',
                is_primary: true,
                is_verified: true,
                nickname: null,
                created_at: '2026-01-01T00:00:00Z',
                upi_vpa: 'test@icici',
                upi_provider: 'ICICI',
              },
              {
                id: 'pm-002',
                type: 'card',
                display_name: 'Visa ****4321',
                is_primary: false,
                is_verified: true,
                nickname: null,
                created_at: '2026-01-01T00:00:00Z',
                card_last4: '4321',
                card_network: 'visa',
                card_type: 'credit',
              },
            ],
            primary_method_id: 'pm-001',
            grouped_methods: { upi: [], cards: [], netbanking: [] },
            total_count: 2,
          },
        },
        error: null,
      });

      const result = await getSavedPaymentMethods();

      expect(result.data![0].is_default).toBe(true);
      expect(result.data![0].vpa).toBe('test@icici');
      expect(result.data![1].last_four).toBe('4321');
      expect(result.primaryMethodId).toBe('pm-001');
    });

    it('returns mock data in dev mode on error', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: null,
        error: 'Auth error',
      });

      const result = await getSavedPaymentMethods();

      // __DEV__ is true, so mock data is returned
      expect(result.data).toBeTruthy();
      expect(result.data!.length).toBeGreaterThan(0);
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
});
