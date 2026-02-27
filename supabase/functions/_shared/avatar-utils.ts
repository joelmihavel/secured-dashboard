/**
 * Avatar Utilities
 *
 * Shared helpers for avatar validation, cleanup, and URL generation.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { ValidationError } from "./errors.ts";

// PNG magic bytes: 89 50 4E 47
const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
// JPEG magic bytes: FF D8 FF
const JPEG_MAGIC = new Uint8Array([0xff, 0xd8, 0xff]);

/**
 * Validate an image file's magic bytes and size.
 * Throws ValidationError if invalid.
 */
export function validateImageFile(
  bytes: Uint8Array,
  maxSizeBytes: number = 5 * 1024 * 1024
): { format: "png" | "jpeg" } {
  if (bytes.length > maxSizeBytes) {
    throw new ValidationError(
      `File too large: ${(bytes.length / 1024 / 1024).toFixed(1)}MB exceeds ${(maxSizeBytes / 1024 / 1024).toFixed(0)}MB limit`
    );
  }

  if (bytes.length < 4) {
    throw new ValidationError("File too small to be a valid image");
  }

  // Check PNG
  if (
    bytes[0] === PNG_MAGIC[0] &&
    bytes[1] === PNG_MAGIC[1] &&
    bytes[2] === PNG_MAGIC[2] &&
    bytes[3] === PNG_MAGIC[3]
  ) {
    return { format: "png" };
  }

  // Check JPEG
  if (
    bytes[0] === JPEG_MAGIC[0] &&
    bytes[1] === JPEG_MAGIC[1] &&
    bytes[2] === JPEG_MAGIC[2]
  ) {
    return { format: "jpeg" };
  }

  throw new ValidationError(
    "Invalid image format. Only PNG and JPEG are supported."
  );
}

/**
 * Parse image dimensions from PNG or JPEG header bytes.
 * Returns null if dimensions cannot be determined.
 */
export function parseImageDimensions(
  bytes: Uint8Array,
  format: "png" | "jpeg"
): { width: number; height: number } | null {
  if (format === "png" && bytes.length >= 24) {
    // PNG IHDR chunk: width at bytes 16-19, height at 20-23
    const width =
      (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
    const height =
      (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    return { width, height };
  }

  if (format === "jpeg") {
    // Scan JPEG markers for SOF0/SOF2 (0xFFC0/0xFFC2)
    let offset = 2;
    while (offset < bytes.length - 8) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1];
      if (marker === 0xc0 || marker === 0xc2) {
        const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
        const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
        return { width, height };
      }
      // Skip to next marker
      const segLen = (bytes[offset + 2] << 8) | bytes[offset + 3];
      offset += 2 + segLen;
    }
  }

  return null;
}

/**
 * Validate image dimensions — reject images larger than maxDimension.
 */
export function validateDimensions(
  width: number,
  height: number,
  maxDimension: number = 4096
): void {
  if (width > maxDimension || height > maxDimension) {
    throw new ValidationError(
      `Image dimensions ${width}x${height} exceed maximum ${maxDimension}x${maxDimension}`
    );
  }
}

/**
 * Check decompression ratio to prevent decompression bombs.
 */
export function validateDecompressionRatio(
  compressedSize: number,
  width: number,
  height: number,
  maxRatio: number = 100
): void {
  const decompressedSize = width * height * 4; // RGBA
  const ratio = decompressedSize / compressedSize;
  if (ratio > maxRatio) {
    throw new ValidationError(
      `Decompression ratio ${ratio.toFixed(0)}:1 exceeds safety limit of ${maxRatio}:1`
    );
  }
}

/**
 * Delete old avatar files for a user (cleanup after new upload).
 */
export async function cleanupOldAvatars(
  client: SupabaseClient,
  userId: string,
  keepPaths: string[]
): Promise<void> {
  const { data: files } = await client.storage
    .from("avatars")
    .list(userId, { limit: 100 });

  if (!files || files.length === 0) return;

  const toDelete = files
    .map((f) => `${userId}/${f.name}`)
    .filter((path) => !keepPaths.includes(path));

  if (toDelete.length > 0) {
    await client.storage.from("avatars").remove(toDelete);
  }
}

/**
 * Get a public URL for an avatar in Supabase Storage.
 */
export function getAvatarPublicUrl(
  client: SupabaseClient,
  path: string
): string {
  const { data } = client.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Get public URL for a default avatar.
 */
export function getDefaultAvatarUrl(
  client: SupabaseClient,
  avatarNumber: number
): string {
  return getAvatarPublicUrl(client, `defaults/${avatarNumber}.png`);
}
