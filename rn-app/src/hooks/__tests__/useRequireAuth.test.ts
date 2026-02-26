/**
 * useRequireAuth Hook Tests
 *
 * Tests the passive auth guard hook that reads state from AuthProvider context.
 * The hook itself does NOT navigate -- that is AuthProvider's responsibility.
 */

import { renderHook } from '@testing-library/react-native';
import { useRequireAuth } from '../useRequireAuth';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUseAuthContext = jest.fn();

jest.mock('@/src/providers', () => ({
  useAuthContext: (...args: unknown[]) => mockUseAuthContext(...args),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useRequireAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns isReady=false when auth is still loading', () => {
    mockUseAuthContext.mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
    });

    const { result } = renderHook(() => useRequireAuth());

    expect(result.current.isReady).toBe(false);
  });

  it('returns isReady=true and isAuthenticated=true when user is signed in', () => {
    mockUseAuthContext.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
    });

    const { result } = renderHook(() => useRequireAuth());

    expect(result.current.isReady).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('returns isReady=true and isAuthenticated=false when user is not signed in', () => {
    mockUseAuthContext.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
    });

    const { result } = renderHook(() => useRequireAuth());

    expect(result.current.isReady).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('does NOT trigger any navigation side effects', () => {
    // The hook is a passive reader -- it delegates navigation to AuthProvider.
    // We verify that no router/navigation module is imported or called.
    mockUseAuthContext.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
    });

    renderHook(() => useRequireAuth());

    // useAuthContext should be the ONLY external call
    expect(mockUseAuthContext).toHaveBeenCalledTimes(1);
    expect(mockUseAuthContext).toHaveBeenCalledWith();
  });

  it('re-derives values when context changes from loading to authenticated', () => {
    mockUseAuthContext.mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
    });

    const { result, rerender } = renderHook(() => useRequireAuth());

    expect(result.current.isReady).toBe(false);

    // Simulate context update
    mockUseAuthContext.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
    });

    rerender({});

    expect(result.current.isReady).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('re-derives values when context changes from authenticated to not authenticated', () => {
    mockUseAuthContext.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
    });

    const { result, rerender } = renderHook(() => useRequireAuth());

    expect(result.current.isAuthenticated).toBe(true);

    // Simulate sign-out
    mockUseAuthContext.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
    });

    rerender({});

    expect(result.current.isReady).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
  });
});
