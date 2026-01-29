/**
 * Flent Secured v2 - Send Push Notification Edge Function
 *
 * Sends push notifications via APNs (iOS) or FCM (Android/Web).
 * Can send to a specific user or specific device token.
 * Handles token invalidation and batch sending.
 *
 * Endpoint: POST /functions/v1/send-push-notification
 * Auth: Service Role only (internal use)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  createServiceClient,
  verifyServiceRole,
} from "../_shared/supabase.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import {
  ValidationError,
  ExternalServiceError,
  handleError,
} from "../_shared/errors.ts";
import { validateSchema, isValidUuid } from "../_shared/validation.ts";
import { AuditLogger } from "../_shared/audit.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const APNS_KEY_ID = Deno.env.get("APNS_KEY_ID");
const APNS_TEAM_ID = Deno.env.get("APNS_TEAM_ID");
const APNS_PRIVATE_KEY = Deno.env.get("APNS_PRIVATE_KEY"); // Base64 encoded
const APNS_BUNDLE_ID =
  Deno.env.get("APNS_BUNDLE_ID") ?? "com.flentsecured.app";

// APNs URLs
const APNS_PRODUCTION_URL = "https://api.push.apple.com";
const APNS_SANDBOX_URL = "https://api.sandbox.push.apple.com";

// JWT cache (APNs tokens valid for 1 hour)
let apnsJwtCache: { token: string; expires: number } | null = null;

// ==============================================
// TYPES
// ==============================================

interface SendPushNotificationRequest {
  user_id?: string; // Send to all devices of a user
  device_token?: string; // Or send to specific device
  platform?: "ios" | "android" | "web"; // Required if device_token is provided
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
  sound?: string;
  priority?: "high" | "normal";
  sandbox?: boolean; // Override sandbox detection
}

interface SendPushNotificationResponse {
  success: boolean;
  data: {
    sent_count: number;
    failed_count: number;
    apns_id?: string;
    errors?: Array<{ token: string; error: string }>;
    message?: string;
  };
}

interface DeviceToken {
  token: string;
  platform: string;
  sandbox: boolean;
}

// ==============================================
// VALIDATION SCHEMA
// ==============================================

const requestSchema = {
  user_id: {
    required: false,
    type: "string" as const,
    custom: (v: unknown) => {
      if (!v) return true;
      if (!isValidUuid(v)) return "Invalid user_id UUID";
      return true;
    },
  },
  device_token: {
    required: false,
    type: "string" as const,
    minLength: 32,
  },
  platform: {
    required: false,
    type: "string" as const,
    enum: ["ios", "android", "web"],
  },
  title: {
    required: true,
    type: "string" as const,
    maxLength: 200,
  },
  body: {
    required: true,
    type: "string" as const,
    maxLength: 1000,
  },
  data: {
    required: false,
    type: "object" as const,
  },
  badge: {
    required: false,
    type: "number" as const,
  },
  sound: {
    required: false,
    type: "string" as const,
  },
  priority: {
    required: false,
    type: "string" as const,
    enum: ["high", "normal"],
  },
  sandbox: {
    required: false,
    type: "boolean" as const,
  },
};

// ==============================================
// APNs JWT GENERATION
// ==============================================

async function getApnsJwt(): Promise<string> {
  // Return cached token if still valid (refresh 5 mins before expiry)
  if (apnsJwtCache && apnsJwtCache.expires > Date.now() + 5 * 60 * 1000) {
    return apnsJwtCache.token;
  }

  if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_PRIVATE_KEY) {
    throw new ExternalServiceError(
      "APNs",
      "APNs credentials not configured. Set APNS_KEY_ID, APNS_TEAM_ID, and APNS_PRIVATE_KEY environment variables."
    );
  }

  try {
    // Decode private key from base64
    const privateKeyPem = atob(APNS_PRIVATE_KEY);

    // Create JWT header and payload
    const header = { alg: "ES256", kid: APNS_KEY_ID };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: APNS_TEAM_ID,
      iat: now,
    };

    // Base64url encode header and payload
    const headerB64 = btoa(JSON.stringify(header))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
    const payloadB64 = btoa(JSON.stringify(payload))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    const message = `${headerB64}.${payloadB64}`;

    // Import private key and sign
    const keyData = pemToArrayBuffer(privateKeyPem);
    const key = await crypto.subtle.importKey(
      "pkcs8",
      keyData,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      new TextEncoder().encode(message)
    );

    // Convert signature to base64url (DER to raw conversion for ES256)
    const signatureBytes = new Uint8Array(signature);
    const signatureB64 = btoa(String.fromCharCode(...signatureBytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    const token = `${message}.${signatureB64}`;

    // Cache token (valid for ~1 hour, refresh at 55 minutes)
    apnsJwtCache = {
      token,
      expires: Date.now() + 55 * 60 * 1000,
    };

    return token;
  } catch (error) {
    console.error("Failed to generate APNs JWT:", error);
    throw new ExternalServiceError(
      "APNs",
      `Failed to generate authentication token: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/-----BEGIN EC PRIVATE KEY-----/, "")
    .replace(/-----END EC PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ==============================================
// SEND APNs NOTIFICATION
// ==============================================

async function sendApns(
  deviceToken: string,
  payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
    badge?: number;
    sound?: string;
  },
  sandbox: boolean,
  priority: "high" | "normal" = "high"
): Promise<{ success: boolean; apnsId?: string; error?: string }> {
  try {
    const jwt = await getApnsJwt();
    const url = sandbox ? APNS_SANDBOX_URL : APNS_PRODUCTION_URL;

    const apnsPayload = {
      aps: {
        alert: {
          title: payload.title,
          body: payload.body,
        },
        badge: payload.badge,
        sound: payload.sound ?? "default",
        "mutable-content": 1,
      },
      ...payload.data,
    };

    const response = await fetch(`${url}/3/device/${deviceToken}`, {
      method: "POST",
      headers: {
        authorization: `bearer ${jwt}`,
        "apns-topic": APNS_BUNDLE_ID,
        "apns-push-type": "alert",
        "apns-priority": priority === "high" ? "10" : "5",
        "apns-expiration": "0",
        "content-type": "application/json",
      },
      body: JSON.stringify(apnsPayload),
    });

    if (response.ok) {
      const apnsId = response.headers.get("apns-id");
      return { success: true, apnsId: apnsId ?? undefined };
    }

    const errorData = await response.json().catch(() => ({}));
    const reason = errorData.reason ?? `HTTP ${response.status}`;

    // Handle token invalidation
    if (
      response.status === 410 ||
      reason === "Unregistered" ||
      reason === "BadDeviceToken"
    ) {
      return { success: false, error: "INVALID_TOKEN" };
    }

    return { success: false, error: reason };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

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

  try {
    // Verify service role (internal API only)
    const authHeader = req.headers.get("Authorization");
    verifyServiceRole(authHeader);

    // Initialize audit logger (no user context for service role)
    audit = AuditLogger.fromRequest(
      supabase,
      req,
      undefined,
      "send-push-notification"
    );

    // Parse and validate request
    const body = await req.json();
    const validatedBody = validateSchema<SendPushNotificationRequest>(
      body,
      requestSchema,
      true
    );

    const {
      user_id,
      device_token,
      platform,
      title,
      body: messageBody,
      data,
      badge,
      sound,
      priority = "high",
      sandbox,
    } = validatedBody;

    // Must provide either user_id or device_token
    if (!user_id && !device_token) {
      throw new ValidationError("Either user_id or device_token is required");
    }

    // If device_token is provided, platform should also be provided
    if (device_token && !platform) {
      throw new ValidationError(
        "platform is required when device_token is provided"
      );
    }

    // Collect device tokens to send to
    let tokens: DeviceToken[] = [];

    if (device_token) {
      // Single device
      tokens = [
        {
          token: device_token,
          platform: platform ?? "ios",
          sandbox: sandbox ?? false,
        },
      ];
    } else if (user_id) {
      // Get all active tokens for user using the database function
      const { data: userTokens, error } = await supabase.rpc(
        "get_user_device_tokens",
        {
          p_user_id: user_id,
        }
      );

      if (error) {
        throw new Error(`Failed to get device tokens: ${error.message}`);
      }

      tokens = (userTokens || []).map(
        (t: { token: string; platform: string; sandbox: boolean }) => ({
          token: t.token,
          platform: t.platform,
          sandbox: sandbox !== undefined ? sandbox : t.sandbox,
        })
      );
    }

    if (tokens.length === 0) {
      const response: SendPushNotificationResponse = {
        success: true,
        data: {
          sent_count: 0,
          failed_count: 0,
          message: "No device tokens found for user",
        },
      };
      return jsonResponse(response);
    }

    // Send to each device
    const results: Array<{
      token: string;
      success: boolean;
      apnsId?: string;
      error?: string;
    }> = [];
    const invalidTokens: string[] = [];

    for (const deviceInfo of tokens) {
      if (deviceInfo.platform === "ios") {
        const result = await sendApns(
          deviceInfo.token,
          { title, body: messageBody, data, badge, sound },
          deviceInfo.sandbox,
          priority as "high" | "normal"
        );

        results.push({ token: deviceInfo.token, ...result });

        if (result.error === "INVALID_TOKEN") {
          invalidTokens.push(deviceInfo.token);
        }
      } else if (deviceInfo.platform === "android" || deviceInfo.platform === "web") {
        // FCM not implemented yet - log and skip
        console.warn(
          `FCM not implemented for platform: ${deviceInfo.platform}`
        );
        results.push({
          token: deviceInfo.token,
          success: false,
          error: "FCM_NOT_IMPLEMENTED",
        });
      }
    }

    // Deactivate invalid tokens
    if (invalidTokens.length > 0) {
      for (const token of invalidTokens) {
        await supabase.rpc("deactivate_device_token", { p_token: token });
      }
      console.log(`Deactivated ${invalidTokens.length} invalid tokens`);
    }

    const sentCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    // Log audit
    await audit.logSuccess(
      "PUSH_NOTIFICATION_SENT",
      "notification",
      "push_notification",
      undefined,
      {
        user_id: user_id ?? undefined,
        sent_count: sentCount,
        failed_count: failedCount,
        invalid_tokens_deactivated: invalidTokens.length,
      }
    );

    // Build response
    const response: SendPushNotificationResponse = {
      success: true,
      data: {
        sent_count: sentCount,
        failed_count: failedCount,
        apns_id: results.find((r) => r.apnsId)?.apnsId,
        errors: results
          .filter((r) => !r.success && r.error !== "INVALID_TOKEN")
          .map((r) => ({
            token: r.token.substring(0, 10) + "...",
            error: r.error!,
          })),
      },
    };

    return jsonResponse(response);
  } catch (error) {
    // Log failure
    if (audit) {
      await audit.logFailure(
        "PUSH_NOTIFICATION_FAILED",
        "notification",
        error instanceof ValidationError
          ? "VALIDATION_ERROR"
          : error instanceof ExternalServiceError
            ? "EXTERNAL_SERVICE_ERROR"
            : "SEND_FAILED",
        error instanceof Error ? error.message : "Unknown error",
        "push_notification"
      );
    }

    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
