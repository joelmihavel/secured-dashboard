/**
 * Supabase Storage Service
 *
 * Handles file uploads to Supabase storage buckets.
 * Used for agreement documents, utility bills, etc.
 */

import { supabase } from '../supabase';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

// ==============================================
// TYPES
// ==============================================

export interface UploadResult {
  success: boolean;
  path?: string;
  publicUrl?: string;
  error?: string;
}

export interface DocumentUpload {
  uri: string;
  fileName: string;
  mimeType: string;
}

// ==============================================
// BUCKET NAMES
// ==============================================

export const STORAGE_BUCKETS = {
  AGREEMENTS: 'agreements',
  UTILITY_BILLS: 'utility-bills',
  ID_DOCUMENTS: 'id-documents',
  RECEIPTS: 'receipts',
} as const;

// ==============================================
// UPLOAD FUNCTIONS
// ==============================================

/**
 * Upload a file to Supabase storage
 */
export async function uploadFile(
  bucket: string,
  path: string,
  document: DocumentUpload
): Promise<UploadResult> {
  try {
    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(document.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert to ArrayBuffer
    const arrayBuffer = decode(base64);

    // Upload to Supabase
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, arrayBuffer, {
        contentType: document.mimeType,
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return {
      success: true,
      path: data.path,
      publicUrl: urlData.publicUrl,
    };
  } catch (error) {
    console.error('Upload exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Upload rental agreement document
 */
export async function uploadAgreement(
  tenancyId: string,
  document: DocumentUpload
): Promise<UploadResult> {
  const timestamp = Date.now();
  const extension = getFileExtension(document.mimeType);
  const path = `${tenancyId}/agreement-${timestamp}.${extension}`;

  return uploadFile(STORAGE_BUCKETS.AGREEMENTS, path, document);
}

/**
 * Upload utility bill for verification
 */
export async function uploadUtilityBill(
  tenancyId: string,
  utilityType: string,
  document: DocumentUpload
): Promise<UploadResult> {
  const timestamp = Date.now();
  const extension = getFileExtension(document.mimeType);
  const path = `${tenancyId}/${utilityType}-${timestamp}.${extension}`;

  return uploadFile(STORAGE_BUCKETS.UTILITY_BILLS, path, document);
}

/**
 * Upload ID document for verification
 */
export async function uploadIdDocument(
  userId: string,
  documentType: 'aadhaar' | 'pan' | 'passport',
  document: DocumentUpload
): Promise<UploadResult> {
  const timestamp = Date.now();
  const extension = getFileExtension(document.mimeType);
  const path = `${userId}/${documentType}-${timestamp}.${extension}`;

  return uploadFile(STORAGE_BUCKETS.ID_DOCUMENTS, path, document);
}

/**
 * Get download URL for a stored file
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn = 3600
): Promise<{ url: string | null; error: string | null }> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) {
      return { url: null, error: error.message };
    }

    return { url: data.signedUrl, error: null };
  } catch (error) {
    return {
      url: null,
      error: error instanceof Error ? error.message : 'Failed to get URL',
    };
  }
}

/**
 * Delete a file from storage
 */
export async function deleteFile(
  bucket: string,
  path: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed',
    };
  }
}

// ==============================================
// HELPERS
// ==============================================

function getFileExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/heic': 'heic',
    'image/webp': 'webp',
  };

  return mimeToExt[mimeType] ?? 'bin';
}

/**
 * Get MIME type from file extension
 */
export function getMimeType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();

  const extToMime: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    heic: 'image/heic',
    webp: 'image/webp',
  };

  return extToMime[extension ?? ''] ?? 'application/octet-stream';
}

/**
 * Validate file size (max 10MB)
 */
export function validateFileSize(sizeInBytes: number, maxMB = 10): boolean {
  const maxBytes = maxMB * 1024 * 1024;
  return sizeInBytes <= maxBytes;
}

/**
 * Validate file type for agreements
 */
export function validateAgreementType(mimeType: string): boolean {
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
  return allowedTypes.includes(mimeType);
}
