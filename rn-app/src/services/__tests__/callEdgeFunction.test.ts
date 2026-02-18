/**
 * callEdgeFunction -- Integration Tests
 *
 * Tests the core edge function caller that all API services depend on.
 * Validates auth token attachment, timeout handling, GET/POST routing,
 * error parsing, and AbortController behavior.
 *
 * NOTE: babel-preset-expo inlines EXPO_PUBLIC_* env vars at compile time.
 * The test values are set in jest.config.js so they are available when
 * babel transforms client.ts.
 */

// ---------------------------------------------------------------------------
// Mocks (hoisted)
// ---------------------------------------------------------------------------

const mockGetSession = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  }),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

import { callEdgeFunction, getFunctionsUrl } from '../supabase/client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FUNCTIONS_BASE = 'https://test-project.supabase.co/functions/v1';

function mockFetchResponse(body: unknown, status = 200) {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('callEdgeFunction', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: {
        session: { access_token: 'test-jwt-token' },
      },
    });
    // callEdgeFunction uses real setTimeout for AbortController timeouts.
    // The global setup.ts installs fake timers, but callEdgeFunction needs
    // real timers for the AbortController pattern.
    jest.useRealTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // =========================================================================
  // getFunctionsUrl
  // =========================================================================
  describe('getFunctionsUrl', () => {
    it('returns the correct functions URL', () => {
      expect(getFunctionsUrl()).toBe(FUNCTIONS_BASE);
    });
  });

  // =========================================================================
  // POST requests
  // =========================================================================
  describe('POST requests', () => {
    it('sends JSON body with correct headers', async () => {
      const mockFetch = mockFetchResponse({ success: true });
      global.fetch = mockFetch;

      await callEdgeFunction('test-function', { key: 'value' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(`${FUNCTIONS_BASE}/test-function`);
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.headers['apikey']).toBe('test-anon-key-12345');
      expect(JSON.parse(options.body)).toEqual({ key: 'value' });
    });

    it('returns parsed data on success', async () => {
      global.fetch = mockFetchResponse({ success: true, data: { id: '1' } });

      const result = await callEdgeFunction('my-func', {});

      expect(result.data).toEqual({ success: true, data: { id: '1' } });
      expect(result.error).toBeNull();
    });
  });

  // =========================================================================
  // GET requests
  // =========================================================================
  describe('GET requests', () => {
    it('appends body as query parameters for GET', async () => {
      const mockFetch = mockFetchResponse({ success: true });
      global.fetch = mockFetch;

      await callEdgeFunction(
        'my-func',
        { page: '1', limit: '20' },
        false,
        'GET'
      );

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('page=1');
      expect(url).toContain('limit=20');
      expect(options.method).toBe('GET');
      expect(options.body).toBeUndefined();
    });

    it('skips null/undefined/empty query params', async () => {
      const mockFetch = mockFetchResponse({ success: true });
      global.fetch = mockFetch;

      await callEdgeFunction(
        'my-func',
        { valid: 'yes', empty: '', nil: null },
        false,
        'GET'
      );

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('valid=yes');
      expect(url).not.toContain('empty=');
      expect(url).not.toContain('nil');
    });
  });

  // =========================================================================
  // Auth token attachment
  // =========================================================================
  describe('auth token attachment', () => {
    it('attaches Authorization header when requireAuth=true', async () => {
      const mockFetch = mockFetchResponse({ success: true });
      global.fetch = mockFetch;

      await callEdgeFunction('protected-func', {}, true);

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['Authorization']).toBe('Bearer test-jwt-token');
    });

    it('does not attach Authorization header when requireAuth=false', async () => {
      const mockFetch = mockFetchResponse({ success: true });
      global.fetch = mockFetch;

      await callEdgeFunction('public-func', {}, false);

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['Authorization']).toBeUndefined();
    });

    it('returns "Not authenticated" error when no session exists', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
      });
      const mockFetch = mockFetchResponse({ success: true });
      global.fetch = mockFetch;

      const result = await callEdgeFunction('protected-func', {}, true);

      expect(result.data).toBeNull();
      expect(result.error).toBe('Not authenticated');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns "Not authenticated" when session has no access_token', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: null } },
      });
      const mockFetch = mockFetchResponse({ success: true });
      global.fetch = mockFetch;

      const result = await callEdgeFunction('protected-func', {}, true);

      expect(result.error).toBe('Not authenticated');
    });
  });

  // =========================================================================
  // Error handling
  // =========================================================================
  describe('error handling', () => {
    it('returns error message from backend structured error response', async () => {
      global.fetch = mockFetchResponse(
        { message: 'Tenant not found' },
        404
      );

      const result = await callEdgeFunction('not-found', {});

      expect(result.data).toBeNull();
      expect(result.error).toBe('Tenant not found');
    });

    it('falls back to HTTP status when no message in body', async () => {
      global.fetch = mockFetchResponse({}, 500);

      const result = await callEdgeFunction('server-error', {});

      expect(result.error).toBe('HTTP 500');
    });

    it('handles nested error.message from backend', async () => {
      global.fetch = mockFetchResponse(
        { error: { message: 'Validation failed' } },
        422
      );

      const result = await callEdgeFunction('validation-error', {});

      expect(result.error).toBe('Validation failed');
    });

    it('returns network error message when fetch throws', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network request failed'));

      const result = await callEdgeFunction('any-func', {});

      expect(result.data).toBeNull();
      expect(result.error).toBe('Network request failed');
    });

    it('handles non-Error thrown values', async () => {
      global.fetch = jest.fn().mockRejectedValue('something went wrong');

      const result = await callEdgeFunction('any-func', {});

      expect(result.error).toBe('Network error');
    });
  });

  // =========================================================================
  // Timeout handling
  // =========================================================================
  describe('timeout handling', () => {
    it('uses AbortController with the specified timeout', async () => {
      const mockFetch = mockFetchResponse({ success: true });
      global.fetch = mockFetch;

      await callEdgeFunction('func', {}, false, 'POST', 5000);

      const [, options] = mockFetch.mock.calls[0];
      expect(options.signal).toBeDefined();
      expect(options.signal).toBeInstanceOf(AbortSignal);
    });

    it('returns timeout error when AbortError is thrown', async () => {
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      global.fetch = jest.fn().mockRejectedValue(abortError);

      const result = await callEdgeFunction('slow-func', {}, false, 'POST', 5000);

      expect(result.data).toBeNull();
      expect(result.error).toContain('timed out');
      expect(result.error).toContain('5s');
    });
  });

  // =========================================================================
  // Request ID header
  // =========================================================================
  describe('request metadata', () => {
    it('includes x-request-id header', async () => {
      const mockFetch = mockFetchResponse({ success: true });
      global.fetch = mockFetch;

      await callEdgeFunction('func', {});

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['x-request-id']).toMatch(/^rn-\d+-[a-z0-9]+$/);
    });
  });
});
