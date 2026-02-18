/**
 * Auth API Service — Integration Tests
 *
 * Tests sendOtp, verifyOtp, resendOtp, and signOut functions
 * with mocked Supabase auth methods.
 */

// ---------------------------------------------------------------------------
// Mocks (must be declared before imports)
// ---------------------------------------------------------------------------

const mockSignInWithOtp = jest.fn();
const mockVerifyOtp = jest.fn();
const mockUpdateUser = jest.fn();
const mockSignOut = jest.fn();

// auth.ts imports from '../supabase' which resolves to ../supabase/index.ts -> ./client.ts
// We must mock the supabase client module at its resolved path
jest.mock('../supabase/client', () => ({
  __esModule: true,
  supabase: {
    auth: {
      signInWithOtp: (...args: unknown[]) => mockSignInWithOtp(...args),
      verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  },
  callEdgeFunction: jest.fn(),
  getFunctionsUrl: jest.fn(),
}));

jest.mock('@/src/utils', () => ({
  tryCatch: jest.fn(async (fn: () => Promise<unknown>, errorMessage: string) => {
    try {
      const data = await fn();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : errorMessage,
          originalError: error,
        },
      };
    }
  }),
  logError: jest.fn(),
  getErrorMessage: jest.fn((err: unknown) =>
    err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error'
  ),
}));

