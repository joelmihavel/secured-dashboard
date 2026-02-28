/**
 * Journey Router (app/index.tsx) -- Unit Tests
 *
 * Tests the root entry point that routes users based on auth + waitlist state.
 * This is the SINGLE most important file in the app -- all userStatus branches
 * must be covered.
 *
 * Routing strategy:
 *  PRIMARY:  getUser() → PostgREST query for user_status (SDK-managed auth)
 *  FALLBACK: getWaitlistStatus() edge function via callEdgeFunction
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
 *   error (both paths)    -> /(agreement)/upload (fallback)
 */

import { act, waitFor } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mocks (hoisted)
// ---------------------------------------------------------------------------

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useRootNavigationState: () => ({ key: 'root-nav-state' }),
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

// Mock Supabase client for PostgREST primary path
const mockGetUser = jest.fn();
const mockSingle = jest.fn();
const mockEq = jest.fn(() => ({ single: mockSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));

jest.mock('@/src/services/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
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

/**
 * Mock the PostgREST primary path to return a given user_status.
 * This sets up: getUser() → from('users').select().eq().single()
 */
function mockPostgRESTUserStatus(userStatus: string) {
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'test-user-id' } },
    error: null,
  });
  mockSingle.mockResolvedValue({
    data: { user_status: userStatus },
    error: null,
  });
}

/**
 * Mock the PostgREST path to fail (getUser returns error).
 */
function mockPostgRESTFailure() {
  mockGetUser.mockResolvedValue({
    data: { user: null },
    error: { message: 'Session expired' },
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

    it('does not call getUser or getWaitlistStatus while auth is loading', () => {
      mockAuthState(false, true);
      renderIndex();
      expect(mockGetUser).not.toHaveBeenCalled();
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

    it('does not call getUser or getWaitlistStatus', () => {
      mockAuthState(false);
      renderIndex();
      expect(mockGetUser).not.toHaveBeenCalled();
      expect(mockGetWaitlistStatus).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Authenticated user -- all 6 userStatus values (PostgREST primary path)
  // =========================================================================

  describe('authenticated user -- userStatus routing via PostgREST', () => {
    it('signed_up -> /(agreement)/upload', async () => {
      mockAuthState(true);
      mockPostgRESTUserStatus('signed_up');
      renderIndex();

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/(agreement)/upload');
      });
    });

    it('agreement_confirmed -> /(waitlist)', async () => {
      mockAuthState(true);
      mockPostgRESTUserStatus('agreement_confirmed');
      renderIndex();

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/(waitlist)');
      });
    });

    it('waitlisted -> /(waitlist)', async () => {
      mockAuthState(true);
      mockPostgRESTUserStatus('waitlisted');
      renderIndex();

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/(waitlist)');
      });
    });

    it('not_eligible -> /(waitlist)', async () => {
      mockAuthState(true);
      mockPostgRESTUserStatus('not_eligible');
      renderIndex();

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/(waitlist)');
      });
    });

    it('approved -> /(setup)', async () => {
      mockAuthState(true);
      mockPostgRESTUserStatus('approved');
      renderIndex();

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/(setup)');
      });
    });

    it('active -> /(main)', async () => {
      mockAuthState(true);
      mockPostgRESTUserStatus('active');
      renderIndex();

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/(main)');
      });
    });

    it('unknown status -> /(agreement)/upload (default fallback)', async () => {
      mockAuthState(true);
      mockPostgRESTUserStatus('some_unknown_status');
      renderIndex();

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/(agreement)/upload');
      });
    });

    it('does NOT call getWaitlistStatus when PostgREST succeeds', async () => {
      mockAuthState(true);
      mockPostgRESTUserStatus('active');
      renderIndex();

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/(main)');
      });

      expect(mockGetWaitlistStatus).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Fallback: PostgREST fails -> edge function fallback
  // =========================================================================

  describe('fallback to edge function when PostgREST fails', () => {
    it('uses edge function when PostgREST fails', async () => {
      mockAuthState(true);
      mockPostgRESTFailure();
      mockWaitlistResponse('approved');
      renderIndex();

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/(setup)');
      });

      expect(mockGetWaitlistStatus).toHaveBeenCalledTimes(1);
    });

    it('falls back to /(agreement)/upload when both paths fail', async () => {
      mockAuthState(true);
      mockPostgRESTFailure();
      mockWaitlistError();
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
    it('falls back to /(agreement)/upload when both paths fail', async () => {
      mockAuthState(true);
      mockPostgRESTFailure();
      mockGetWaitlistStatus.mockResolvedValue({ data: null, error: null });
      renderIndex();

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/(agreement)/upload');
      });
    });

    it('falls back to /(agreement)/upload on exception', async () => {
      mockAuthState(true);
      mockGetUser.mockRejectedValue(new Error('Network error'));
      mockGetWaitlistStatus.mockRejectedValue(new Error('Network error'));
      renderIndex();

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/(agreement)/upload');
      });
    });
  });

  // =========================================================================
  // One-shot navigation guard
  // =========================================================================

  describe('navigation guard', () => {
    it('navigates only once (hasNavigatedRef)', async () => {
      mockAuthState(true);
      mockPostgRESTUserStatus('active');

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
  // PostgREST is called first (primary path)
  // =========================================================================

  describe('PostgREST primary path', () => {
    it('calls getUser when authenticated', async () => {
      mockAuthState(true);
      mockPostgRESTUserStatus('active');
      renderIndex();

      await waitFor(() => {
        expect(mockGetUser).toHaveBeenCalledTimes(1);
      });
    });

    it('queries users table with correct parameters', async () => {
      mockAuthState(true);
      mockPostgRESTUserStatus('active');
      renderIndex();

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('users');
        expect(mockSelect).toHaveBeenCalledWith('user_status');
        expect(mockEq).toHaveBeenCalledWith('id', 'test-user-id');
      });
    });
  });
});
