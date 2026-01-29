/**
 * Flent Secured v2 - Upload Avatar Edge Function
 *
 * Generates a presigned URL for avatar upload to Supabase Storage.
 * Handles cleanup of previous avatars and returns the final public URL.
 *
 * Endpoint: POST /functions/v1/upload-avatar
 * Auth: Required (JWT)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  createServiceClient,
  createAuthenticatedClient,
} from "../_shared/supabase.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { ValidationError, handleError } from "../_shared/errors.ts";
import { validateSchema } from "../_shared/validation.ts";
import { AuditLogger } from "../_shared/audit.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const BUCKET_NAME = "avatars";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/heic", "image/heif"];
const UPLOAD_EXPIRY_SECONDS = 3600; // 1 hour

// ==============================================
// TYPES
// ==============================================

interface UploadAvatarRequest {
  content_type: string;
}

interface UploadAvatarResponse {
  success: boolean;
  data: {
    upload_url: string;
    avatar_url: string;
    file_path: string;
    expires_at: string;
    max_file_size: number;
  };
}

// ==============================================
// VALIDATION SCHEMA
// ==============================================

const requestSchema = {
  content_type: {
    required: true,
    type: "string" as const,
    custom: (v: unknown) => {
      if (typeof v !== "string") return "content_type must be a string";
      if (!ALLOWED_TYPES.includes(v)) {
        return `Invalid content type. Allowed: ${ALLOWED_TYPES.join(", ")}`;
      }
      return true;
    },
  },
};

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabase = createServiceClient();
  let audit: AuditLogger | null = null;
  let userId: string | null = null;

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const { userId: uid } = await createAuthenticatedClient(authHeader);
    userId = uid;

    // Initialize audit logger
    audit = AuditLogger.fromRequest(supabase, req, userId, "upload-avatar");

    // Parse and validate request
    const body = await req.json();
    const { content_type } = validateSchema<UploadAvatarRequest>(
      body,
      requestSchema,
      true
    );

    // Generate unique file path
    const extension =
      content_type === "image/jpeg"
        ? "jpg"
        : content_type === "image/png"
          ? "png"
          : "heic";
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().slice(0, 8);
    const filePath = `${userId}/${timestamp}-${randomId}.${extension}`;

    // Delete previous avatars for this user
    try {
      const { data: existingFiles } = await supabase.storage
        .from(BUCKET_NAME)
        .list(userId);

      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles.map((f) => `${userId}/${f.name}`);
        await supabase.storage.from(BUCKET_NAME).remove(filesToDelete);
        console.log(`Deleted ${filesToDelete.length} previous avatars`);
      }
    } catch (cleanupError) {
      // Log but don't fail - previous avatar cleanup is not critical
      console.warn("Failed to clean up previous avatars:", cleanupError);
    }

    // Generate presigned upload URL
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(filePath);

    if (uploadError || !uploadData) {
      throw new Error(
        `Failed to generate upload URL: ${uploadError?.message ?? "Unknown error"}`
      );
    }

    // Generate public URL (will be valid after upload)
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    const expiresAt = new Date(
      Date.now() + UPLOAD_EXPIRY_SECONDS * 1000
    ).toISOString();

    // Log audit
    await audit.logSuccess("AVATAR_UPLOAD_INITIATED", "profile", "user", userId, {
      file_path: filePath,
      content_type,
    });

    // Build response
    const response: UploadAvatarResponse = {
      success: true,
      data: {
        upload_url: uploadData.signedUrl,
        avatar_url: publicUrlData.publicUrl,
        file_path: filePath,
        expires_at: expiresAt,
        max_file_size: MAX_FILE_SIZE,
      },
    };

    return jsonResponse(response);
  } catch (error) {
    // Log failure
    if (audit && userId) {
      await audit.logFailure(
        "AVATAR_UPLOAD_FAILED",
        "profile",
        error instanceof ValidationError ? "VALIDATION_ERROR" : "UPLOAD_FAILED",
        error instanceof Error ? error.message : "Unknown error",
        "user",
        userId
      );
    }

    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
