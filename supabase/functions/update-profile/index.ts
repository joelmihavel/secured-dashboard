/**
 * Flent Secured v2 - Update Profile Edge Function
 *
 * Updates user profile information (name, email).
 * Includes full audit logging of changes.
 *
 * Endpoint: POST /functions/v1/update-profile
 * Auth: Required (JWT)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  createServiceClient,
  createAuthenticatedClient,
} from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { ValidationError, handleError } from "../_shared/errors.ts";
import { validateSchema, isValidEmail } from "../_shared/validation.ts";
import { AuditLogger } from "../_shared/audit.ts";

// ==============================================
// TYPES
// ==============================================

interface UpdateProfileRequest {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

interface UpdateProfileResponse {
  success: boolean;
  data: {
    user_id: string;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    avatar_url: string | null;
    updated_at: string;
  };
}

// ==============================================
// VALIDATION SCHEMA
// ==============================================

const requestSchema = {
  full_name: {
    required: false,
    type: "string" as const,
    minLength: 2,
    maxLength: 100,
  },
  first_name: {
    required: false,
    type: "string" as const,
    minLength: 1,
    maxLength: 50,
  },
  last_name: {
    required: false,
    type: "string" as const,
    minLength: 1,
    maxLength: 50,
  },
  email: {
    required: false,
    type: "string" as const,
    custom: (v: unknown) => {
      if (!v) return true;
      if (typeof v !== "string") return "Email must be a string";
      if (!isValidEmail(v)) return "Invalid email format";
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
    return errorResponse("Method not allowed", 405, "METHOD_NOT_ALLOWED");
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
    audit = AuditLogger.fromRequest(supabase, req, userId, "update-profile");

    // Parse and validate request
    const body = await req.json();
    const validatedBody = validateSchema<UpdateProfileRequest>(
      body,
      requestSchema,
      true
    );

    // Build update fields
    const updateFields: Record<string, unknown> = {};

    if (validatedBody.full_name !== undefined) {
      updateFields.full_name = validatedBody.full_name.trim();
      // Also split into first/last name if not provided separately
      if (!validatedBody.first_name && !validatedBody.last_name) {
        const parts = validatedBody.full_name.trim().split(/\s+/);
        updateFields.first_name = parts[0];
        updateFields.last_name = parts.slice(1).join(" ") || null;
      }
    }

    if (validatedBody.first_name !== undefined) {
      updateFields.first_name = validatedBody.first_name.trim();
    }

    if (validatedBody.last_name !== undefined) {
      updateFields.last_name = validatedBody.last_name.trim();
    }

    if (validatedBody.email !== undefined) {
      updateFields.email = validatedBody.email.toLowerCase().trim();
    }

    // Ensure at least one field is being updated
    if (Object.keys(updateFields).length === 0) {
      throw new ValidationError("At least one field must be provided for update");
    }

    // Get current profile for audit comparison
    const { data: currentProfile, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch current profile: ${fetchError.message}`);
    }

    // Update profile
    const { data: updatedProfile, error: updateError } = await supabase
      .from("users")
      .update(updateFields)
      .eq("id", userId)
      .select(
        "id, full_name, first_name, last_name, email, avatar_url, updated_at"
      )
      .single();

    if (updateError) {
      throw new Error(`Failed to update profile: ${updateError.message}`);
    }

    // Log audit with old and new values
    await audit.log({
      action: "PROFILE_UPDATED",
      category: "profile",
      entityType: "user",
      entityId: userId,
      oldValues: {
        full_name: currentProfile.full_name,
        first_name: currentProfile.first_name,
        last_name: currentProfile.last_name,
        email: currentProfile.email,
        avatar_url: currentProfile.avatar_url,
      },
      newValues: updateFields,
      status: "success",
    });

    // Build response
    const response: UpdateProfileResponse = {
      success: true,
      data: {
        user_id: updatedProfile.id,
        full_name: updatedProfile.full_name,
        first_name: updatedProfile.first_name,
        last_name: updatedProfile.last_name,
        email: updatedProfile.email,
        avatar_url: updatedProfile.avatar_url,
        updated_at: updatedProfile.updated_at,
      },
    };

    return jsonResponse(response);
  } catch (error) {
    // Log failure
    if (audit && userId) {
      await audit.logFailure(
        "PROFILE_UPDATE_FAILED",
        "profile",
        error instanceof ValidationError ? "VALIDATION_ERROR" : "UPDATE_FAILED",
        error instanceof Error ? error.message : "Unknown error",
        "user",
        userId
      );
    }

    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
