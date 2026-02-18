/**
 * Tests for useNetworkStatus hook (ST-105)
 *
 * Tests offline detection, mutation queuing, and queue processing.
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import {
  useNetworkStatus,
  queueMutation,
  getQueueLength,
  clearMutationQueue,
  getNetworkStatus,
} from '../useNetworkStatus';

// Mock fetch for connectivity checks
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock Sentry breadcrumb
jest.mock('../../config/sentry', () => ({
  addBreadcrumb: jest.fn(),
}));

describe('useNetworkStatus', () => {
  beforeEach(() => {
    clearMutationQueue();
    mockFetch.mockReset();
  });

  it('should report connected when fetch succeeds', async () => {
    mockFetch.mockResolvedValue({ status: 204, ok: true });

    const { result } = renderHook(() => useNetworkStatus(60_000));

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    expect(result.current.isInternetReachable).toBe(true);
  });

  it('should report disconnected when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useNetworkStatus(60_000));

    await waitFor(() => {
      expect(result.current.isConnected).toBe(false);
    });

    expect(result.current.isInternetReachable).toBe(false);
    expect(result.current.networkType).toBe('none');
  });
});

describe('queueMutation', () => {
  beforeEach(() => {
    clearMutationQueue();
    mockFetch.mockReset();
  });

  it('should queue a mutation when offline', () => {
    // Simulate offline by making getNetworkStatus return disconnected
    mockFetch.mockRejectedValue(new Error('offline'));

    const executeFn = jest.fn().mockResolvedValue(undefined);
    queueMutation('test-mutation', executeFn, false);

    expect(getQueueLength()).toBe(1);
  });

  it('should clear the queue', () => {
    const executeFn = jest.fn().mockResolvedValue(undefined);
    queueMutation('test-mutation-1', executeFn, false);
    queueMutation('test-mutation-2', executeFn, false);

    expect(getQueueLength()).toBe(2);

    clearMutationQueue();

    expect(getQueueLength()).toBe(0);
  });

  it('should return correct queue length', () => {
    const executeFn = jest.fn().mockResolvedValue(undefined);

    expect(getQueueLength()).toBe(0);

    queueMutation('m1', executeFn, false);
    expect(getQueueLength()).toBe(1);

    queueMutation('m2', executeFn, false);
    expect(getQueueLength()).toBe(2);
  });
});

describe('getNetworkStatus', () => {
  it('should return the last known status', () => {
    const status = getNetworkStatus();
    expect(status).toHaveProperty('isConnected');
    expect(status).toHaveProperty('isInternetReachable');
    expect(status).toHaveProperty('networkType');
  });
});
