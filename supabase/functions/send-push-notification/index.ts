/**
 * Flent Secured v2 - Send Push Notification Edge Function
 *
 * Sends push notifications via the Expo Push API.
 * Expo tokens (ExponentPushToken[xxx]) are routed automatically to APNs/FCM.
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

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_LIMIT = 100;

// ==============================================
// TYPES
// ==============================================

interface SendPushNotificationRequest {
  user_id?: string;
  expo_push_token?: string; // Single token override
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
  sound?: string;
  priority?: "high" | "normal" | "default";
}

interface SendPushNotificationResponse {
  success: boolean;
  data: {
    sent_count: number;
    failed_count: number;
    errors?: Array<{ token: string; error: string }>;
    message?: string;
  };
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string; // receipt id on success
  message?: string;
  details?: { error?: string };
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
  expo_push_token: {
    required: false,
    type: "string" as const,
    minLength: 10,
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
    enum: ["high", "normal", "default"],
  },
};

// ==============================================
// EXPO PUSH API
// ==============================================

/**
 * Sends push notifications via the Expo Push API.
 * Batches tokens into groups of EXPO_BATCH_LIMIT.
 */
async function sendExpoPush(
  tokens: string[],
  payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
    badge?: number;
    sound?: string;
    priority?: "high" | "normal" | "default";
  },
): Promise<{
  tickets: Array<{ token: string; ticket: ExpoPushTicket }>;
}> {
  const messages = tokens.map((token) => ({
    to: token,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    badge: payload.badge,
    sound: payload.sound ?? "default",
    priority: payload.priority ?? "high",
    channelId: "default",
  }));

  const allTickets: Array<{ token: string; ticket: ExpoPushTicket }> = [];

  // Batch into groups of EXPO_BATCH_LIMIT
  for (let i = 0; i < messages.length; i += EXPO_BATCH_LIMIT) {
    const batch = messages.slice(i, i + EXPO_BATCH_LIMIT);

    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new ExternalServiceError(
        "Expo Push",
        `HTTP ${response.status}: ${errorText}`,
      );
    }

    const result = await response.json();
    const tickets: ExpoPushTicket[] = result.data ?? [];

    // Pair each ticket with its token
    for (let j = 0; j < tickets.length; j++) {
      allTickets.push({
        token: batch[j].to,
        ticket: tickets[j],
      });
    }
  }

  return { tickets: allTickets };
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

    // Initialize audit logger
    audit = AuditLogger.fromRequest(
      supabase,
      req,
      undefined,
      "send-push-notification",
    );

    // Parse and validate request
    const body = await req.json();
    const validatedBody = validateSchema<SendPushNotificationRequest>(
      body,
      requestSchema,
      true,
    );

    const {
      user_id,
      expo_push_token,
      title,
      body: messageBody,
      data,
      badge,
      sound,
      priority = "high",
    } = validatedBody;

    // Must provide either user_id or expo_push_token
    if (!user_id && !expo_push_token) {
      throw new ValidationError(
        "Either user_id or expo_push_token is required",
      );
    }

    // Collect Expo Push Tokens
    let tokens: string[] = [];

    if (expo_push_token) {
      tokens = [expo_push_token];
    } else if (user_id) {
      // Get all active tokens for user via RPC
      const { data: userTokens, error } = await supabase.rpc(
        "get_user_device_tokens",
        { p_user_id: user_id },
      );

      if (error) {
        throw new Error(`Failed to get device tokens: ${error.message}`);
      }

      tokens = (userTokens || []).map(
        (t: { token: string }) => t.token,
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

    // Send via Expo Push API
    const { tickets } = await sendExpoPush(tokens, {
      title,
      body: messageBody,
      data,
      badge,
      sound,
      priority: priority as "high" | "normal" | "default",
    });

    // Process results
    const invalidTokens: string[] = [];
    const errors: Array<{ token: string; error: string }> = [];
    let sentCount = 0;
    let failedCount = 0;

    for (const { token, ticket } of tickets) {
      if (ticket.status === "ok") {
        sentCount++;
      } else {
        failedCount++;
        const errorType = ticket.details?.error;

        if (errorType === "DeviceNotRegistered") {
          invalidTokens.push(token);
        } else {
          errors.push({
            token: token.substring(0, 20) + "...",
            error: ticket.message ?? errorType ?? "Unknown error",
          });
        }
      }
    }

    // Deactivate invalid tokens
    if (invalidTokens.length > 0) {
      for (const token of invalidTokens) {
        await supabase.rpc("deactivate_device_token", { p_token: token });
      }
      console.log(`Deactivated ${invalidTokens.length} invalid tokens`);
    }

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
      },
    );

    // Build response
    const response: SendPushNotificationResponse = {
      success: true,
      data: {
        sent_count: sentCount,
        failed_count: failedCount,
        errors: errors.length > 0 ? errors : undefined,
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
        "push_notification",
      );
    }

    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
