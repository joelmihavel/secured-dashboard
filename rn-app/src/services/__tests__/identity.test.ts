/**
 * Identity API Service -- Integration Tests
 *
 * Tests identity verification with Cashfree Mobile 360 consent flow.
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

import { fetchIdentityWithConsent } from '../api/identity';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Identity API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchIdentityWithConsent', () => {
    it('returns identity data on success', async () => {
      const identityResult = {
        success: true,
        data: {
          verification_id: 'ver-001',
          status: 'completed',
          name: 'John Doe',
          has_pan: true,
          has_aadhaar: true,
          credit_score: 750,
          risk_safe: true,
          message: 'Verification successful',
        },
      };

      mockCallEdgeFunction.mockResolvedValue({
        data: identityResult,
        error: null,
      });

      const result = await fetchIdentityWithConsent({
        consent_timestamp: '2026-01-15T10:00:00Z',
        name: 'John Doe',
      });

      expect(result.data).toEqual(identityResult);
      expect(result.error).toBeNull();

      expect(mockCallEdgeFunction).toHaveBeenCalledWith(
        'verify-identity',
        {
          action: 'fetch_with_consent',
          consent_timestamp: '2026-01-15T10:00:00Z',
          name: 'John Doe',
        },
        true
      );
    });

    it('maps NOT_AUTHENTICATED error', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: null,
        error: 'Not authenticated',
      });

      const result = await fetchIdentityWithConsent({
        consent_timestamp: '2026-01-15T10:00:00Z',
      });

      expect(result.error?.code).toBe('NOT_AUTHENTICATED');
      expect(result.data).toBeNull();
    });

    it('maps VALIDATION_ERROR for validation messages', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: null,
        error: 'Validation error: consent_timestamp is required',
      });

      const result = await fetchIdentityWithConsent({
        consent_timestamp: '',
      });

      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('maps NETWORK_ERROR for network issues', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: null,
        error: 'Request timed out after 15s',
      });

      const result = await fetchIdentityWithConsent({
        consent_timestamp: '2026-01-15T10:00:00Z',
      });

      expect(result.error?.code).toBe('NETWORK_ERROR');
    });

    it('maps UNKNOWN_ERROR for unrecognized errors', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: null,
        error: 'Internal server error',
      });

      const result = await fetchIdentityWithConsent({
        consent_timestamp: '2026-01-15T10:00:00Z',
      });

      expect(result.error?.code).toBe('UNKNOWN_ERROR');
      expect(result.error?.message).toBe('Internal server error');
    });

    it('passes name as undefined when not provided', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: { success: true, data: {} },
        error: null,
      });

      await fetchIdentityWithConsent({
        consent_timestamp: '2026-01-15T10:00:00Z',
      });

      const [, body] = mockCallEdgeFunction.mock.calls[0];
      expect(body.name).toBeUndefined();
    });
  });
});
