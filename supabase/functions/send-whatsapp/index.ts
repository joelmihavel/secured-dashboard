/**
 * Flent Secured v2 - Send WhatsApp Edge Function
 *
 * Sends WhatsApp messages via Twilio.
 * Can be called directly or processes queued notifications.
 *
 * Endpoint: POST /functions/v1/send-whatsapp
 * Auth: Service role only (internal use)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, verifyServiceRole } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { AppError, ValidationError, handleError } from "../_shared/errors.ts";
import { validateSchema, sanitizePhone, isValidIndianPhone } from "../_shared/validation.ts";
import { AuditLogger, AuditActions } from "../_shared/audit.ts";
import { sendWhatsApp, WhatsAppMessage } from "../_shared/notifications.ts";

// ==============================================
// TYPES
// ==============================================

interface SendWhatsAppRequest {
  to: string;
  body?: string;
  template?: string;
  template_params?: string[];
  user_id?: string;
  notification_queue_id?: string;
}

// ==============================================
// VALIDATION SCHEMA
// ==============================================

const requestSchema = {
  to: { required: true, type: "string" as const, minLength: 10 },
  body: { required: false, type: "string" as const, maxLength: 1600 },
  template: { required: false, type: "string" as const },
  template_params: { required: false, type: "array" as const },
  user_id: { required: false, type: "string" as const },
  notification_queue_id: { required: false, type: "string" as const },
};

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const supabase = createServiceClient();
  const audit = new AuditLogger(supabase, {
    actorType: "system",
    functionName: "send-whatsapp",
    requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
  });

  try {
    // Verify service role authorization (strict equality check)
    const authHeader = req.headers.get("Authorization");
    verifyServiceRole(authHeader);

    // Parse and validate request
    const body = await req.json();
    const validatedBody = validateSchema<SendWhatsAppRequest>(body, requestSchema, true);

    // Validate phone number
    const phoneNumber = sanitizePhone(validatedBody.to);
    if (!isValidIndianPhone(phoneNumber)) {
      throw new ValidationError("Invalid Indian phone number", { to: "Invalid format" });
    }

    // Validate either body or template is provided
    if (!validatedBody.body && !validatedBody.template) {
      throw new ValidationError("Either body or template is required");
    }

    // Build message
    const message: WhatsAppMessage = {
      to: phoneNumber,
      body: validatedBody.body,
      template: validatedBody.template,
      templateParams: validatedBody.template_params,
    };

    // Send WhatsApp message
    const result = await sendWhatsApp(message);

    // Update notification queue if ID provided
    if (validatedBody.notification_queue_id) {
      await supabase
        .from("notification_queue")
        .update({
          status: result.success ? "sent" : "failed",
          sent_at: result.success ? new Date().toISOString() : null,
          error_message: result.error,
          external_id: result.messageId,
        })
        .eq("id", validatedBody.notification_queue_id);
    }

    // Log audit
    if (result.success) {
      await audit.logSuccess(
        AuditActions.NOTIFICATION_SENT,
        "notification",
        "whatsapp",
        result.messageId,
        {
          to_masked: `XXXXXX${phoneNumber.slice(-4)}`,
          has_template: !!validatedBody.template,
          user_id: validatedBody.user_id,
        }
      );
    } else {
      await audit.logFailure(
        AuditActions.NOTIFICATION_FAILED,
        "notification",
        "TWILIO_ERROR",
        result.error ?? "Unknown error",
        "whatsapp",
        undefined,
        {
          to_masked: `XXXXXX${phoneNumber.slice(-4)}`,
          user_id: validatedBody.user_id,
        }
      );
    }

    if (!result.success) {
      throw new AppError(result.error ?? "Failed to send WhatsApp message", "SEND_FAILED", 502);
    }

    return jsonResponse({
      success: true,
      data: {
        message_id: result.messageId,
        to_masked: `XXXXXX${phoneNumber.slice(-4)}`,
      },
    });
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
