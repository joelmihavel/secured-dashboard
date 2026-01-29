/**
 * Flent Secured v2 - Register Device Token Edge Function
 *
 * Registers or updates a push notification token (APNs/FCM).
 * Handles token refresh by updating existing tokens.
 *
 * Endpoint: POST /functions/v1/register-device-token
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
// TYPES
// ==============================================

interface RegisterDeviceTokenRequest {
  token: string;
  platform: "ios" | "android" | "web";
  device_id?: string;
  device_name?: string;
  bundle_id?: string;
  sandbox?: boolean;
}

interface RegisterDeviceTokenResponse {
  success: boolean;
  data: {
    token_id: string;
    registered_at: string;
    is_new: boolean;
  };
}

// ==============================================
// VALIDATION SCHEMA
// ==============================================

const requestSchema = {
  token: {
    required: true,
    type: "string" as const,
    minLength: 32,
    maxLength: 500,
  },
  platform: {
    required: true,
    type: "string" as const,
    enum: ["ios", "android", "web"],
  },
  device_id: {
    required: false,
    type: "string" as const,
    maxLength: 200,
  },
  device_name: {
    required: false,
    type: "string" as const,
    maxLength: 100,
  },
  bundle_id: {
    required: false,
    type: "string" as const,
    maxLength: 200,
  },
  sandbox: {
    required: false,
    type: "boolean" as const,
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
    audit = AuditLogger.fromRequest(supabase, req, userId, "register-device-token");

    // Parse and validate request
    const body = await req.json();
    const validatedBody = validateSchema<RegisterDeviceTokenRequest>(
      body,
      requestSchema,
      true
    );

    const {
      token,
      platform,
      device_id,
      device_name,
      bundle_id,
      sandbox = false,
    } = validatedBody;

    // Check if this is a new token or an update
    const { data: existingToken } = await supabase
      .from("device_tokens")
      .select("id, user_id")
      .eq("token", token)
      .eq("platform", platform)
      .maybeSingle();

    const isNewToken = !existingToken;

    // Use the database function for upsert (handles token refresh scenario)
    const { data: tokenId, error } = await supabase.rpc("register_device_token", {
      p_user_id: userId,
      p_token: token,
      p_platform: platform,
      p_device_id: device_id || null,
      p_device_name: device_name || null,
      p_bundle_id: bundle_id || null,
      p_sandbox: sandbox,
    });

    if (error) {
      throw new Error(`Failed to register device token: ${error.message}`);
    }

    // Log audit
    await audit.logSuccess(
      isNewToken ? "DEVICE_TOKEN_REGISTERED" : "DEVICE_TOKEN_UPDATED",
      "notification",
      "device_token",
      tokenId,
      {
        platform,
        sandbox,
        is_new: isNewToken,
        token_prefix: token.substring(0, 10) + "...",
      }
    );

    // Build response
    const response: RegisterDeviceTokenResponse = {
      success: true,
      data: {
        token_id: tokenId,
        registered_at: new Date().toISOString(),
        is_new: isNewToken,
      },
    };

    return jsonResponse(response);
  } catch (error) {
    // Log failure
    if (audit && userId) {
      await audit.logFailure(
        "DEVICE_TOKEN_REGISTRATION_FAILED",
        "notification",
        error instanceof ValidationError
          ? "VALIDATION_ERROR"
          : "REGISTRATION_FAILED",
        error instanceof Error ? error.message : "Unknown error",
        "device_token"
      );
    }

    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
