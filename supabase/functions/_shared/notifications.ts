/**
 * Flent Secured v2 - Notifications Helper
 *
 * Unified interface for sending notifications via:
 * - Email (Resend)
 * - Twilio (WhatsApp, SMS)
 * - Expo Push API (Push notifications)
 */

import { ExternalServiceError } from "./errors.ts";

// ==============================================
// CONFIGURATION
// ==============================================

// Email (Resend)
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM_ADDRESS = Deno.env.get("EMAIL_FROM_ADDRESS") ?? "Flent Secured <noreply@flentsecured.com>";

// Twilio
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_API_KEY_SID = Deno.env.get("TWILIO_API_KEY_SID");
const TWILIO_API_KEY_SECRET = Deno.env.get("TWILIO_API_KEY_SECRET");
const TWILIO_WHATSAPP_NUMBER = Deno.env.get("TWILIO_WHATSAPP_NUMBER") ?? "whatsapp:+14155238886";
const TWILIO_SMS_NUMBER = Deno.env.get("TWILIO_SMS_NUMBER");

// ==============================================
// TYPES
// ==============================================

export interface EmailMessage {
  to: string | string[]; // Email address(es)
  subject: string;
  html?: string; // HTML body
  text?: string; // Plain text body (fallback)
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}

export interface WhatsAppMessage {
  to: string; // Phone number with country code
  template?: string; // WhatsApp template name
  templateParams?: string[]; // Template parameters
  body?: string; // For non-template messages (sandbox only)
}

export interface SmsMessage {
  to: string;
  body: string;
}

