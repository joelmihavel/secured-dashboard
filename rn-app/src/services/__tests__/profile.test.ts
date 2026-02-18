/**
 * Profile API Service -- Integration Tests
 *
 * Tests profile update, avatar upload, and saved payment methods retrieval.
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

// Mock global fetch for uploadAvatarFile
const originalFetch = global.fetch;

import {
  updateProfile,
  requestAvatarUpload,
  uploadAvatarFile,
  getSavedPaymentMethods,
} from '../api/profile';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Profile API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  // =========================================================================
  // updateProfile
  // =========================================================================
  describe('updateProfile', () => {
    it('maps camelCase fields to snake_case and returns mapped result', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          data: {
            user_id: 'u1',
            full_name: 'John Doe',
            first_name: 'John',
            last_name: 'Doe',
            email: 'john@test.com',
            avatar_url: 'https://avatar.url',
            updated_at: '2026-01-15T10:00:00Z',
          },
        },
        error: null,
      });

      const result = await updateProfile({
        fullName: 'John Doe',
        email: 'john@test.com',
      });

      expect(result.data).toEqual({
        userId: 'u1',
        fullName: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        avatarUrl: 'https://avatar.url',
        updatedAt: '2026-01-15T10:00:00Z',
      });

      // Verify snake_case body
      const [, body] = mockCallEdgeFunction.mock.calls[0];
      expect(body.full_name).toBe('John Doe');
      expect(body.email).toBe('john@test.com');
      // Should not include fields not provided
      expect(body.first_name).toBeUndefined();
    });

    it('only includes provided fields in body', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          data: {
            user_id: 'u1',
            full_name: null,
            first_name: 'Jane',
            last_name: null,
            email: null,
            avatar_url: null,
            updated_at: '2026-01-15T10:00:00Z',
          },
        },
        error: null,
      });

      await updateProfile({ firstName: 'Jane' });

      const [, body] = mockCallEdgeFunction.mock.calls[0];
      expect(body.first_name).toBe('Jane');
      expect(Object.keys(body)).toEqual(['first_name']);
    });

    it('maps NOT_AUTHENTICATED error', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: null,
        error: 'Not authenticated: missing auth header',
      });

      const result = await updateProfile({ fullName: 'Test' });

      expect(result.error?.code).toBe('NOT_AUTHENTICATED');
    });

    it('maps VALIDATION_ERROR', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: null,
        error: 'Validation error: invalid email format',
      });

      const result = await updateProfile({ email: 'bad' });

      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('returns UPDATE_FAILED when success=false', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: { success: false },
        error: null,
      });

      const result = await updateProfile({ fullName: 'Test' });

      expect(result.error?.code).toBe('UPDATE_FAILED');
    });
  });

  // =========================================================================
  // requestAvatarUpload
  // =========================================================================
  describe('requestAvatarUpload', () => {
    it('returns mapped avatar upload data', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          data: {
            upload_url: 'https://storage.co/signed',
            avatar_url: 'https://storage.co/public/avatar.jpg',
            file_path: 'avatars/u1.jpg',
            expires_at: '2026-01-15T11:00:00Z',
            max_file_size: 5242880,
          },
        },
        error: null,
      });

      const result = await requestAvatarUpload('image/jpeg');

      expect(result.data).toEqual({
        uploadUrl: 'https://storage.co/signed',
        avatarUrl: 'https://storage.co/public/avatar.jpg',
        filePath: 'avatars/u1.jpg',
        expiresAt: '2026-01-15T11:00:00Z',
        maxFileSize: 5242880,
      });

      const [, body] = mockCallEdgeFunction.mock.calls[0];
      expect(body.content_type).toBe('image/jpeg');
    });

    it('returns UPLOAD_FAILED when success=false', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: { success: false },
        error: null,
      });

      const result = await requestAvatarUpload('image/png');

      expect(result.error?.code).toBe('UPLOAD_FAILED');
    });

    it('maps upload/storage error', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: null,
        error: 'Storage upload failed',
      });

      const result = await requestAvatarUpload('image/png');

      expect(result.error?.code).toBe('UPLOAD_FAILED');
    });
  });

  // =========================================================================
  // uploadAvatarFile
  // =========================================================================
  describe('uploadAvatarFile', () => {
    it('uploads blob to presigned URL and returns success', async () => {
      const mockBlob = new Blob(['data']);
      global.fetch = jest.fn()
        .mockResolvedValueOnce({ blob: jest.fn().mockResolvedValue(mockBlob) }) // file fetch
        .mockResolvedValueOnce({ ok: true, status: 200 }); // upload PUT

      const result = await uploadAvatarFile(
        'https://signed-url',
        'file:///local.jpg',
        'image/jpeg'
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();

      // Verify the PUT call
      const [url, options] = (global.fetch as jest.Mock).mock.calls[1];
      expect(url).toBe('https://signed-url');
      expect(options.method).toBe('PUT');
      expect(options.headers['Content-Type']).toBe('image/jpeg');
    });

    it('returns error when upload response is not ok', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce({ blob: jest.fn().mockResolvedValue(new Blob()) })
        .mockResolvedValueOnce({ ok: false, status: 403 });

      const result = await uploadAvatarFile(
        'https://url',
        'file:///f.jpg',
        'image/jpeg'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('403');
    });

    it('returns error when fetch throws', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network failure'));

      const result = await uploadAvatarFile(
        'https://url',
        'file:///f.jpg',
        'image/jpeg'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network failure');
    });
  });

  // =========================================================================
  // getSavedPaymentMethods (profile module)
  // =========================================================================
  describe('getSavedPaymentMethods', () => {
    it('returns grouped payment methods with camelCase mapping', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: {
          success: true,
          data: {
            payment_methods: [
              {
                id: 'pm-001',
                type: 'upi',
                display_name: 'UPI',
                is_primary: true,
                is_verified: true,
                nickname: null,
                created_at: '2026-01-01T00:00:00Z',
                upi_vpa: 'test@upi',
              },
            ],
            primary_method_id: 'pm-001',
            grouped_methods: {
              upi: [{
                id: 'pm-001',
                type: 'upi',
                display_name: 'UPI',
                is_primary: true,
                is_verified: true,
                nickname: null,
                created_at: '2026-01-01T00:00:00Z',
                upi_vpa: 'test@upi',
              }],
              cards: [],
              netbanking: [],
            },
            total_count: 1,
          },
        },
        error: null,
      });

      const result = await getSavedPaymentMethods();

      expect(result.data?.methods[0].isPrimary).toBe(true);
      expect(result.data?.methods[0].upiVpa).toBe('test@upi');
      expect(result.data?.primaryMethodId).toBe('pm-001');
      expect(result.data?.totalCount).toBe(1);
    });

    it('returns mock data in dev mode on error', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: null,
        error: 'Auth error',
      });

      const result = await getSavedPaymentMethods();

      // __DEV__ is true, so mock data returned
      expect(result.data).toBeTruthy();
    });
  });
});
