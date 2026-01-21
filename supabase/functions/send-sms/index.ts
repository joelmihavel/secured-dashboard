/**
 * Flent Secured v2 - Send SMS Edge Function
 *
 * Sends SMS messages via Twilio.
 * Used for critical alerts and fallback notifications.
 *
 * Endpoint: POST /functions/v1/send-sms
 * Auth: Service role only (internal use)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, verifyServiceRole } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { AppError, ValidationError, handleError } from "../_shared/errors.ts";
import { validateSchema, sanitizePhone, isValidIndianPhone } from "../_shared/validation.ts";
import { AuditLogger, AuditActions } from "../_shared/audit.ts";
import { sendSms } from "../_shared/notifications.ts";

// ==============================================
// TYPES
// ==============================================

interface SendSmsRequest {
  to: string;
  body: string;
  user_id?: string;
  notification_queue_id?: string;
}

// ==============================================
// VALIDATION SCHEMA
// ==============================================

const requestSchema = {
  to: { required: true, type: "string" as const, minLength: 10 },
  body: { required: true, type: "string" as const, minLength: 1, maxLength: 1600 },
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
    functionName: "send-sms",
    requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
  });

  try {
    // Verify service role authorization (strict equality check)
    const authHeader = req.headers.get("Authorization");
    verifyServiceRole(authHeader);

    // Parse and validate request
    const body = await req.json();
    const validatedBody = validateSchema<SendSmsRequest>(body, requestSchema, true);

    // Validate phone number
    const phoneNumber = sanitizePhone(validatedBody.to);
    if (!isValidIndianPhone(phoneNumber)) {
      throw new ValidationError("Invalid Indian phone number", { to: "Invalid format" });
    }

    // Send SMS
    const result = await sendSms({
      to: phoneNumber,
      body: validatedBody.body,
    });

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
        "sms",
        result.messageId,
        {
          to_masked: `XXXXXX${phoneNumber.slice(-4)}`,
          body_length: validatedBody.body.length,
          user_id: validatedBody.user_id,
        }
      );
    } else {
      await audit.logFailure(
        AuditActions.NOTIFICATION_FAILED,
        "notification",
        "TWILIO_ERROR",
        result.error ?? "Unknown error",
        "sms",
        undefined,
        {
          to_masked: `XXXXXX${phoneNumber.slice(-4)}`,
          user_id: validatedBody.user_id,
        }
      );
    }

    if (!result.success) {
      throw new AppError(result.error ?? "Failed to send SMS", "SEND_FAILED", 502);
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
