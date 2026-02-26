/**
 * Setup API Service -- Integration Tests
 *
 * Tests bank verification, utility verification, landlord invite,
 * and setup progress derivation.
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
  verifyBank,
  getUtilityOperators,
  verifyUtility,
  sendLandlordInvite,
  resendLandlordInvite,
  deriveSetupProgress,
} from '../api/setup';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Setup API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // verifyBank
  // =========================================================================
  describe('verifyBank', () => {
    it('maps camelCase request to snake_case and returns mapped response', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          data: {
            bank_account_id: 'ba-001',
            verified: true,
            account_number_masked: '****1234',
            ifsc_code: 'ICIC0001234',
            verified_name: 'John Doe',
            name_match_score: 95,
            name_match_threshold: 70,
            verification_status: 'SUCCESS',
            bank_name: 'ICICI Bank',
            branch: 'Koramangala',
            message: 'Bank verified successfully',
          },
        },
        error: null,
      });

      const result = await verifyBank({
        tenancyId: 'ten-001',
        accountHolderName: 'John Doe',
        accountNumber: '1234567890',
        ifscCode: 'ICIC0001234',
      });

      expect(result.data).toEqual({
        success: true,
        bankAccountId: 'ba-001',
        verified: true,
        accountNumberMasked: '****1234',
        ifscCode: 'ICIC0001234',
        verifiedName: 'John Doe',
        nameMatchScore: 95,
        nameMatchThreshold: 70,
        verificationStatus: 'SUCCESS',
        bankName: 'ICICI Bank',
        branch: 'Koramangala',
        message: 'Bank verified successfully',
        // Additional fields from the mapping function
        agreementNameMatched: null,
        matchedLandlordName: null,
        agreementMatchScore: null,
      });

      // Verify snake_case body
      const [, body, , , timeout] = mockCallEdgeFunction.mock.calls[0];
      expect(body.tenancy_id).toBe('ten-001');
      expect(body.account_holder_name).toBe('John Doe');
      expect(body.account_number).toBe('1234567890');
      expect(body.ifsc_code).toBe('ICIC0001234');
      expect(body.party_type).toBe('landlord'); // default
      expect(timeout).toBe(30_000);
    });

    it('maps authentication error', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: null,
        error: 'Not authenticated',
      });

      const result = await verifyBank({
        tenancyId: 'ten-001',
        accountHolderName: 'A',
        accountNumber: '1',
        ifscCode: 'I',
      });

      expect(result.error?.code).toBe('NOT_AUTHENTICATED');
    });

    it('returns VERIFICATION_FAILED when success=false', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: { success: false },
        error: null,
      });

      const result = await verifyBank({
        tenancyId: 'ten-001',
        accountHolderName: 'A',
        accountNumber: '1',
        ifscCode: 'I',
      });

      expect(result.error?.code).toBe('VERIFICATION_FAILED');
    });

    it('maps bank name mismatch error', async () => {
      // The error contains both "bank" and "name" which matches BANK_NAME_MISMATCH
      // before NAME_MISMATCH in the error mapping function
      mockCallEdgeFunction.mockResolvedValue({
        data: null,
        error: 'Name mismatch: bank name does not match',
      });

      const result = await verifyBank({
        tenancyId: 'ten-001',
        accountHolderName: 'Wrong Name',
        accountNumber: '1',
        ifscCode: 'I',
      });

      expect(result.error?.code).toBe('BANK_NAME_MISMATCH');
    });

    it('maps network error', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: null,
        error: 'Request timed out',
      });

      const result = await verifyBank({
        tenancyId: 'ten-001',
        accountHolderName: 'A',
        accountNumber: '1',
        ifscCode: 'I',
      });

      expect(result.error?.code).toBe('NETWORK_ERROR');
    });
  });

  // =========================================================================
  // getUtilityOperators
  // =========================================================================
  describe('getUtilityOperators', () => {
    it('returns mapped operator list', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          data: {
            operators: [
              { operator_code: 'BESCOM', operator_name: 'BESCOM', state: 'Karnataka' },
              { operator_code: 'MESCOM', operator_name: 'MESCOM', state: 'Karnataka', params: ['consumer_number'] },
            ],
            count: 2,
          },
        },
        error: null,
      });

      const result = await getUtilityOperators();

      expect(result.data).toEqual([
        { operatorCode: 'BESCOM', operatorName: 'BESCOM', state: 'Karnataka', params: undefined },
        { operatorCode: 'MESCOM', operatorName: 'MESCOM', state: 'Karnataka', params: ['consumer_number'] },
      ]);

      // Verify no auth required
      const [, , requireAuth] = mockCallEdgeFunction.mock.calls[0];
      expect(requireAuth).toBe(false);
    });

    it('returns error when operators data is missing', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: { success: true, data: {} },
        error: null,
      });

      const result = await getUtilityOperators();

      expect(result.error?.code).toBe('UNKNOWN_ERROR');
    });
  });

  // =========================================================================
  // verifyUtility
  // =========================================================================
  describe('verifyUtility', () => {
    it('maps camelCase request and returns mapped response', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          data: {
            verification_id: 'uv-001',
            verified: true,
            name_verified: true,
            address_verified: true,
            consumer_name: 'John Doe',
            landlord_name: 'Jane Smith',
            name_match_score: 88,
            address_match_score: 92,
            match_threshold: 70,
            bill_amount: 1500,
            bill_due_date: '2026-02-15',
            message: 'Verified',
            matching_method: 'gemini_ai',
          },
        },
        error: null,
      });

      const result = await verifyUtility({
        tenancyId: 'ten-001',
        consumerNumber: 'CN123',
        operatorCode: 'BESCOM',
      });

      expect(result.data).toEqual({
        success: true,
        verificationId: 'uv-001',
        verified: true,
        nameVerified: true,
        addressVerified: true,
        consumerName: 'John Doe',
        landlordName: 'Jane Smith',
        nameMatchScore: 88,
        addressMatchScore: 92,
        matchThreshold: 70,
        billAmount: 1500,
        billDueDate: '2026-02-15',
        message: 'Verified',
        matchingMethod: 'gemini_ai',
      });

      const [, body] = mockCallEdgeFunction.mock.calls[0];
      expect(body.consumer_number).toBe('CN123');
      expect(body.operator_code).toBe('BESCOM');
    });

    it('maps address mismatch error', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: null,
        error: 'Address mismatch detected',
      });

      const result = await verifyUtility({
        tenancyId: 'ten-001',
        consumerNumber: 'CN123',
        operatorCode: 'BESCOM',
      });

      expect(result.error?.code).toBe('ADDRESS_MISMATCH');
    });
  });

  // =========================================================================
  // sendLandlordInvite / resendLandlordInvite
  // =========================================================================
  describe('sendLandlordInvite', () => {
    it('maps request and returns mapped invite response', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          data: {
            invite_id: 'inv-001',
            status: 'sent',
            sent_via: 'email',
            expires_at: '2026-02-15T00:00:00Z',
            message: 'Invitation sent',
            invite_link: 'https://flent.in/invite/abc',
            landlord_email_masked: 'j***@email.com',
          },
        },
        error: null,
      });

      const result = await sendLandlordInvite({
        tenancyId: 'ten-001',
        landlordName: 'Jane Smith',
        landlordEmail: 'jane@email.com',
      });

      expect(result.data).toEqual({
        success: true,
        alreadyApproved: undefined,
        inviteId: 'inv-001',
        status: 'sent',
        sentVia: 'email',
        expiresAt: '2026-02-15T00:00:00Z',
        message: 'Invitation sent',
        inviteLink: 'https://flent.in/invite/abc',
        landlordEmailMasked: 'j***@email.com',
      });
    });

    it('handles already approved response', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          data: {
            already_approved: true,
            message: 'Landlord already approved',
          },
        },
        error: null,
      });

      const result = await sendLandlordInvite({ tenancyId: 'ten-001' });

      expect(result.data?.alreadyApproved).toBe(true);
    });

    it('maps email failure error', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: null,
        error: 'Email send failed for the landlord',
      });

      const result = await sendLandlordInvite({
        tenancyId: 'ten-001',
        landlordEmail: 'bad@email',
      });

      expect(result.error?.code).toBe('EMAIL_FAILED');
    });
  });

  describe('resendLandlordInvite', () => {
    it('calls sendLandlordInvite with resend=true', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          data: { message: 'Resent', status: 'sent' },
        },
        error: null,
      });

      await resendLandlordInvite('ten-001');

      const [, body] = mockCallEdgeFunction.mock.calls[0];
      expect(body.tenancy_id).toBe('ten-001');
      expect(body.resend).toBe(true);
    });
  });

  // =========================================================================
  // deriveSetupProgress
  // =========================================================================
  describe('deriveSetupProgress', () => {
    it('returns all incomplete steps when nothing is verified', () => {
      const progress = deriveSetupProgress({
        bank_verified: false,
        utility_verified: false,
        landlord_approved: false,
      });

      expect(progress.completedCount).toBe(0);
      expect(progress.totalCount).toBe(3);
      expect(progress.currentStepIndex).toBe(0);
      expect(progress.steps).toHaveLength(3);
      expect(progress.steps[0].type).toBe('bank');
      expect(progress.steps[0].isCompleted).toBe(false);
    });

    it('advances currentStepIndex as steps complete', () => {
      const progress = deriveSetupProgress({
        bank_verified: true,
        utility_verified: false,
        landlord_approved: false,
      });

      expect(progress.completedCount).toBe(1);
      expect(progress.currentStepIndex).toBe(1); // utility step
      expect(progress.steps[0].isCompleted).toBe(true);
    });

    it('returns all completed with landlordStatus approved', () => {
      const progress = deriveSetupProgress({
        bank_verified: true,
        utility_verified: true,
        landlord_approved: true,
      });

      expect(progress.completedCount).toBe(3);
      expect(progress.landlordStatus.type).toBe('approved');
    });

    it('handles null verification status', () => {
      const progress = deriveSetupProgress(null);

      expect(progress.completedCount).toBe(0);
      expect(progress.steps.every(s => !s.isCompleted)).toBe(true);
    });

    it('step routes match expected paths', () => {
      const progress = deriveSetupProgress(null);

      expect(progress.steps[0].route).toBe('/(setup)/add-bank');
      expect(progress.steps[1].route).toBe('/(setup)/add-utility');
      expect(progress.steps[2].route).toBe('/(setup)/invite-landlord');
    });
  });
});
