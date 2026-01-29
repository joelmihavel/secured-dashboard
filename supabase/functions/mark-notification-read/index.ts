/**
 * Flent Secured v2 - Mark Notification Read Edge Function
 *
 * Marks notifications as read (specific IDs or all).
 * Returns updated unread count for badge updates.
 *
 * Endpoint: POST /functions/v1/mark-notification-read
 * Auth: Required (JWT)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  createServiceClient,
  createAuthenticatedClient,
} from "../_shared/supabase.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { ValidationError, handleError } from "../_shared/errors.ts";
import { validateSchema, isValidUuid } from "../_shared/validation.ts";

// ==============================================
// TYPES
// ==============================================

interface MarkNotificationReadRequest {
  notification_ids?: string[]; // Specific IDs, or null/undefined for all
}

interface MarkNotificationReadResponse {
  success: boolean;
  data: {
    marked_count: number;
    unread_remaining: number;
  };
}

// ==============================================
// VALIDATION SCHEMA
// ==============================================

const requestSchema = {
  notification_ids: {
    required: false,
    type: "array" as const,
    custom: (v: unknown) => {
      if (v === null || v === undefined) return true;
      if (!Array.isArray(v)) return "notification_ids must be an array";
      if (v.length === 0) return true; // Empty array means mark all
      if (v.length > 100) return "Cannot mark more than 100 notifications at once";
      for (const id of v) {
        if (!isValidUuid(id)) return `Invalid UUID: ${id}`;
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

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const { userId } = await createAuthenticatedClient(authHeader);

    // Parse and validate request
    let body: MarkNotificationReadRequest = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is valid - means mark all notifications
      body = {};
    }

    const { notification_ids } = validateSchema<MarkNotificationReadRequest>(
      body,
      requestSchema,
      true
    );

    // Determine whether to mark specific IDs or all
    // Empty array or undefined means mark all
    const markAll =
      notification_ids === undefined ||
      notification_ids === null ||
      notification_ids.length === 0;

    // Use database function to mark as read
    const { data: markedCount, error: markError } = await supabase.rpc(
      "mark_notifications_read",
      {
        p_user_id: userId,
        p_notification_ids: markAll ? null : notification_ids,
      }
    );

    if (markError) {
      throw new Error(`Failed to mark notifications: ${markError.message}`);
    }

    // Get remaining unread count for badge update
    const { data: unreadCount, error: countError } = await supabase.rpc(
      "get_unread_notification_count",
      {
        p_user_id: userId,
      }
    );

    if (countError) {
      console.error("Failed to get unread count:", countError);
      // Don't fail the request - just return 0
    }

    // Build response
    const response: MarkNotificationReadResponse = {
      success: true,
      data: {
        marked_count: markedCount ?? 0,
        unread_remaining: unreadCount ?? 0,
      },
    };

    return jsonResponse(response);
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