import { sendOtp, verifyOtp, resendOtp, signOut } from '../api/auth';

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('Auth API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // sendOtp
  // =========================================================================
  describe('sendOtp', () => {
    it('sends OTP via whatsapp by default and returns success', async () => {
      mockSignInWithOtp.mockResolvedValue({ error: null });

      const result = await sendOtp({ phone_number: '+919876543210' });

      expect(result).toEqual({ data: { success: true }, error: null });
      expect(mockSignInWithOtp).toHaveBeenCalledWith({
        phone: '+919876543210',
        options: { channel: 'whatsapp' },
      });
    });

    it('respects explicit channel parameter', async () => {
      mockSignInWithOtp.mockResolvedValue({ error: null });

      await sendOtp({ phone_number: '+919876543210', channel: 'sms' });

      expect(mockSignInWithOtp).toHaveBeenCalledWith({
        phone: '+919876543210',
        options: { channel: 'sms' },
      });
    });

    it('maps "invalid phone" error to INVALID_PHONE code', async () => {
      mockSignInWithOtp.mockResolvedValue({
        error: { message: 'Invalid phone number format' },
      });

      const result = await sendOtp({ phone_number: 'bad' });

      expect(result.data).toBeNull();
      expect(result.error).toEqual({
        code: 'INVALID_PHONE',
        message: 'Please enter a valid phone number',
      });
    });

    it('maps rate limit error to RATE_LIMITED code', async () => {
      mockSignInWithOtp.mockResolvedValue({
        error: { message: 'Too many requests, please slow down' },
      });

      const result = await sendOtp({ phone_number: '+919876543210' });

      expect(result.error?.code).toBe('RATE_LIMITED');
    });

    it('maps timeout/abort error to TIMEOUT code', async () => {
      mockSignInWithOtp.mockResolvedValue({
        error: { message: 'Request timed out' },
      });

      const result = await sendOtp({ phone_number: '+919876543210' });

      expect(result.error?.code).toBe('TIMEOUT');
    });

    it('maps unknown error messages to UNKNOWN_ERROR', async () => {
      mockSignInWithOtp.mockResolvedValue({
        error: { message: 'Some bizarre backend error' },
      });

      const result = await sendOtp({ phone_number: '+919876543210' });

      expect(result.error).toEqual({
        code: 'UNKNOWN_ERROR',
        message: 'Some bizarre backend error',
      });
    });

    it('catches thrown exceptions as NETWORK_ERROR', async () => {
      mockSignInWithOtp.mockRejectedValue(new Error('Failed to fetch'));

      const result = await sendOtp({ phone_number: '+919876543210' });

      expect(result.error).toEqual({
        code: 'NETWORK_ERROR',
        message: 'Failed to fetch',
      });
    });

    it('handles non-Error thrown values', async () => {
      mockSignInWithOtp.mockRejectedValue('connection lost');

      const result = await sendOtp({ phone_number: '+919876543210' });

      expect(result.error).toEqual({
        code: 'NETWORK_ERROR',
        message: 'Network error',
      });
    });
  });

  // =========================================================================
  // verifyOtp
  // =========================================================================
  describe('verifyOtp', () => {
    const now = Date.now();
    const recentCreatedAt = new Date(now - 60_000).toISOString(); // 1 min ago
    const oldCreatedAt = new Date(now - 3_600_000).toISOString(); // 1 hour ago

    it('returns user_id and is_new_user=true for recently created users', async () => {
      mockVerifyOtp.mockResolvedValue({
        data: {
          user: { id: 'user-123', created_at: recentCreatedAt },
        },
        error: null,
      });

      const result = await verifyOtp({
        phone_number: '+919876543210',
        otp: '123456',
      });

      expect(result.data).toEqual({
        user_id: 'user-123',
        is_new_user: true,
      });
      expect(result.error).toBeNull();
    });

    it('returns is_new_user=false for existing users', async () => {
      mockVerifyOtp.mockResolvedValue({
        data: {
          user: { id: 'user-456', created_at: oldCreatedAt },
        },
        error: null,
      });

      const result = await verifyOtp({
        phone_number: '+919876543210',
        otp: '654321',
      });

      expect(result.data?.is_new_user).toBe(false);
    });

    it('updates user name if provided', async () => {
      mockVerifyOtp.mockResolvedValue({
        data: {
          user: { id: 'user-789', created_at: recentCreatedAt },
        },
        error: null,
      });
      mockUpdateUser.mockResolvedValue({ error: null });

      await verifyOtp({
        phone_number: '+919876543210',
        otp: '123456',
        name: 'John Doe',
      });

      expect(mockUpdateUser).toHaveBeenCalledWith({
        data: { name: 'John Doe' },
      });
    });

    it('does not call updateUser when name is not provided', async () => {
      mockVerifyOtp.mockResolvedValue({
        data: {
          user: { id: 'user-789', created_at: recentCreatedAt },
        },
        error: null,
      });

      await verifyOtp({
        phone_number: '+919876543210',
        otp: '123456',
      });

      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it('maps "Token has expired" error', async () => {
      mockVerifyOtp.mockResolvedValue({
        data: { user: null },
        error: { message: 'Token has expired' },
      });

      const result = await verifyOtp({
        phone_number: '+919876543210',
        otp: '000000',
      });

      // "Token" triggers the INVALID_OTP branch in mapAuthError because
      // the check for (invalid && otp) || token runs before the expired check
      expect(result.error?.code).toBe('INVALID_OTP');
    });

    it('maps "Code expired" to OTP_EXPIRED', async () => {
      mockVerifyOtp.mockResolvedValue({
        data: { user: null },
        error: { message: 'Code expired, request a new one' },
      });

      const result = await verifyOtp({
        phone_number: '+919876543210',
        otp: '000000',
      });

      expect(result.error?.code).toBe('OTP_EXPIRED');
    });

    it('maps invalid OTP errors to INVALID_OTP', async () => {
      mockVerifyOtp.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid OTP token' },
      });

      const result = await verifyOtp({
        phone_number: '+919876543210',
        otp: '111111',
      });

      expect(result.error?.code).toBe('INVALID_OTP');
    });

    it('returns UNKNOWN_ERROR when verification succeeds but no user is returned', async () => {
      mockVerifyOtp.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await verifyOtp({
        phone_number: '+919876543210',
        otp: '123456',
      });

      expect(result.error).toEqual({
        code: 'UNKNOWN_ERROR',
        message: 'Verification succeeded but no user returned',
      });
    });

    it('catches thrown exceptions as NETWORK_ERROR', async () => {
      mockVerifyOtp.mockRejectedValue(new Error('Network failure'));

      const result = await verifyOtp({
        phone_number: '+919876543210',
        otp: '123456',
      });

      expect(result.error).toEqual({
        code: 'NETWORK_ERROR',
        message: 'Network failure',
      });
    });

    it('calls supabase.auth.verifyOtp with correct params', async () => {
      mockVerifyOtp.mockResolvedValue({
        data: { user: { id: 'u1', created_at: recentCreatedAt } },
        error: null,
      });

      await verifyOtp({ phone_number: '+91999', otp: '1234' });

      expect(mockVerifyOtp).toHaveBeenCalledWith({
        phone: '+91999',
        token: '1234',
        type: 'sms',
      });
    });
  });

  // =========================================================================
  // resendOtp
  // =========================================================================
  describe('resendOtp', () => {
    it('delegates to sendOtp with default whatsapp channel', async () => {
      mockSignInWithOtp.mockResolvedValue({ error: null });

      const result = await resendOtp('+919876543210');

      expect(result).toEqual({ data: { success: true }, error: null });
      expect(mockSignInWithOtp).toHaveBeenCalledWith({
        phone: '+919876543210',
        options: { channel: 'whatsapp' },
      });
    });

    it('supports explicit sms channel', async () => {
      mockSignInWithOtp.mockResolvedValue({ error: null });

      await resendOtp('+919876543210', 'sms');

      expect(mockSignInWithOtp).toHaveBeenCalledWith({
        phone: '+919876543210',
        options: { channel: 'sms' },
      });
    });
  });

  // =========================================================================
  // signOut
  // =========================================================================
  describe('signOut', () => {
    it('returns success when sign out succeeds', async () => {
      mockSignOut.mockResolvedValue({ error: null });

      const result = await signOut();

      expect(result).toEqual({ success: true, error: null });
    });

    it('returns error when sign out fails', async () => {
      mockSignOut.mockResolvedValue({ error: new Error('Session expired') });

      const result = await signOut();

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });
});