export interface PushNotification {
  deviceToken: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
  sound?: string;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ==============================================
// EMAIL (RESEND)
// ==============================================

/**
 * Sends an email via Resend.
 */
export async function sendEmail(message: EmailMessage): Promise<NotificationResult> {
  if (!RESEND_API_KEY) {
    console.warn("Resend API key not configured");
    return { success: false, error: "Email service not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM_ADDRESS,
        to: Array.isArray(message.to) ? message.to : [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        reply_to: message.replyTo,
        cc: message.cc,
        bcc: message.bcc,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Resend API error:", data);
      return {
        success: false,
        error: data.message ?? `HTTP ${response.status}`,
      };
    }

    return { success: true, messageId: data.id };
  } catch (error) {
    console.error("Resend request failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ==============================================
// TWILIO BASE
// ==============================================

async function twilioRequest(
  endpoint: string,
  body: Record<string, string>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || (!TWILIO_AUTH_TOKEN && !TWILIO_API_KEY_SECRET)) {
    console.warn("Twilio credentials not configured");
    return { success: false, error: "Twilio not configured" };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}${endpoint}`;
  // Prefer API Key auth if available, fall back to Account SID + Auth Token
  const authUser = TWILIO_API_KEY_SID || TWILIO_ACCOUNT_SID;
  const authPass = TWILIO_API_KEY_SECRET || TWILIO_AUTH_TOKEN;
  const auth = btoa(`${authUser}:${authPass}`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Twilio API error:", data);
      return {
        success: false,
        error: data.message ?? `HTTP ${response.status}`,
      };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Twilio request failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ==============================================
// WHATSAPP
// ==============================================

/**
 * Sends a WhatsApp message via Twilio.
 */
export async function sendWhatsApp(
  message: WhatsAppMessage
): Promise<NotificationResult> {
  // Format phone number for WhatsApp (supports any E.164 number)
  let to: string;
  if (message.to.startsWith("whatsapp:")) {
    to = message.to;
  } else if (message.to.startsWith("+")) {
    to = `whatsapp:${message.to}`;
  } else {
    // Legacy fallback: bare digits, assume Indian
    to = `whatsapp:+91${message.to.replace(/^91/, "")}`;
  }

  const body: Record<string, string> = {
    From: TWILIO_WHATSAPP_NUMBER,
    To: to,
  };

  // Use template or direct body
  if (message.template) {
    // Content SID for approved templates
    body.ContentSid = message.template;
    if (message.templateParams) {
      body.ContentVariables = JSON.stringify(
        Object.fromEntries(message.templateParams.map((p, i) => [`${i + 1}`, p]))
      );
    }
  } else if (message.body) {
    body.Body = message.body;
  } else {
    return { success: false, error: "Either template or body is required" };
  }

  const result = await twilioRequest("/Messages.json", body);

  if (result.success && result.data) {
    const data = result.data as { sid: string };
    return { success: true, messageId: data.sid };
  }

  return { success: false, error: result.error };
}

// ==============================================
// WHATSAPP FOR USER (HIGH-LEVEL HELPER)
// ==============================================

/**
 * Sends a WhatsApp notification to a user using their stored phone number
 * and the appropriate Twilio Content Template for the notification type.
 *
 * Returns gracefully if:
 * - WA notifications are globally disabled (WA_NOTIFICATIONS_ENABLED=false)
 * - No WhatsApp template exists for this notification type
 * - The ContentSid env var is not set (template not yet approved)
 * - User has no phone number
 */
export async function sendWhatsAppForUser(
  supabase: { from: (table: string) => any },
  userId: string,
  notificationType: NotificationType,
  templateVars: Record<string, string> = {},
): Promise<NotificationResult> {
  // Global kill-switch
  if (Deno.env.get("WA_NOTIFICATIONS_ENABLED") === "false") {
    return { success: false, error: "WA notifications disabled" };
  }

  const waConfig = WHATSAPP_TEMPLATE_MAP[notificationType];
  if (!waConfig) {
    return { success: false, error: `No WA template for ${notificationType}` };
  }

  // Resolve ContentSid from env var
  const contentSid = Deno.env.get(waConfig.contentSidEnvVar);
  if (!contentSid) {
    console.warn(`[WA] Missing env var: ${waConfig.contentSidEnvVar}`);
    return { success: false, error: "Missing template SID env var" };
  }

  // Fetch user phone
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("phone")
    .eq("id", userId)
    .single();

  if (userError || !user?.phone) {
    return { success: false, error: "User has no phone number" };
  }

  // Explicit phone normalization
  const normalizedPhone = formatPhoneWithCountryCode(sanitizePhone(user.phone));

  // Map template variables in order, warn on missing keys
  const templateParams = waConfig.variableKeys.map((k) => {
    const val = templateVars[k];
    if (!val) {
      console.warn(`[WA] Missing variable '${k}' for ${notificationType}`);
    }
    return val ?? "";
  });

  return sendWhatsApp({
    to: normalizedPhone,
    template: contentSid,
    templateParams: templateParams.length > 0 ? templateParams : undefined,
  });
}

// ==============================================
// NOTIFICATION SCHEDULER
// ==============================================

/**
 * Schedules a notification for delayed sending via the notification_schedule table.
 * Inserts both a first send and optional reminder based on NOTIFICATION_TIMING config.
 *
 * For immediate notifications (triggerDelaySec=0), calls notifyUser directly
 * and only schedules the reminder if configured.
 *
 * Cancels any existing pending notifications of the same type for the same user
 * (prevents duplicates if events fire multiple times).
 */
export async function scheduleNotification(
  supabase: { from: (table: string) => any; },
  supabaseUrl: string,
  serviceKey: string,
  params: {
    user_id: string;
    notification_type: NotificationType;
    template_vars?: Record<string, string>;
    related_entity_type?: string;
    related_entity_id?: string;
  },
): Promise<void> {
  const timing = NOTIFICATION_TIMING[params.notification_type];
  if (!timing) {
    // No timing config — send immediately (legacy behavior)
    await notifyUser(supabaseUrl, serviceKey, params).catch((e) =>
      console.warn(`[schedule] Direct send failed for ${params.notification_type}:`, e)
    );
    return;
  }

  const now = new Date();

  // Cancel any existing pending notifications for this user + type
  await supabase
    .from("notification_schedule")
    .update({ status: "cancelled", skip_reason: "superseded" })
    .eq("user_id", params.user_id)
    .eq("notification_type", params.notification_type)
    .eq("status", "pending")
    .catch(() => {});

  if (timing.triggerDelaySec === 0) {
    // Immediate: send now
    await notifyUser(supabaseUrl, serviceKey, params).catch((e) =>
      console.warn(`[schedule] Immediate send failed for ${params.notification_type}:`, e)
    );

    // Schedule reminder if configured
    if (timing.reminderDelaySec) {
      const reminderAt = new Date(now.getTime() + timing.reminderDelaySec * 1000);
      await supabase.from("notification_schedule").insert({
        user_id: params.user_id,
        notification_type: params.notification_type,
        send_type: "reminder",
        scheduled_for: reminderAt.toISOString(),
        template_vars: params.template_vars ?? {},
        related_entity_type: params.related_entity_type,
        related_entity_id: params.related_entity_id,
      }).catch((e: Error) => console.warn("[schedule] Failed to insert reminder:", e));
    }
  } else {
    // Delayed: schedule both first send and reminder
    const firstAt = new Date(now.getTime() + timing.triggerDelaySec * 1000);
    const rows: any[] = [
      {
        user_id: params.user_id,
        notification_type: params.notification_type,
        send_type: "first",
        scheduled_for: firstAt.toISOString(),
        template_vars: params.template_vars ?? {},
        related_entity_type: params.related_entity_type,
        related_entity_id: params.related_entity_id,
      },
    ];

    if (timing.reminderDelaySec) {
      const reminderAt = new Date(now.getTime() + timing.reminderDelaySec * 1000);
      rows.push({
        user_id: params.user_id,
        notification_type: params.notification_type,
        send_type: "reminder",
        scheduled_for: reminderAt.toISOString(),
        template_vars: params.template_vars ?? {},
        related_entity_type: params.related_entity_type,
        related_entity_id: params.related_entity_id,
      });
    }

    await supabase.from("notification_schedule").insert(rows)
      .catch((e: Error) => console.warn("[schedule] Failed to insert schedule:", e));
  }
}

// ==============================================
// SMS
// ==============================================

/**
 * Sends an SMS via Twilio.
 */
export async function sendSms(message: SmsMessage): Promise<NotificationResult> {
  if (!TWILIO_SMS_NUMBER) {
    return { success: false, error: "SMS number not configured" };
  }

  // Format phone number
  const to = message.to.startsWith("+")
    ? message.to
    : `+91${message.to.replace(/^91/, "")}`;

  const body: Record<string, string> = {
    From: TWILIO_SMS_NUMBER,
    To: to,
    Body: message.body,
  };

  const result = await twilioRequest("/Messages.json", body);

  if (result.success && result.data) {
    const data = result.data as { sid: string };
    return { success: true, messageId: data.sid };
  }

  return { success: false, error: result.error };
}

// ==============================================
// PUSH NOTIFICATIONS (Expo Push API)
// ==============================================

// Note: Push is handled by the send-push-notification Edge Function (Expo Push API).
// This is a convenience wrapper that calls that function.

/**
 * Sends a push notification via the Expo Push API.
 */
export async function sendPushNotification(
  notification: PushNotification,
  supabaseUrl: string,
  serviceKey: string,
): Promise<NotificationResult> {
  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/send-push-notification`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expo_push_token: notification.deviceToken,
          title: notification.title,
          body: notification.body,
          data: notification.data,
          badge: notification.badge,
          sound: notification.sound ?? "default",
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    const data = await response.json();
    const sentCount = data.data?.sent_count ?? 0;
    return {
      success: sentCount > 0,
      messageId: sentCount > 0 ? `sent:${sentCount}` : undefined,
      error: sentCount === 0 ? "No tokens delivered" : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ==============================================
// NOTIFY USER (HIGH-LEVEL ORCHESTRATOR)
// ==============================================

import {
  WHATSAPP_TEMPLATE_MAP,
  NOTIFICATION_TIMING,
  type NotificationType,
} from "./notification-templates.ts";
import { sanitizePhone, formatPhoneWithCountryCode } from "./validation.ts";

/**
 * Convenience wrapper that calls the notify-user edge function.
 * Handles template resolution, preference checking, in-app creation, and push delivery.
 */
export async function notifyUser(
  supabaseUrl: string,
  serviceKey: string,
  params: {
    user_id: string;
    notification_type: NotificationType;
    template_vars?: Record<string, string>;
    data?: Record<string, string>;
    priority?: "high" | "normal" | "default";
    related_entity_type?: string;
    related_entity_id?: string;
  },
): Promise<{
  success: boolean;
  notification_id?: string | null;
  in_app_created?: boolean;
  push_sent_count?: number;
  push_failed_count?: number;
  error?: string;
}> {
  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/notify-user`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    const result = await response.json();
    return {
      success: true,
      notification_id: result.data?.notification_id,
      in_app_created: result.data?.in_app_created,
      push_sent_count: result.data?.push_sent_count,
      push_failed_count: result.data?.push_failed_count,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ==============================================
// MESSAGE TEMPLATES
// ==============================================

export const MessageTemplates = {
  // Payment reminders
  paymentReminder: (name: string, amount: string, dueDate: string) =>
    `Hi ${name}, your rent of ${amount} is due on ${dueDate}. Pay now to earn 1% cashback!`,

  paymentSuccess: (name: string, amount: string, cashback: string) =>
    `Hi ${name}, your rent payment of ${amount} was successful. You earned ${cashback} cashback!`,

  paymentFailed: (name: string) =>
    `Hi ${name}, your rent payment failed. Please try again or use a different payment method.`,

  // Landlord notifications
  landlordInvite: (tenantName: string, propertyAddress: string) =>
    `Hi! ${tenantName} has added you as their landlord for ${propertyAddress}. Please verify the details.`,

  landlordPaymentReceived: (amount: string, tenantName: string) =>
    `You've received ${amount} rent from ${tenantName}. The amount will be credited to your bank account.`,

  // Verification
  bankVerified: (name: string) =>
    `Hi ${name}, your landlord's bank account has been verified successfully. You can now make rent payments.`,

  // Cashback
  cashbackExpiring: (name: string, amount: string, days: number) =>
    `Hi ${name}, your ${amount} cashback expires in ${days} days. Use it on your next rent payment!`,
} as const;

// ==============================================
// NOTIFICATION QUEUE HELPER
// ==============================================

/**
 * Queues a notification for async delivery.
 * Uses the notification_queue table for reliable delivery.
 */
export async function queueNotification(
  supabase: { from: (table: string) => unknown },
  notification: {
    userId: string;
    type: "whatsapp" | "sms" | "push";
    payload: unknown;
    scheduledFor?: Date;
  }
): Promise<void> {
  // @ts-ignore - Supabase client typing
  await supabase.from("notification_queue").insert({
    user_id: notification.userId,
    notification_type: notification.type,
    payload: notification.payload,
    scheduled_for: notification.scheduledFor?.toISOString() ?? new Date().toISOString(),
    status: "pending",
  });
}

/**
 * Send notification with queue fallback.
 * Tries notifyUser first; on failure, queues for async retry.
 */
export async function notifyUserWithFallback(
  supabaseUrl: string,
  serviceKey: string,
  supabase: { from: (table: string) => unknown },
  params: {
    user_id: string;
    notification_type: NotificationType;
    template_vars?: Record<string, string>;
    data?: Record<string, string>;
    priority?: "high" | "normal" | "default";
    related_entity_type?: string;
    related_entity_id?: string;
  },
): Promise<void> {
  const result = await notifyUser(supabaseUrl, serviceKey, params);
  if (!result.success) {
    console.warn(
      `[notify] Direct notification failed for ${params.user_id} (${params.notification_type}): ${result.error}. Queueing for retry.`,
    );
    try {
      await queueNotification(supabase, {
        userId: params.user_id,
        type: "push",
        payload: {
          notification_type: params.notification_type,
          template_vars: params.template_vars,
          data: params.data,
          related_entity_type: params.related_entity_type,
          related_entity_id: params.related_entity_id,
          original_error: result.error,
        },
      });
    } catch (queueErr) {
      console.error(
        `[notify] Queue fallback also failed for ${params.user_id}:`,
        queueErr,
      );
    }
  }
}
