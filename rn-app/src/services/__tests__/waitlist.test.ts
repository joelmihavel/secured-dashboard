/**
 * Waitlist API Service -- Integration Tests
 *
 * Tests waitlist status, referral code validation/application, and join flow.
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
  getWaitlistStatus,
  applyReferralCode,
  validateReferralCode,
  joinWaitlist,
  getMyReferralCode,
} from '../api/waitlist';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Waitlist API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // getWaitlistStatus
  // =========================================================================
  describe('getWaitlistStatus', () => {
    it('returns pending state for a new waitlist entry', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          has_entry: true,
          admin_review: 'pending',
          waitlist_position: 42,
          onboarded_count: 18,
          total_member_slots: 150,
          waitlist_entry: {
            id: 'wl-001',
            status: 'pending',
            extraction_status: 'completed',
            contract_status: 'user_review',
            requires_manual_review: false,
            manual_review_reason: null,
            waitlist_position: 42,
            document_uploaded: true,
            admin_review: 'pending',
            rejection_reasons: [],
            next_application_at: null,
            created_at: '2026-01-27T10:00:00Z',
          },
        },
        error: null,
      });

      const result = await getWaitlistStatus();

      expect(result.data?.state).toBe('pending');
      expect(result.data?.position).toBe(42);
      expect(result.data?.currentOnboarded).toBe(18);
      expect(result.data?.totalMemberSlots).toBe(150);
      expect(result.data?.submissionDate).toBeTruthy();
      expect(result.error).toBeNull();
    });

    it('returns approved state', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          has_entry: true,
          admin_review: 'approved',
          waitlist_entry: {
            admin_review: 'approved',
            created_at: '2026-01-27T10:00:00Z',
            rejection_reasons: [],
          },
        },
        error: null,
      });

      const result = await getWaitlistStatus();

      expect(result.data?.state).toBe('approved');
    });

    it('returns rejected state with rejection reasons', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          has_entry: true,
          admin_review: 'rejected',
          waitlist_entry: {
            admin_review: 'rejected',
            created_at: '2026-01-27T10:00:00Z',
            rejection_reasons: ['Outside service area'],
            next_application_at: null,
          },
        },
        error: null,
      });

      const result = await getWaitlistStatus();

      expect(result.data?.state).toBe('rejected');
      expect(result.data?.rejectionReasons).toContain('Outside service area');
    });

    it('returns pending_long for in_progress admin_review', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          has_entry: true,
          admin_review: 'in_progress',
          waitlist_entry: {
            admin_review: 'in_progress',
            created_at: '2026-01-27T10:00:00Z',
            rejection_reasons: [],
          },
        },
        error: null,
      });

      const result = await getWaitlistStatus();

      expect(result.data?.state).toBe('pending_long');
      expect(result.data?.estimatedReviewTime).toContain('24-48');
    });

    it('returns pending when no entry exists', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          has_entry: false,
        },
        error: null,
      });

      const result = await getWaitlistStatus();

      expect(result.data?.state).toBe('pending');
      expect(result.data?.position).toBeNull();
    });

    it('maps auth error from edge function', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: null,
        error: 'Not authenticated',
      });

      const result = await getWaitlistStatus();

      expect(result.error?.code).toBe('NOT_AUTHENTICATED');
    });

    it('returns error when success is false', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: { success: false },
        error: null,
      });

      const result = await getWaitlistStatus();

      expect(result.error?.code).toBe('UNKNOWN_ERROR');
    });

    it('calculates countdown from next_application_at', async () => {
      // Set a future date
      const futureDate = new Date(Date.now() + 86400_000).toISOString();
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          has_entry: true,
          admin_review: 'rejected',
          waitlist_entry: {
            admin_review: 'rejected',
            created_at: '2026-01-27T10:00:00Z',
            rejection_reasons: [],
            next_application_at: futureDate,
          },
        },
        error: null,
      });

      const result = await getWaitlistStatus();

      expect(result.data?.nextApplicationCountdown).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // applyReferralCode
  // =========================================================================
  describe('applyReferralCode', () => {
    it('validates code format - too short', async () => {
      const result = await applyReferralCode('AB');

      expect(result.error?.code).toBe('INVALID_REFERRAL');
      expect(result.error?.message).toContain('4-10');
      expect(mockCallEdgeFunction).not.toHaveBeenCalled();
    });

    it('validates code format - too long', async () => {
      const result = await applyReferralCode('A'.repeat(11));

      expect(result.error?.code).toBe('INVALID_REFERRAL');
    });

    it('validates code format - non-alphanumeric', async () => {
      const result = await applyReferralCode('CODE!@#');

      expect(result.error?.code).toBe('INVALID_REFERRAL');
      expect(result.error?.message).toContain('alphanumeric');
    });

    it('trims and uppercases code before sending', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          data: {
            code: 'ABCD1234',
            reward_type: 'cashback',
            rewards: { cashback_paise: 5000, cashback_rupees: '50', priority_boost: 10 },
            message: 'Applied!',
          },
        },
        error: null,
      });

      await applyReferralCode('  abcd1234  ');

      const [, body] = mockCallEdgeFunction.mock.calls[0];
      expect(body.code).toBe('ABCD1234');
    });

    it('returns mapped referral data on success', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          data: {
            code: 'TEST1234',
            reward_type: 'cashback',
            rewards: { cashback_paise: 5000, cashback_rupees: '50', priority_boost: 10 },
            message: 'Code applied!',
          },
        },
        error: null,
      });

      const result = await applyReferralCode('TEST1234');

      expect(result.data).toEqual({
        valid: true,
        message: 'Code applied!',
        code: 'TEST1234',
        rewardType: 'cashback',
        rewards: {
          cashbackPaise: 5000,
          cashbackRupees: '50',
          priorityBoost: 10,
        },
        priorityAccess: true,
      });
    });

    it('maps ALREADY_APPLIED error from backend code', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: false,
          code: 'ALREADY_APPLIED',
          message: 'You already applied a referral code',
        },
        error: null,
      });

      const result = await applyReferralCode('TEST1234');

      expect(result.error?.code).toBe('ALREADY_APPLIED');
    });

    it('maps edge function network error', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: null,
        error: 'fetch failed',
      });

      const result = await applyReferralCode('TEST1234');

      expect(result.error?.code).toBe('NETWORK_ERROR');
    });

    it('returns error when data is null in success response', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: { success: true, data: null },
        error: null,
      });

      const result = await applyReferralCode('TEST1234');

      expect(result.error?.code).toBe('UNKNOWN_ERROR');
    });
  });

  // =========================================================================
  // validateReferralCode
  // =========================================================================
  describe('validateReferralCode', () => {
    it('validates code format', async () => {
      const result = await validateReferralCode('AB');

      expect(result.error?.code).toBe('INVALID_REFERRAL');
      expect(mockCallEdgeFunction).not.toHaveBeenCalled();
    });

    it('returns mapped validation data for valid code', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          data: {
            is_valid: true,
            code: 'ABCD1234',
            referred_by: 'John',
            reward_type: 'cashback',
            reward_details: {
              cashback_paise: 5000,
              cashback_rupees: '50',
              priority_boost: 5,
            },
            message: 'Valid code!',
          },
        },
        error: null,
      });

      const result = await validateReferralCode('ABCD1234');

      expect(result.data?.valid).toBe(true);
      expect(result.data?.referredBy).toBe('John');
      expect(result.data?.rewardDetails?.cashbackPaise).toBe(5000);
    });

    it('returns invalid message for invalid code', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          data: {
            is_valid: false,
            error_message: 'Code does not exist',
          },
        },
        error: null,
      });

      const result = await validateReferralCode('BADCODE1');

      expect(result.data?.valid).toBe(false);
      expect(result.data?.message).toBe('Code does not exist');
    });
  });

  // =========================================================================
  // joinWaitlist
  // =========================================================================
  describe('joinWaitlist', () => {
    it('returns mapped join result', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          data: { entry_id: 'wl-001', position: 42, is_new: true },
        },
        error: null,
      });

      const result = await joinWaitlist();

      expect(result.data).toEqual({
        entryId: 'wl-001',
        position: 42,
        isNew: true,
      });
    });

    it('returns error on edge function failure', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: null,
        error: 'Not authenticated',
      });

      const result = await joinWaitlist();

      expect(result.error?.code).toBe('NOT_AUTHENTICATED');
    });

    it('returns error when success=false with message', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: { success: false, message: 'Rate limited' },
        error: null,
      });

      const result = await joinWaitlist();

      expect(result.error?.message).toBe('Rate limited');
    });
  });

  // =========================================================================
  // getMyReferralCode
  // =========================================================================
  describe('getMyReferralCode', () => {
    it('returns mapped referral code data', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          data: {
            code: 'MYCODE99',
            usage_count: 3,
            max_uses: 10,
            reward_amount_paise: 5000,
          },
        },
        error: null,
      });

      const result = await getMyReferralCode();

      expect(result.data).toEqual({
        code: 'MYCODE99',
        usageCount: 3,
        maxUses: 10,
        rewardAmountPaise: 5000,
      });
    });

    it('maps error on failure', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: null,
        error: 'Unauthorized access',
      });

      const result = await getMyReferralCode();

      expect(result.error?.code).toBe('NOT_AUTHENTICATED');
    });
  });
});
