/**
 * Flent Secured v2 - Edge Function: upload-document
 *
 * V1 COMPATIBILITY: Generates signed upload URLs for rent agreement PDFs.
 * iOS app calls this to get a pre-signed URL before uploading.
 *
 * V2 IMPROVEMENTS:
 * - Creates extracted_rental_info record (V2 table) instead of waitlist entry
 * - Validates file type and size
 * - Comprehensive audit logging
 * - Better error handling
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { handleCors, getCorsHeaders, jsonResponse } from "../_shared/cors.ts";
import { AuthError, ValidationError, handleError } from "../_shared/errors.ts";
import { AuditLogger, AuditActions } from "../_shared/audit.ts";

// ==============================================
// CONSTANTS
// ==============================================

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
];

// ==============================================
// TYPES
// ==============================================

interface UploadDocumentRequest {
  file_name: string;
  file_type: string;
  file_size: number;
}

interface UploadDocumentResponse {
  success: boolean;
  upload_url?: string;
  waitlist_entry_id?: string; // V1 field (actually extracted_rental_info_id)
  extracted_rental_info_id?: string; // V2 field
  download_url?: string;
  document_path?: string;
  error?: string;
}

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req) => {
  console.log("[upload-document] v2 - Using bucket: rent-agreements");

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const headers = getCorsHeaders(req);

  try {
    if (req.method !== "POST") {
      throw new ValidationError("Method not allowed", { method: "POST required" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new AuthError("Missing authorization header");
    }

    // Create client with user's auth
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthError("Unauthorized");
    }

    // Parse and validate request body
    const body: UploadDocumentRequest = await req.json();

    if (!body.file_name) {
      throw new ValidationError("Missing file_name", { file_name: "Required" });
    }

    if (!body.file_type) {
      throw new ValidationError("Missing file_type", { file_type: "Required" });
    }

    if (!body.file_size || body.file_size <= 0) {
      throw new ValidationError("Invalid file_size", {
        file_size: "Must be a positive number",
      });
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(body.file_type)) {
      throw new ValidationError("Invalid file type", {
        file_type: `Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`,
      });
    }

    // Validate file size
    if (body.file_size > MAX_FILE_SIZE) {
      throw new ValidationError("File too large", {
        file_size: `Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      });
    }

    // Create admin client
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize audit logger
    const audit = AuditLogger.fromRequest(
      adminClient,
      req,
      user.id,
      "upload-document"
    );

    // ==============================================
    // ENSURE USER EXISTS IN public.users
    // ==============================================
    // The auth trigger should create this, but ensure it exists as a safety net.
    // Without this row, the FK constraint on extracted_rental_info.user_id fails.

    await adminClient.from("users").upsert(
      {
        id: user.id,
        phone: user.phone ?? null,
      },
      { onConflict: "id" }
    );

    // ==============================================
    // CHECK FOR EXISTING PENDING EXTRACTION
    // ==============================================
    // If user already has a pending extraction, return that instead of creating new

    const { data: existingExtraction, error: existingError } = await supabase
      .from("extracted_rental_info")
      .select("id, document_storage_path, extraction_status, updated_at")
      .eq("user_id", user.id)
      .in("extraction_status", ["pending", "processing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log("[upload-document] Existing extraction check:", JSON.stringify({ found: !!existingExtraction, status: existingExtraction?.extraction_status, error: existingError?.message }));

    if (existingExtraction && existingExtraction.extraction_status === "processing") {
      // Check if the processing record is stale (older than 5 minutes)
      const updatedAt = new Date(existingExtraction.updated_at || 0);
      const now = new Date();
      const staleThresholdMs = 5 * 60 * 1000; // 5 minutes
      const isStale = (now.getTime() - updatedAt.getTime()) > staleThresholdMs;

      if (isStale) {
        // Reset stale processing record to failed so user can retry
        console.log(`[upload-document] Resetting stale processing record ${existingExtraction.id} to failed`);
        await adminClient
          .from("extracted_rental_info")
          .update({
            extraction_status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingExtraction.id);
        // Continue to create new upload
      } else {
        // Document is actively being processed - don't allow new upload
        throw new ValidationError("Document processing in progress", {
          extraction_status: "Please wait for current extraction to complete",
        });
      }
    }

    // ==============================================
    // BUG 7 FIX: MARK ORPHANED COMPLETED EXTRACTIONS
    // ==============================================
    // On re-upload, mark existing completed+unverified extractions as failed
    // so they don't block the new upload or confuse mount discovery.

    const { data: orphanedExtractions } = await adminClient
      .from("extracted_rental_info")
      .select("id")
      .eq("user_id", user.id)
      .eq("extraction_status", "completed")
      .eq("user_verified", false);

    if (orphanedExtractions && orphanedExtractions.length > 0) {
      const orphanIds = orphanedExtractions.map((e: { id: string }) => e.id);
      console.log(`[upload-document] Marking ${orphanIds.length} orphaned completed extraction(s) as failed:`, orphanIds);
      await adminClient
        .from("extracted_rental_info")
        .update({
          extraction_status: "failed",
          extraction_error: "Superseded by re-upload",
          updated_at: new Date().toISOString(),
        })
        .in("id", orphanIds);
    }

    // ==============================================
    // GENERATE STORAGE PATH
    // ==============================================

    const fileExtension = body.file_name.split(".").pop() || "pdf";
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().slice(0, 8);
    const storagePath = `${user.id}/${timestamp}-${randomId}.${fileExtension}`;

    // ==============================================
    // CREATE SIGNED UPLOAD URL
    // ==============================================

    console.log("[upload-document] Creating signed URL for bucket: rent-agreements, path:", storagePath);

    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from("rent-agreements")
      .createSignedUploadUrl(storagePath, {
        upsert: true,
      });

    console.log("[upload-document] Signed URL result - data:", !!uploadData, "error:", JSON.stringify(uploadError));

    if (uploadError || !uploadData) {
      console.error("[upload-document] Failed to create signed URL:", uploadError);
      throw new ValidationError("Failed to create upload URL", {
        storage: uploadError?.message || "Unknown error",
      });
    }

    // ==============================================
    // CREATE EXTRACTED_RENTAL_INFO RECORD
    // ==============================================
    // V2: We create the extraction record before upload
    // This replaces V1's waitlist_entries table

    let extractionId: string;

    if (existingExtraction && existingExtraction.extraction_status === "pending") {
      // Update existing pending record with new document path
      await adminClient
        .from("extracted_rental_info")
        .update({
          document_storage_path: storagePath,
          original_filename: body.file_name,
          file_size_bytes: body.file_size,
          mime_type: body.file_type,
          extraction_status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingExtraction.id);

      extractionId = existingExtraction.id;
    } else {
      // Create new extraction record
      const { data: newExtraction, error: insertError } = await adminClient
        .from("extracted_rental_info")
        .insert({
          user_id: user.id,
          document_storage_path: storagePath,
          document_type: "lease_agreement",
          original_filename: body.file_name,
          file_size_bytes: body.file_size,
          mime_type: body.file_type,
          extraction_status: "pending",
        })
        .select("id")
        .single();

      if (insertError || !newExtraction) {
        console.error("[upload-document] DB insert failed:", JSON.stringify(insertError));
        console.error("[upload-document] Insert payload:", JSON.stringify({
          user_id: user.id,
          document_storage_path: storagePath,
          document_type: "lease_agreement",
          extraction_status: "pending",
        }));
        throw new ValidationError(
          `Failed to create document record: ${insertError?.message ?? "no data returned"}`,
          { database: insertError?.message || "Unknown error", code: insertError?.code || "unknown" }
        );
      }

      extractionId = newExtraction.id;
    }

    // ==============================================
    // LINK WAITLIST_ENTRIES TO THIS EXTRACTION
    // ==============================================
    // waitlist_entries row already exists (created by on_user_created_join_waitlist trigger).
    // Just update it to point to our new extraction — do NOT upsert/insert, because that
    // fires waitlist_entries_sync_trigger which creates a DUPLICATE extracted_rental_info row.

    await adminClient.from("waitlist_entries").update(
      {
        document_url: storagePath,
        extraction_status: "pending",
        contract_status: "uploading",
        extraction_id: extractionId,
      }
    ).eq("user_id", user.id);

    // ==============================================
    // GENERATE DOWNLOAD URL (for verification)
    // ==============================================

    const { data: downloadData } = await adminClient.storage
      .from("rent-agreements")
      .createSignedUrl(storagePath, 3600); // 1 hour expiry

    // ==============================================
    // AUDIT LOG
    // ==============================================

    await audit.logSuccess(
      AuditActions.DOCUMENT_UPLOADED,
      "extraction",
      "extracted_rental_info",
      extractionId,
      {
        file_name: body.file_name,
        file_type: body.file_type,
        file_size: body.file_size,
        storage_path: storagePath,
      }
    );

    // ==============================================
    // RETURN RESPONSE (V1 + V2 compatible)
    // ==============================================

    const response: UploadDocumentResponse = {
      success: true,
      upload_url: uploadData.signedUrl,
      waitlist_entry_id: extractionId, // V1 field name (maps to extraction ID)
      extracted_rental_info_id: extractionId, // V2 field name
      download_url: downloadData?.signedUrl,
      document_path: storagePath,
    };

    return jsonResponse(response, 200, headers);
  } catch (error) {
    return handleError(error);
  }
});
