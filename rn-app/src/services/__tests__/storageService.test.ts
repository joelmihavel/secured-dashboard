/**
 * Storage Service -- Integration Tests
 *
 * Tests file upload, signed URL generation, file deletion,
 * and utility helpers (MIME type, file size validation).
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockStorageUpload = jest.fn();
const mockStorageGetPublicUrl = jest.fn();
const mockStorageCreateSignedUrl = jest.fn();
const mockStorageRemove = jest.fn();

jest.mock('../../services/supabase/client', () => ({
  __esModule: true,
  supabase: {
    storage: {
      from: () => ({
        upload: mockStorageUpload,
        getPublicUrl: mockStorageGetPublicUrl,
        createSignedUrl: mockStorageCreateSignedUrl,
        remove: mockStorageRemove,
      }),
    },
  },
  callEdgeFunction: jest.fn(),
  getFunctionsUrl: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn().mockResolvedValue('base64encodeddata'),
  EncodingType: { Base64: 'base64' },
}));

jest.mock('base64-arraybuffer', () => ({
  decode: jest.fn().mockReturnValue(new ArrayBuffer(8)),
}));

import {
  uploadFile,
  uploadAgreement,
  uploadUtilityBill,
  uploadIdDocument,
  getSignedUrl,
  deleteFile,
  getMimeType,
  validateFileSize,
  validateAgreementType,
  STORAGE_BUCKETS,
} from '../payment/storageService';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Storage Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // STORAGE_BUCKETS
  // =========================================================================
  describe('STORAGE_BUCKETS', () => {
    it('defines all expected bucket names', () => {
      expect(STORAGE_BUCKETS.AGREEMENTS).toBe('agreements');
      expect(STORAGE_BUCKETS.UTILITY_BILLS).toBe('utility-bills');
      expect(STORAGE_BUCKETS.ID_DOCUMENTS).toBe('id-documents');
      expect(STORAGE_BUCKETS.RECEIPTS).toBe('receipts');
    });
  });

  // =========================================================================
  // uploadFile
  // =========================================================================
  describe('uploadFile', () => {
    it('reads file as base64, converts to ArrayBuffer, and uploads', async () => {
      mockStorageUpload.mockResolvedValue({
        data: { path: 'test/file.pdf' },
        error: null,
      });
      mockStorageGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://storage.co/test/file.pdf' },
      });

      const result = await uploadFile('agreements', 'test/file.pdf', {
        uri: 'file:///local.pdf',
        fileName: 'file.pdf',
        mimeType: 'application/pdf',
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe('test/file.pdf');
      expect(result.publicUrl).toBe('https://storage.co/test/file.pdf');
    });

    it('returns error when upload fails', async () => {
      mockStorageUpload.mockResolvedValue({
        data: null,
        error: { message: 'Bucket not found' },
      });

      const result = await uploadFile('bad-bucket', 'path', {
        uri: 'file:///f.pdf',
        fileName: 'f.pdf',
        mimeType: 'application/pdf',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Bucket not found');
    });

    it('catches exceptions during upload', async () => {
      mockStorageUpload.mockRejectedValue(new Error('Network error'));

      const result = await uploadFile('agreements', 'path', {
        uri: 'file:///f.pdf',
        fileName: 'f.pdf',
        mimeType: 'application/pdf',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  // =========================================================================
  // uploadAgreement / uploadUtilityBill / uploadIdDocument
  // =========================================================================
  describe('uploadAgreement', () => {
    it('builds correct path with tenancy ID and timestamp', async () => {
      mockStorageUpload.mockResolvedValue({
        data: { path: 'test-path' },
        error: null,
      });
      mockStorageGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'url' },
      });

      await uploadAgreement('ten-001', {
        uri: 'file:///f.pdf',
        fileName: 'doc.pdf',
        mimeType: 'application/pdf',
      });

      const [path, , options] = mockStorageUpload.mock.calls[0];
      expect(path).toMatch(/^ten-001\/agreement-\d+\.pdf$/);
      expect(options.contentType).toBe('application/pdf');
    });
  });

  describe('uploadUtilityBill', () => {
    it('builds correct path with utility type', async () => {
      mockStorageUpload.mockResolvedValue({
        data: { path: 'test' },
        error: null,
      });
      mockStorageGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'url' },
      });

      await uploadUtilityBill('ten-001', 'electricity', {
        uri: 'file:///f.jpg',
        fileName: 'bill.jpg',
        mimeType: 'image/jpeg',
      });

      const [path] = mockStorageUpload.mock.calls[0];
      expect(path).toMatch(/^ten-001\/electricity-\d+\.jpg$/);
    });
  });

  describe('uploadIdDocument', () => {
    it('builds correct path with document type', async () => {
      mockStorageUpload.mockResolvedValue({
        data: { path: 'test' },
        error: null,
      });
      mockStorageGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'url' },
      });

      await uploadIdDocument('user-001', 'aadhaar', {
        uri: 'file:///f.png',
        fileName: 'aadhaar.png',
        mimeType: 'image/png',
      });

      const [path] = mockStorageUpload.mock.calls[0];
      expect(path).toMatch(/^user-001\/aadhaar-\d+\.png$/);
    });
  });

  // =========================================================================
  // getSignedUrl
  // =========================================================================
  describe('getSignedUrl', () => {
    it('returns signed URL on success', async () => {
      mockStorageCreateSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://storage.co/signed?token=abc' },
        error: null,
      });

      const result = await getSignedUrl('agreements', 'ten-001/doc.pdf');

      expect(result.url).toBe('https://storage.co/signed?token=abc');
      expect(result.error).toBeNull();
    });

    it('returns error on failure', async () => {
      mockStorageCreateSignedUrl.mockResolvedValue({
        data: null,
        error: { message: 'File not found' },
      });

      const result = await getSignedUrl('agreements', 'nonexistent');

      expect(result.url).toBeNull();
      expect(result.error).toBe('File not found');
    });

    it('catches exceptions', async () => {
      mockStorageCreateSignedUrl.mockRejectedValue(new Error('Timeout'));

      const result = await getSignedUrl('agreements', 'path');

      expect(result.url).toBeNull();
      expect(result.error).toBe('Timeout');
    });
  });

  // =========================================================================
  // deleteFile
  // =========================================================================
  describe('deleteFile', () => {
    it('returns success on successful deletion', async () => {
      mockStorageRemove.mockResolvedValue({ error: null });

      const result = await deleteFile('agreements', 'ten-001/doc.pdf');

      expect(result.success).toBe(true);
    });

    it('returns error on failure', async () => {
      mockStorageRemove.mockResolvedValue({
        error: { message: 'Permission denied' },
      });

      const result = await deleteFile('agreements', 'path');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
    });

    it('catches exceptions', async () => {
      mockStorageRemove.mockRejectedValue(new Error('Network error'));

      const result = await deleteFile('agreements', 'path');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  // =========================================================================
  // Utility helpers
  // =========================================================================
  describe('getMimeType', () => {
    it('returns correct MIME types for known extensions', () => {
      expect(getMimeType('file.pdf')).toBe('application/pdf');
      expect(getMimeType('photo.jpg')).toBe('image/jpeg');
      expect(getMimeType('photo.jpeg')).toBe('image/jpeg');
      expect(getMimeType('image.png')).toBe('image/png');
      expect(getMimeType('pic.heic')).toBe('image/heic');
      expect(getMimeType('web.webp')).toBe('image/webp');
    });

    it('returns octet-stream for unknown extensions', () => {
      expect(getMimeType('file.xyz')).toBe('application/octet-stream');
      expect(getMimeType('noext')).toBe('application/octet-stream');
    });
  });

  describe('validateFileSize', () => {
    it('returns true for files within limit', () => {
      expect(validateFileSize(1024 * 1024 * 5)).toBe(true); // 5MB
      expect(validateFileSize(0)).toBe(true);
    });

    it('returns false for files exceeding limit', () => {
      expect(validateFileSize(1024 * 1024 * 11)).toBe(false); // 11MB > 10MB
    });

    it('supports custom max size', () => {
      expect(validateFileSize(1024 * 1024 * 50, 50)).toBe(true);
      expect(validateFileSize(1024 * 1024 * 51, 50)).toBe(false);
    });
  });

  describe('validateAgreementType', () => {
    it('allows PDF files', () => {
      expect(validateAgreementType('application/pdf')).toBe(true);
    });

    it('allows JPEG images', () => {
      expect(validateAgreementType('image/jpeg')).toBe(true);
      expect(validateAgreementType('image/jpg')).toBe(true);
    });

    it('allows PNG images', () => {
      expect(validateAgreementType('image/png')).toBe(true);
    });

    it('rejects other file types', () => {
      expect(validateAgreementType('text/plain')).toBe(false);
      expect(validateAgreementType('image/heic')).toBe(false);
      expect(validateAgreementType('application/zip')).toBe(false);
    });
  });
});
