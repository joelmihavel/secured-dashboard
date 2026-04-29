/**
 * Flent Secured v2 - Notify User Edge Function
 *
 * High-level notification orchestrator. Other edge functions call this to:
 * 1. Check user notification preferences
 * 2. Resolve template → title/body
 * 3. Create in-app notification record
 * 4. Send push notification via Expo Push API
 *
 * Endpoint: POST /functions/v1/notify-user
 * Auth: Service Role only (internal use)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  createServiceClient,
  verifyServiceRole,
  getSupabaseUrl,
} from "../_shared/supabase.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import {
  ValidationError,
  handleError,
} from "../_shared/errors.ts";
import { validateSchema, isValidUuid } from "../_shared/validation.ts";
import { AuditLogger } from "../_shared/audit.ts";
import {
  NOTIFICATION_TEMPLATES,
  NOTIFICATION_ROUTES,
  PREFERENCE_MAP,
  DB_TYPE_MAP,
  interpolateTemplate,
  WHATSAPP_TEMPLATE_MAP,
  type NotificationType,
} from "../_shared/notification-templates.ts";
import { sendWhatsAppForUser } from "../_shared/notifications.ts";
import {
  reserveWhatsAppSlot,
  releaseWhatsAppSlot,
  logSendOutcome,
} from "../_shared/notification-policy.ts";
import { isWhatsAppSendEnabled } from "../_shared/feature-flags.ts";

// ==============================================
// TYPES
// ==============================================

interface NotifyUserRequest {
  user_id: string;
  notification_type: NotificationType;
  template_vars?: Record<string, string>;
  data?: Record<string, string>;
  priority?: "high" | "normal" | "default";
  related_entity_type?: string;
  related_entity_id?: string;
}

interface NotifyUserResponse {
  success: boolean;
  data: {
    notification_id: string | null;
    in_app_created: boolean;
    push_sent_count: number;
    push_failed_count: number;
    wa_sent: boolean;
  };
}

// ==============================================
// VALIDATION SCHEMA
// ==============================================

const VALID_NOTIFICATION_TYPES = Object.keys(NOTIFICATION_TEMPLATES);

const requestSchema = {
  user_id: {
    required: true,
    type: "string" as const,
    custom: (v: unknown) => {
      if (!isValidUuid(v)) return "Invalid user_id UUID";
      return true;
    },
  },
  notification_type: {
    required: true,
    type: "string" as const,
    enum: VALID_NOTIFICATION_TYPES,
  },
  template_vars: {
    required: false,
    type: "object" as const,
  },
  data: {
    required: false,
    type: "object" as const,
  },
  priority: {
    required: false,
    type: "string" as const,
    enum: ["high", "normal", "default"],
  },
  related_entity_type: {
    required: false,
    type: "string" as const,
    maxLength: 100,
  },
  related_entity_id: {
    required: false,
    type: "string" as const,
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

  try {
    // Verify service role (internal API only)
    const authHeader = req.headers.get("Authorization");
    verifyServiceRole(authHeader);

    audit = AuditLogger.fromRequest(
      supabase,
      req,
      undefined,
      "notify-user",
    );

    // Parse and validate request
    const body = await req.json();
    const validatedBody = validateSchema<NotifyUserRequest>(
      body,
      requestSchema,
      true,
    );

    const {
      user_id,
      notification_type,
      template_vars = {},
      data: extraData = {},
      priority = "high",
      related_entity_type,
      related_entity_id,
    } = validatedBody;

    // ------------------------------------------
    // 1. Check push preferences (WA prefs are handled inside reserveWhatsAppSlot)
    // ------------------------------------------
    const prefColumn = PREFERENCE_MAP[notification_type];
    let pushAllowed = true;

    if (prefColumn) {
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select(`push_enabled, ${prefColumn}`)
        .eq("user_id", user_id)
        .single();

      if (prefs) {
        // deno-lint-ignore no-explicit-any
        if ((prefs as any).push_enabled === false) {
          pushAllowed = false;
        // deno-lint-ignore no-explicit-any
        } else if ((prefs as any)[prefColumn] === false) {
          pushAllowed = false;
        }
      }
      // If no prefs row → fail-open
    } else {
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("push_enabled")
        .eq("user_id", user_id)
        .single();
      // deno-lint-ignore no-explicit-any
      if (prefs && (prefs as any).push_enabled === false) {
        pushAllowed = false;
      }
    }

    // ------------------------------------------
    // 2. Resolve template
    // ------------------------------------------
    const template = NOTIFICATION_TEMPLATES[notification_type];
    if (!template) {
      throw new ValidationError(
        `Unknown notification_type: ${notification_type}`,
      );
    }

    const title = interpolateTemplate(template.title, template_vars);
    const bodyText = interpolateTemplate(template.body, template_vars);
    const route = NOTIFICATION_ROUTES[notification_type];
    const dbType = DB_TYPE_MAP[notification_type];

    // ------------------------------------------
    // 3. Create in-app notification record
    // ------------------------------------------
    let notificationId: string | null = null;
    let inAppCreated = false;

    const { data: notifResult, error: notifError } = await supabase.rpc(
      "create_notification",
      {
        p_user_id: user_id,
        p_notification_type: dbType,
        p_title: title,
        p_body: bodyText,
        p_action_type: "navigate",
        p_action_data: { route },
        p_related_entity_type: related_entity_type ?? null,
        p_related_entity_id: related_entity_id ?? null,
      },
    );

    if (notifError) {
      console.error("Failed to create in-app notification:", notifError.message);
    } else {
      notificationId = notifResult;
      inAppCreated = true;
    }

    // ------------------------------------------
    // 4. Send push + WhatsApp in parallel
    // ------------------------------------------
    let pushSentCount = 0;
    let pushFailedCount = 0;
    let waSent = false;

    // Build promises for parallel execution
    const channelPromises: Promise<{ channel: string; result: unknown }>[] = [];

    // Push notification promise
    if (pushAllowed) {
      const pushPromise = (async () => {
        let badgeCount = 1;
        const { data: countResult } = await supabase.rpc(
          "get_unread_notification_count",
          { p_user_id: user_id },
        );
        if (typeof countResult === "number") {
          badgeCount = countResult;
        }

        const pushData: Record<string, string> = {
          ...extraData,
          notification_type,
          route,
        };
        if (notificationId) pushData.notification_id = notificationId;
        if (related_entity_type) pushData.related_entity_type = related_entity_type;
        if (related_entity_id) pushData.related_entity_id = related_entity_id;

        const supabaseUrl = getSupabaseUrl();
        const serviceKey = (Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;

        const pushResponse = await fetch(
          `${supabaseUrl}/functions/v1/send-push-notification`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              user_id, title, body: bodyText,
              data: pushData, badge: badgeCount,
              sound: "default", priority,
            }),
          },
        );

        if (pushResponse.ok) {
          const pushResult = await pushResponse.json();
          return { sent: pushResult.data?.sent_count ?? 0, failed: pushResult.data?.failed_count ?? 0 };
        } else {
          const errorText = await pushResponse.text().catch(() => "Unknown");
          console.error("Push notification call failed:", errorText);
          return { sent: 0, failed: 1 };
        }
      })();
      channelPromises.push(pushPromise.then((r) => ({ channel: "push", result: r })));
    }

    // WhatsApp — race-safe slot reservation, then send, then release.
    if (WHATSAPP_TEMPLATE_MAP[notification_type]) {
      const waPromise = (async () => {
        // Short-circuit before reserving a slot: when the master kill is on,
        // the slot would just be reserved and immediately released as
        // 'failed', polluting the send log. The cached flag check is cheap.
        if (!(await isWhatsAppSendEnabled())) {
          return { success: false, error: "wa_kill_switch" };
        }
        const reservation = await reserveWhatsAppSlot(
          supabase,
          user_id,
          notification_type,
          { source: "notify-user" },
        );
        if (!reservation.allowed) {
          await logSendOutcome(supabase, {
            user_id,
            notification_type,
            outcome: "skipped",
            skip_reason: reservation.reason,
            context: { source: "notify-user" },
          });
          return { success: false, error: `policy_skip:${reservation.reason}` };
        }
        const result = await sendWhatsAppForUser(
          supabase, user_id, notification_type, template_vars,
        ).catch((e: Error) => {
          console.error("[notify-user] WhatsApp error:", e);
          return { success: false, error: e.message };
        });
        const sendResult = result as { success: boolean; error?: string; messageId?: string };
        await releaseWhatsAppSlot(
          supabase,
          reservation.slotId,
          sendResult.success ? "sent" : "failed",
          sendResult.messageId,
          sendResult.success ? undefined : sendResult.error,
        );
        return result;
      })();
      channelPromises.push(waPromise.then((r) => ({ channel: "wa", result: r })));
    }

    // Execute all channels in parallel
    const settled = await Promise.allSettled(channelPromises);

    for (const outcome of settled) {
      if (outcome.status !== "fulfilled") continue;
      const { channel, result } = outcome.value;
      if (channel === "push") {
        const pushRes = result as { sent: number; failed: number };
        pushSentCount = pushRes.sent;
        pushFailedCount = pushRes.failed;
      } else if (channel === "wa") {
        const waRes = result as { success: boolean; error?: string };
        waSent = waRes.success;
        if (!waRes.success) {
          console.warn(`[notify-user] WhatsApp failed for ${user_id}: ${waRes.error}`);
        }
      }
    }

    // ------------------------------------------
    // 5. Audit log + response
    // ------------------------------------------
    await audit.logSuccess(
      "USER_NOTIFIED",
      "notification",
      "notification",
      notificationId ?? undefined,
      {
        user_id,
        notification_type,
        in_app_created: inAppCreated,
        push_allowed: pushAllowed,
        push_sent_count: pushSentCount,
        push_failed_count: pushFailedCount,
        wa_sent: waSent,
      },
    );

    const response: NotifyUserResponse = {
      success: true,
      data: {
        notification_id: notificationId,
        in_app_created: inAppCreated,
        push_sent_count: pushSentCount,
        push_failed_count: pushFailedCount,
        wa_sent: waSent,
      },
    };

    return jsonResponse(response);
  } catch (error) {
    if (audit) {
      await audit.logFailure(
        "USER_NOTIFICATION_FAILED",
        "notification",
        error instanceof ValidationError
          ? "VALIDATION_ERROR"
          : "NOTIFY_FAILED",
        error instanceof Error ? error.message : "Unknown error",
        "notification",
      );
    }

    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
