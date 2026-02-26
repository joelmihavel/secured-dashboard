/**
 * Journey Router (app/index.tsx) -- Unit Tests
 *
 * Tests the root entry point that routes users based on auth + waitlist state.
 * This is the SINGLE most important file in the app -- all userStatus branches
 * must be covered.
 *
 * userStatus -> target:
 *   not authenticated     -> /(auth)/beta-splash
 *   signed_up             -> /(agreement)/upload
 *   agreement_confirmed   -> /(waitlist)
 *   waitlisted            -> /(waitlist)
 *   not_eligible          -> /(waitlist)
 *   approved              -> /(setup)
 *   active                -> /(main)
 *   unknown/default       -> /(agreement)/upload
 *   error (no data)       -> /(agreement)/upload (fallback after retry)
 */

import { act, waitFor } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mocks (hoisted)
// ---------------------------------------------------------------------------

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => ({}),
}));

const mockUseAuthContext = jest.fn();
jest.mock('@/src/providers', () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

const mockGetWaitlistStatus = jest.fn();
jest.mock('@/src/services/api/waitlist', () => ({
  getWaitlistStatus: (...args: unknown[]) => mockGetWaitlistStatus(...args),
}));

jest.mock('@/src/components', () => ({
  SkeletonLoader: () => 'SkeletonLoader',
}));

// Mock dev screen picker exports
jest.mock('../(dev)/screen-picker', () => ({
  DISABLE_SCREEN_PICKER: true, // Disable screen picker for tests
  DEV_DIRECT_SCREEN: null,
}));

// ---------------------------------------------------------------------------
// Import component under test
// ---------------------------------------------------------------------------

import Index from '../index';
import React from 'react';
import { render } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderIndex() {
  return render(React.createElement(Index));
}

function mockAuthState(isAuthenticated: boolean, isLoading = false) {
  mockUseAuthContext.mockReturnValue({
    isAuthenticated,
    isLoading,
  });
}

function mockWaitlistResponse(userStatus: string) {
  mockGetWaitlistStatus.mockResolvedValue({
    data: { userStatus },
    error: null,
  });
}

function mockWaitlistError() {
  mockGetWaitlistStatus.mockResolvedValue({
    data: null,
    error: 'Service unavailable',
  });
}

/**
 * Flush all pending microtasks (resolved promises).
 * This is needed because the retry logic uses setTimeout after a promise resolves.
 */
function flushMicrotasks() {
  return act(async () => {});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Journey Router (app/index.tsx)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReplace.mockClear();
  });

  // =========================================================================
  // Auth loading state
  // =========================================================================

  describe('auth loading state', () => {
    it('renders SkeletonLoader while auth is loading', () => {
      mockAuthState(false, true);
      const { toJSON } = renderIndex();
      expect(toJSON()).toBeTruthy();
      // Should not navigate while loading
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('does not call getWaitlistStatus while auth is loading', () => {
      mockAuthState(false, true);
      renderIndex();
      expect(mockGetWaitlistStatus).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Unauthenticated user
  // =========================================================================

  describe('unauthenticated user', () => {
    it('navigates to /(auth)/beta-splash', async () => {
      mockAuthState(false);
      renderIndex();

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/(auth)/beta-splash');
      });
    });

    it('does not call getWaitlistStatus', () => {
      mockAuthState(false);
      renderIndex();
      expect(mockGetWaitlistStatus).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Authenticated user -- all 6 userStatus values
  // =========================================================================

  describe('authenticated user -- userStatus routing', () => {
    it('signed_up -> /(agreement)/upload', async () => {
      mockAuthState(true);
      mockWaitlistResponse('signed_up');
      renderIndex();

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/(agreement)/upload');
      });
    });

    it('agreement_confirmed -> /(waitlist)', async () => {
      mockAuthState(true);
      mockWaitlistResponse('agreement_confirmed');
      renderIndex();

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/(waitlist)');
      });
    });

    it('waitlisted -> /(waitlist)', async () => {
      mockAuthState(true);
      mockWaitlistResponse('waitlisted');
      renderIndex();

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/(waitlist)');
      });
    });

    it('not_eligible -> /(waitlist)', async () => {
      mockAuthState(true);
      mockWaitlistResponse('not_eligible');
      renderIndex();

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/(waitlist)');
      });
    });

    it('approved -> /(setup)', async () => {
      mockAuthState(true);
      mockWaitlistResponse('approved');
      renderIndex();

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/(setup)');
      });
    });

    it('active -> /(main)', async () => {
      mockAuthState(true);
      mockWaitlistResponse('active');
      renderIndex();

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/(main)');
      });
    });

    it('unknown status -> /(agreement)/upload (default fallback)', async () => {
      mockAuthState(true);
      mockWaitlistResponse('some_unknown_status');
      renderIndex();

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/(agreement)/upload');
      });
    });
  });

  // =========================================================================
  // Error handling
  // =========================================================================

  describe('error handling', () => {
    it('falls back to /(agreement)/upload on API error after retry', async () => {
      jest.useFakeTimers();
      mockAuthState(true);
      mockWaitlistError();
      renderIndex();

      // First call resolves with error -> schedules setTimeout(retry, 1000)
      await flushMicrotasks();

      // Advance past the 1s retry delay
      await act(async () => {
        jest.advanceTimersByTime(1100);
      });

      // Retry call resolves with error again -> sets fallback target
      await flushMicrotasks();

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/(agreement)/upload');
      });

      // Should have attempted twice (initial + 1 retry)
      expect(mockGetWaitlistStatus).toHaveBeenCalledTimes(2);
      jest.useRealTimers();
    });

    it('falls back to /(agreement)/upload when data is null', async () => {
      jest.useFakeTimers();
      mockAuthState(true);
      mockGetWaitlistStatus.mockResolvedValue({ data: null, error: null });
      renderIndex();

      // First call resolves with null data -> schedules setTimeout(retry, 1000)
      await flushMicrotasks();

      // Advance past the 1s retry delay
      await act(async () => {
        jest.advanceTimersByTime(1100);
      });

      // Retry resolves with null again -> sets fallback
      await flushMicrotasks();

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/(agreement)/upload');
      });
      jest.useRealTimers();
    });

    it('falls back to /(agreement)/upload on exception after retry', async () => {
      jest.useFakeTimers();
      mockAuthState(true);
      mockGetWaitlistStatus.mockRejectedValue(new Error('Network error'));
      renderIndex();

      // First call rejects -> schedules setTimeout(retry, 1000)
      await flushMicrotasks();

      // Advance past the 1s retry delay
      await act(async () => {
        jest.advanceTimersByTime(1100);
      });

      // Retry rejects again -> sets fallback
      await flushMicrotasks();

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/(agreement)/upload');
      });
      jest.useRealTimers();
    });
  });

  // =========================================================================
  // One-shot navigation guard
  // =========================================================================

  describe('navigation guard', () => {
    it('navigates only once (hasNavigatedRef)', async () => {
      mockAuthState(true);
      mockWaitlistResponse('active');

      const { rerender } = renderIndex();

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledTimes(1);
      });

      // Re-render should not trigger another navigation
      rerender(React.createElement(Index));

      // Still only one call
      expect(mockReplace).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Calls getWaitlistStatus when authenticated
  // =========================================================================

  describe('waitlist API interaction', () => {
    it('calls getWaitlistStatus when authenticated', async () => {
      mockAuthState(true);
      mockWaitlistResponse('active');
      renderIndex();

      await waitFor(() => {
        expect(mockGetWaitlistStatus).toHaveBeenCalledTimes(1);
      });
    });
  });
});
