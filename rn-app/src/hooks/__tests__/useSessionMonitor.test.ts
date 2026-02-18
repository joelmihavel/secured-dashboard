/**
 * Tests for useSessionMonitor hook
 *
 * Verifies session refresh behavior on app foreground transitions.
 */

import { renderHook, act } from '@testing-library/react-native';
import { AppState, AppStateStatus } from 'react-native';

// Track the registered AppState listener
let appStateListener: ((state: AppStateStatus) => void) | null = null;
const mockRemove = jest.fn();

// Mock AppState.addEventListener to capture the callback
jest.spyOn(AppState, 'addEventListener').mockImplementation(
  (_type: string, listener: (state: AppStateStatus) => void) => {
    appStateListener = listener;
    return { remove: mockRemove } as any;
  }
);

// Define AppState.currentState as writable for test manipulation
Object.defineProperty(AppState, 'currentState', {
  writable: true,
  value: 'active' as AppStateStatus,
});

// Mock Supabase client
const mockRefreshSession = jest.fn();
jest.mock('../../services/supabase/client', () => ({
  supabase: {
    auth: {
      refreshSession: () => mockRefreshSession(),
    },
  },
}));

// Mock React Query
const mockInvalidateQueries = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

// Mock dashboard keys
jest.mock('../useDashboard', () => ({
  dashboardKeys: {
    all: ['dashboard'],
  },
}));

// Mock Sentry (loaded dynamically by useSessionMonitor)
jest.mock('../../config/sentry', () => ({
  addBreadcrumb: jest.fn(),
}));

import { useSessionMonitor } from '../useSessionMonitor';

describe('useSessionMonitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    appStateListener = null;
    (AppState as any).currentState = 'active';

    mockRefreshSession.mockResolvedValue({
      data: { session: { expires_at: Date.now() + 3600000 } },
      error: null,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('registers an AppState listener on mount', () => {
    renderHook(() => useSessionMonitor());

    expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('removes the listener on unmount', () => {
    const { unmount } = renderHook(() => useSessionMonitor());
    unmount();

    expect(mockRemove).toHaveBeenCalled();
  });

  it('does not register listener when disabled', () => {
    const addEventListenerSpy = jest.spyOn(AppState, 'addEventListener');
    const callCountBefore = addEventListenerSpy.mock.calls.length;

    renderHook(() => useSessionMonitor({ enabled: false }));

    // Should not have added a new listener
    expect(addEventListenerSpy.mock.calls.length).toBe(callCountBefore);
  });

  it('refreshes session when app returns from background after sufficient time', async () => {
    renderHook(() => useSessionMonitor({ minBackgroundDuration: 0 }));

    expect(appStateListener).not.toBeNull();

    // Simulate going to background
    await act(async () => {
      appStateListener!('background');
    });

    // Simulate returning to foreground
    await act(async () => {
      appStateListener!('active');
    });

    expect(mockRefreshSession).toHaveBeenCalled();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['dashboard'],
    });
  });

  it('does not refresh when app was only briefly backgrounded', async () => {
    renderHook(() => useSessionMonitor({ minBackgroundDuration: 60000 }));

    // Simulate quick background/foreground
    await act(async () => {
      appStateListener!('background');
    });

    // Return immediately (within minBackgroundDuration)
    await act(async () => {
      appStateListener!('active');
    });

    expect(mockRefreshSession).not.toHaveBeenCalled();
  });

  it('does not invalidate queries when session refresh fails', async () => {
    mockRefreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'Session expired' },
    });

    renderHook(() => useSessionMonitor({ minBackgroundDuration: 0 }));

    await act(async () => {
      appStateListener!('background');
    });

    await act(async () => {
      appStateListener!('active');
    });

    expect(mockRefreshSession).toHaveBeenCalled();
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });

  it('does not invalidate queries when no session returned', async () => {
    mockRefreshSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    renderHook(() => useSessionMonitor({ minBackgroundDuration: 0 }));

    await act(async () => {
      appStateListener!('background');
    });

    await act(async () => {
      appStateListener!('active');
    });

    expect(mockRefreshSession).toHaveBeenCalled();
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });

  it('handles refresh errors gracefully without throwing', async () => {
    mockRefreshSession.mockRejectedValue(new Error('Network error'));

    renderHook(() => useSessionMonitor({ minBackgroundDuration: 0 }));

    await act(async () => {
      appStateListener!('background');
    });

    // Should not throw
    await act(async () => {
      appStateListener!('active');
    });

    expect(mockRefreshSession).toHaveBeenCalled();
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });
});
