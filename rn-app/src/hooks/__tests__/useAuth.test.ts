/**
 * useAuth Hook — Integration Tests (ST-099, ST-100)
 *
 * Verifies the auth hook wiring:
 *   Service functions (sendOtp, verifyOtp, resendOtp, signOut)
 *   -> React Query mutations
 *   -> Zustand auth store updates
 *
 * These tests mock only the Supabase client layer and verify that
 * everything from the service functions through the hooks to the
 * store updates works correctly end-to-end.
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import React from 'react';

// ---------------------------------------------------------------------------
// Supabase client mock (lowest layer — everything above is real code)
// ---------------------------------------------------------------------------

const mockSignInWithOtp = jest.fn();
const mockVerifyOtp = jest.fn();
const mockUpdateUser = jest.fn();
const mockSignOut = jest.fn();
const mockGetSession = jest.fn();

jest.mock('../../services/supabase/client', () => ({
  __esModule: true,
  supabase: {
    auth: {
      signInWithOtp: (...args: unknown[]) => mockSignInWithOtp(...args),
      verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
  callEdgeFunction: jest.fn(),
  getFunctionsUrl: jest.fn(),
}));

// Mock the identity verification hook (fire-and-forget, not under test)
jest.mock('../useIdentityVerification', () => ({
  useIdentityFetch: () => ({
    mutate: jest.fn(),
    isPending: false,
  }),
  useRecordConsent: () => ({
    mutateAsync: jest.fn().mockResolvedValue(undefined),
    isLoading: false,
  }),
}));

// Mock utils (used by signOut in the service)
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

// ---------------------------------------------------------------------------
// React Query wrapper (hooks need QueryClientProvider)
// ---------------------------------------------------------------------------

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/auth';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

// Import hooks under test (after mocks are established)
import { useSendOtp, useVerifyOtp, useResendOtp, useAuth } from '../useAuth';

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('useAuth hooks — integration wiring', () => {
  const now = Date.now();
  const recentCreatedAt = new Date(now - 60_000).toISOString();
  const oldCreatedAt = new Date(now - 3_600_000).toISOString();

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset auth store to initial state before each test
    useAuthStore.getState().reset();

    // Default mock: getSession returns no session (not authenticated)
    mockGetSession.mockResolvedValue({
      data: { session: null },
    });
  });

  // =========================================================================
  // useSendOtp — calls supabase.auth.signInWithOtp, updates store
  // =========================================================================
  describe('useSendOtp', () => {
    it('calls supabase.auth.signInWithOtp and updates store to otp_sent on success', async () => {
      mockSignInWithOtp.mockResolvedValue({ error: null });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useSendOtp(), { wrapper });

      await act(async () => {
        result.current.mutate({ phone_number: '+919876543210', channel: 'whatsapp' });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Verify Supabase was called with correct arguments
      expect(mockSignInWithOtp).toHaveBeenCalledWith({
        phone: '+919876543210',
        options: { channel: 'whatsapp' },
      });

      // Verify store was updated
      const storeState = useAuthStore.getState();
      expect(storeState.phoneNumber).toBe('+919876543210');
      expect(storeState.status).toBe('otp_sent');
      expect(storeState.otpSent).toBe(true);
      expect(storeState.error).toBeNull();
    });

    it('propagates INVALID_PHONE error from supabase to store', async () => {
      mockSignInWithOtp.mockResolvedValue({
        error: { message: 'Invalid phone number format' },
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useSendOtp(), { wrapper });

      await act(async () => {
        result.current.mutate({ phone_number: 'bad-number' });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      const storeState = useAuthStore.getState();
      expect(storeState.status).toBe('error');
      expect(storeState.error).toEqual({
        code: 'INVALID_PHONE',
        message: 'Please enter a valid phone number',
      });
    });

    it('propagates RATE_LIMITED error from supabase to store', async () => {
      mockSignInWithOtp.mockResolvedValue({
        error: { message: 'Too many requests, please slow down' },
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useSendOtp(), { wrapper });

      await act(async () => {
        result.current.mutate({ phone_number: '+919876543210' });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      const storeState = useAuthStore.getState();
      expect(storeState.status).toBe('error');
      expect(storeState.error?.code).toBe('RATE_LIMITED');
    });

    it('propagates NETWORK_ERROR when supabase throws', async () => {
      mockSignInWithOtp.mockRejectedValue(new Error('Failed to fetch'));

      const wrapper = createWrapper();
      const { result } = renderHook(() => useSendOtp(), { wrapper });

      await act(async () => {
        result.current.mutate({ phone_number: '+919876543210' });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      const storeState = useAuthStore.getState();
      expect(storeState.status).toBe('error');
      expect(storeState.error?.code).toBe('NETWORK_ERROR');
    });

    it('uses whatsapp channel by default', async () => {
      mockSignInWithOtp.mockResolvedValue({ error: null });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useSendOtp(), { wrapper });

      await act(async () => {
        result.current.mutate({ phone_number: '+919876543210' });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockSignInWithOtp).toHaveBeenCalledWith({
        phone: '+919876543210',
        options: { channel: 'whatsapp' },
      });
    });
  });

  // =========================================================================
  // useVerifyOtp — calls supabase.auth.verifyOtp, updates store to authenticated
  // =========================================================================
  describe('useVerifyOtp', () => {
    it('calls supabase.auth.verifyOtp and transitions store to authenticated', async () => {
      mockVerifyOtp.mockResolvedValue({
        data: {
          user: { id: 'user-abc', created_at: recentCreatedAt },
        },
        error: null,
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useVerifyOtp(), { wrapper });

      await act(async () => {
        result.current.mutate({ phone_number: '+919876543210', otp: '123456' });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Verify Supabase was called correctly
      expect(mockVerifyOtp).toHaveBeenCalledWith({
        phone: '+919876543210',
        token: '123456',
        type: 'sms',
      });

      // Verify store transitioned to authenticated
      const storeState = useAuthStore.getState();
      expect(storeState.status).toBe('authenticated');
      expect(storeState.userId).toBe('user-abc');
      expect(storeState.isNewUser).toBe(true);
      expect(storeState.error).toBeNull();
    });

    it('detects existing users (created > 10 minutes ago)', async () => {
      mockVerifyOtp.mockResolvedValue({
        data: {
          user: { id: 'user-existing', created_at: oldCreatedAt },
        },
        error: null,
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useVerifyOtp(), { wrapper });

      await act(async () => {
        result.current.mutate({ phone_number: '+919876543210', otp: '654321' });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const storeState = useAuthStore.getState();
      expect(storeState.isNewUser).toBe(false);
    });

    it('updates user name in Supabase when provided', async () => {
      mockVerifyOtp.mockResolvedValue({
        data: {
          user: { id: 'user-name', created_at: recentCreatedAt },
        },
        error: null,
      });
      mockUpdateUser.mockResolvedValue({ error: null });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useVerifyOtp(), { wrapper });

      await act(async () => {
        result.current.mutate({
          phone_number: '+919876543210',
          otp: '123456',
          name: 'John Doe',
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockUpdateUser).toHaveBeenCalledWith({
        data: { name: 'John Doe' },
      });
    });

    it('sets store to verifying state during mutation', async () => {
      // Use a deferred promise to keep the mutation pending
      let resolveVerify: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolveVerify = resolve;
      });
      mockVerifyOtp.mockReturnValue(pendingPromise);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useVerifyOtp(), { wrapper });

      act(() => {
        result.current.mutate({ phone_number: '+919876543210', otp: '123456' });
      });

      // Store should be in verifying state while mutation is pending
      await waitFor(() => {
        expect(useAuthStore.getState().status).toBe('verifying');
      });

      // Resolve the mutation
      await act(async () => {
        resolveVerify!({
          data: { user: { id: 'u1', created_at: recentCreatedAt } },
          error: null,
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(useAuthStore.getState().status).toBe('authenticated');
    });

    it('propagates INVALID_OTP error from supabase to store', async () => {
      mockVerifyOtp.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid OTP token' },
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useVerifyOtp(), { wrapper });

      await act(async () => {
        result.current.mutate({ phone_number: '+919876543210', otp: '000000' });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      const storeState = useAuthStore.getState();
      expect(storeState.status).toBe('error');
      expect(storeState.error?.code).toBe('INVALID_OTP');
    });

    it('propagates OTP_EXPIRED error from supabase to store', async () => {
      mockVerifyOtp.mockResolvedValue({
        data: { user: null },
        error: { message: 'Code expired, request a new one' },
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useVerifyOtp(), { wrapper });

      await act(async () => {
        result.current.mutate({ phone_number: '+919876543210', otp: '111111' });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      const storeState = useAuthStore.getState();
      expect(storeState.error?.code).toBe('OTP_EXPIRED');
    });

    it('propagates NETWORK_ERROR when supabase throws', async () => {
      mockVerifyOtp.mockRejectedValue(new Error('Network failure'));

      const wrapper = createWrapper();
      const { result } = renderHook(() => useVerifyOtp(), { wrapper });

      await act(async () => {
        result.current.mutate({ phone_number: '+919876543210', otp: '123456' });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      const storeState = useAuthStore.getState();
      expect(storeState.status).toBe('error');
      expect(storeState.error?.code).toBe('NETWORK_ERROR');
    });
  });

  // =========================================================================
  // useResendOtp — delegates to sendOtp service, resets store state
  // =========================================================================
  describe('useResendOtp', () => {
    it('calls supabase.auth.signInWithOtp with stored phone number', async () => {
      mockSignInWithOtp.mockResolvedValue({ error: null });

      // Pre-set the phone number in store (simulating user already entered it)
      useAuthStore.getState().setPhoneNumber('+919876543210');

      const wrapper = createWrapper();
      const { result } = renderHook(() => useResendOtp(), { wrapper });

      await act(async () => {
        result.current.mutate('whatsapp');
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockSignInWithOtp).toHaveBeenCalledWith({
        phone: '+919876543210',
        options: { channel: 'whatsapp' },
      });

      expect(useAuthStore.getState().status).toBe('otp_sent');
    });

    it('throws NO_PHONE error when phone number is not set', async () => {
      // Store is reset, no phone number
      const wrapper = createWrapper();
      const { result } = renderHook(() => useResendOtp(), { wrapper });

      await act(async () => {
        result.current.mutate('whatsapp');
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      const storeState = useAuthStore.getState();
      expect(storeState.status).toBe('error');
      expect(storeState.error?.code).toBe('NO_PHONE');
    });
  });

  // =========================================================================
  // useAuth combined hook — wires sendCode/verifyCode/signOut
  // =========================================================================
  describe('useAuth combined hook', () => {
    it('sendCode calls supabase.auth.signInWithOtp with formatted phone', async () => {
      mockSignInWithOtp.mockResolvedValue({ error: null });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });

      act(() => {
        result.current.sendCode('+919876543210', 'whatsapp');
      });

      await waitFor(() => expect(mockSignInWithOtp).toHaveBeenCalled());

      expect(mockSignInWithOtp).toHaveBeenCalledWith({
        phone: '+919876543210',
        options: { channel: 'whatsapp' },
      });
    });

    it('verifyCode calls supabase.auth.verifyOtp and updates status to authenticated', async () => {
      mockSignInWithOtp.mockResolvedValue({ error: null });
      mockVerifyOtp.mockResolvedValue({
        data: {
          user: { id: 'user-combined', created_at: recentCreatedAt },
        },
        error: null,
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });

      // First send OTP to set phone number in store
      await act(async () => {
        result.current.sendCode('+919876543210');
      });

      await waitFor(() => expect(result.current.status).toBe('otp_sent'));

      // Now verify
      await act(async () => {
        result.current.verifyCode('123456');
      });

      await waitFor(() => expect(result.current.status).toBe('authenticated'));

      expect(result.current.userId).toBe('user-combined');
      expect(result.current.isNewUser).toBe(true);
    });

    it('signOut calls supabase.auth.signOut and resets store', async () => {
      mockSignOut.mockResolvedValue({ error: null });

      // Pre-set authenticated state
      useAuthStore.getState().setAuthenticated('user-xyz', false);
      expect(useAuthStore.getState().status).toBe('authenticated');

      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.signOut();
      });

      expect(mockSignOut).toHaveBeenCalled();
      expect(useAuthStore.getState().status).toBe('idle');
      expect(useAuthStore.getState().userId).toBeNull();
    });

    it('exposes loading states from mutations', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Initially nothing is loading
      expect(result.current.isSendingOtp).toBe(false);
      expect(result.current.isVerifyingOtp).toBe(false);
      expect(result.current.isResendingOtp).toBe(false);
    });

    it('clearError restores store status from error to previous state', () => {
      // Set up store in error state after OTP was sent
      const store = useAuthStore.getState();
      store.setPhoneNumber('+919876543210');
      store.setOtpSent();
      store.setError('INVALID_OTP', 'Wrong code');

      expect(useAuthStore.getState().status).toBe('error');

      // Clear the error
      store.clearError();

      // Should restore to otp_sent (since otpSent flag was true)
      expect(useAuthStore.getState().status).toBe('otp_sent');
      expect(useAuthStore.getState().error).toBeNull();
    });

    it('error state includes both code and message', async () => {
      mockSignInWithOtp.mockResolvedValue({
        error: { message: 'Too many requests, rate limit exceeded' },
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        result.current.sendCode('+919876543210');
      });

      await waitFor(() => expect(result.current.error).not.toBeNull());

      expect(result.current.error).toEqual({
        code: 'RATE_LIMITED',
        message: 'Too many attempts. Please wait before trying again.',
      });
    });
  });

  // =========================================================================
  // Store state machine transitions
  // =========================================================================
  describe('auth store state machine', () => {
    it('follows correct state transitions: idle -> phone_input -> otp_sent -> verifying -> authenticated', () => {
      const store = useAuthStore.getState();
      expect(store.status).toBe('idle');

      store.setPhoneNumber('+919876543210');
      expect(useAuthStore.getState().status).toBe('phone_input');

      store.setOtpSent();
      expect(useAuthStore.getState().status).toBe('otp_sent');
      expect(useAuthStore.getState().otpSent).toBe(true);

      store.setVerifying();
      expect(useAuthStore.getState().status).toBe('verifying');

      store.setAuthenticated('user-123', true);
      expect(useAuthStore.getState().status).toBe('authenticated');
      expect(useAuthStore.getState().userId).toBe('user-123');
      expect(useAuthStore.getState().isNewUser).toBe(true);
    });

    it('reset returns store to initial state', () => {
      const store = useAuthStore.getState();
      store.setPhoneNumber('+919876543210');
      store.setUserName('Test User');
      store.setAuthenticated('user-123', true);

      store.reset();

      const resetState = useAuthStore.getState();
      expect(resetState.status).toBe('idle');
      expect(resetState.phoneNumber).toBe('');
      expect(resetState.userName).toBe('');
      expect(resetState.userId).toBeNull();
      expect(resetState.isNewUser).toBe(false);
      expect(resetState.error).toBeNull();
    });

    it('setError transitions to error state and clearError restores previous', () => {
      const store = useAuthStore.getState();
      store.setPhoneNumber('+919876543210');

      store.setError('NETWORK_ERROR', 'No internet');
      expect(useAuthStore.getState().status).toBe('error');
      expect(useAuthStore.getState().error?.code).toBe('NETWORK_ERROR');

      store.clearError();
      expect(useAuthStore.getState().status).toBe('phone_input');
      expect(useAuthStore.getState().error).toBeNull();
    });
  });
});
