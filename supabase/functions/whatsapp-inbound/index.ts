/**
 * Flent Secured v2 — WhatsApp Inbound Webhook
 *
 * Receives Twilio's inbound webhook on the Flent Homes WABA
 * (whatsapp:+919980021293). Twilio POSTs every message a contact sends —
 * including quick-reply button taps from approved templates.
 *
 * Phase 2 trigger: when a landlord taps "Tell me more" on the Phase 1 invite
 * template, Twilio delivers the inbound here with Body="Tell me more". That
 * tap opens a 24-hour customer-service window, during which we fire the
 * Phase 2 interactive Content Template (founder pitch + video + URL button).
 *
 * Auth: Twilio HMAC-SHA1 signature in X-Twilio-Signature. No bypass.
 * Endpoint: POST /functions/v1/whatsapp-inbound
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { handleCors } from "../_shared/cors.ts";
import { AuditLogger, AuditActions } from "../_shared/audit.ts";
import { sendLandlordPhase2 } from "../_shared/phase2-sender.ts";

const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
// Twilio signs the webhook URL exactly as it called. Supabase's gateway
// routes via a CDN that may rewrite the URL by the time `req.url` is
// observed in Deno, so we override with the URL Twilio is actually using
// (configured on the WhatsApp Sender's webhook callback_url).
const TWILIO_WEBHOOK_PUBLIC_URL =
  Deno.env.get("TWILIO_WEBHOOK_PUBLIC_URL") ??
  "https://api-secured.flent.in/functions/v1/whatsapp-inbound";

/**
 * Twilio signature verification.
 *
 * Algorithm: base64(HMAC-SHA1(authToken, url + sortedParamsConcatenated))
 *   where sortedParamsConcatenated = params sorted by key, joined as
 *   key1 + value1 + key2 + value2 + ...
 *
 * The URL must match exactly what Twilio called (incl. query string if any).
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
async function verifyTwilioSignature(
  url: string,
  params: URLSearchParams,
  signatureHeader: string,
  authToken: string,
): Promise<boolean> {
  // Sort keys alphabetically, concat key+value
  const sortedKeys = [...params.keys()].sort();
  let concat = url;
  for (const k of sortedKeys) {
    // For repeated keys Twilio concatenates each occurrence in iteration order;
    // getAll preserves order from the parsed body.
    for (const v of params.getAll(k)) {
      concat += k + v;
    }
  }

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(concat));

  // Base64-encode the HMAC bytes
  const bytes = new Uint8Array(sig);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const expected = btoa(binary);

  // Constant-time-ish compare
  if (expected.length !== signatureHeader.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }
  return diff === 0;
}

/** Strip "whatsapp:" prefix from a Twilio sender/recipient address. */
function stripWhatsAppPrefix(addr: string): string {
  return addr.startsWith("whatsapp:") ? addr.slice("whatsapp:".length) : addr;
}

/**
 * Looks up the most recent tenancy whose landlord matches `phoneE164`.
 * Country-agnostic: delegates to the `find_tenancy_by_landlord_e164` RPC
 * which matches on the exact concatenation of `country_code || landlord_phone`.
 * Works for any of our supported country codes (+91, +1, +44, +971, +61,
 * +65, +60, +49, +33, +966, +974, +968, +977, +94) and any future country
 * code added to validation without code change here.
 *
 * Returns null if no tenancy is found.
 */
// deno-lint-ignore no-explicit-any
async function findTenancyByLandlordPhone(supabase: any, phoneE164: string) {
  const normalized = phoneE164.startsWith("+") ? phoneE164 : `+${phoneE164}`;
  const { data, error } = await supabase.rpc("find_tenancy_by_landlord_e164", {
    p_phone_e164: normalized,
  });
  if (error) {
    console.error("[whatsapp-inbound] tenancy lookup RPC failed:", error);
    return null;
  }
  if (!data || (Array.isArray(data) && data.length === 0)) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row as
    | {
        id: string;
        user_id: string;
        landlord_phone: string | null;
        country_code: string | null;
        landlord_invite_sent_at: string | null;
      }
    | null;
}

/** True if we've already audit-logged a phase-2 send for this MessageSid. */
// deno-lint-ignore no-explicit-any
async function alreadyProcessed(supabase: any, messageSid: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id")
    .eq("entity_id", messageSid)
    .in("action", [
      AuditActions.LANDLORD_PHASE2_SENT,
      AuditActions.LANDLORD_PHASE2_FAILED,
      AuditActions.WHATSAPP_INBOUND_RECEIVED,
      AuditActions.WHATSAPP_INBOUND_UNMATCHED,
    ])
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[whatsapp-inbound] dedupe lookup failed:", error);
    return false; // fail-open — better to dedupe-miss than to drop a real reply
  }
  return !!data;
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    // Twilio always POSTs. Return 405 for everything else without leaking detail.
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!TWILIO_AUTH_TOKEN) {
    console.error("[whatsapp-inbound] TWILIO_AUTH_TOKEN not set — refusing");
    return new Response("Server Misconfigured", { status: 500 });
  }

  // 1. Read raw body, parse as form-urlencoded
  const rawBody = await req.text();
  const params = new URLSearchParams(rawBody);

  // 2. Verify Twilio signature
  const signatureHeader = req.headers.get("x-twilio-signature");
  if (!signatureHeader) {
    console.warn("[whatsapp-inbound] missing X-Twilio-Signature");
    return new Response("Forbidden", { status: 403 });
  }

  // Try the configured public URL first (matches what Twilio signed); fall
  // back to req.url for local/dev where the public URL env may not match.
  let ok = await verifyTwilioSignature(
    TWILIO_WEBHOOK_PUBLIC_URL,
    params,
    signatureHeader,
    TWILIO_AUTH_TOKEN,
  );
  if (!ok) {
    ok = await verifyTwilioSignature(
      req.url,
      params,
      signatureHeader,
      TWILIO_AUTH_TOKEN,
    );
  }
  if (!ok) {
    console.warn("[whatsapp-inbound] signature verification failed", {
      tried_public_url: TWILIO_WEBHOOK_PUBLIC_URL,
      tried_req_url: req.url,
    });
    return new Response("Forbidden", { status: 403 });
  }

  // 3. Extract fields
  const fromRaw = params.get("From") ?? "";
  const toRaw = params.get("To") ?? "";
  const body = (params.get("Body") ?? "").trim();
  const messageSid = params.get("MessageSid") ?? "";
  const buttonPayload = params.get("ButtonPayload") ?? "";
  const buttonText = params.get("ButtonText") ?? "";

  const fromPhone = stripWhatsAppPrefix(fromRaw); // E.164 e.g. "+919978899383"

  console.log("[whatsapp-inbound] received", {
    message_sid: messageSid,
    from: fromPhone,
    to: stripWhatsAppPrefix(toRaw),
    body_preview: body.slice(0, 80),
    button_payload: buttonPayload || null,
    button_text: buttonText || null,
  });

  // Always 200 to Twilio — failure modes below are logged, not surfaced as
  // non-2xx (which would trigger Twilio retries and cause duplicate sends).
  // Use empty TwiML body so Twilio doesn't echo any text as an auto-reply
  // to the recipient.
  const ack = () => new Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });

  if (!messageSid) {
    console.warn("[whatsapp-inbound] missing MessageSid — acking without action");
    return ack();
  }

  const supabase = createServiceClient();
  const audit = new AuditLogger(supabase, {
    actorType: "system",
    functionName: "whatsapp-inbound",
    requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
  });

  // 4. Idempotency: if we've already processed this MessageSid, ack and bail.
  if (await alreadyProcessed(supabase, messageSid)) {
    console.log("[whatsapp-inbound] duplicate MessageSid — already processed", {
      message_sid: messageSid,
    });
    return ack();
  }

  // 5. Tenancy lookup
  const tenancy = await findTenancyByLandlordPhone(supabase, fromPhone);

  if (!tenancy) {
    console.log("[whatsapp-inbound] no tenancy match for sender", {
      from: fromPhone,
      message_sid: messageSid,
    });
    const auditPromise = audit.log({
      action: AuditActions.WHATSAPP_INBOUND_UNMATCHED,
      category: "notification",
      entityType: "whatsapp_message",
      entityId: messageSid,
      details: {
        from_phone: fromPhone,
        body_preview: body.slice(0, 200),
        button_payload: buttonPayload || null,
      },
      status: "success",
    });
    // @ts-ignore EdgeRuntime is a Supabase runtime global
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(auditPromise);
    } else {
      await auditPromise;
    }
    return ack();
  }

  // 6. Intent detection
  const isPhase2Trigger =
    body.toLowerCase() === "tell me more" ||
    buttonPayload === "tell_me_more";

  if (!isPhase2Trigger) {
    console.log("[whatsapp-inbound] free-form reply — logging only", {
      tenancy_id: tenancy.id,
      message_sid: messageSid,
    });
    const auditPromise = audit.log({
      action: AuditActions.WHATSAPP_INBOUND_RECEIVED,
      category: "notification",
      entityType: "whatsapp_message",
      entityId: messageSid,
      details: {
        tenancy_id: tenancy.id,
        from_phone: fromPhone,
        body_preview: body.slice(0, 200),
        button_payload: buttonPayload || null,
        intent: "free_form",
      },
      status: "success",
    });
    // @ts-ignore EdgeRuntime is a Supabase runtime global
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(auditPromise);
    } else {
      await auditPromise;
    }
    return ack();
  }

  // 7. Phase 2 trigger: fetch tenant name and fire the Phase 2 send.
  const { data: tenantUser } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", tenancy.user_id)
    .single();

  const tenantName =
    (tenantUser as { full_name?: string } | null)?.full_name ?? "Your tenant";

  const sendResult = await sendLandlordPhase2(supabase, {
    tenancyId: tenancy.id,
    landlordPhoneE164: fromPhone,
    tenantName,
  });

  if (sendResult.success) {
    console.log("[whatsapp-inbound] phase 2 sent", {
      tenancy_id: tenancy.id,
      message_sid: messageSid,
      phase2_message_id: sendResult.messageId,
    });
    const auditPromise = audit.log({
      action: AuditActions.LANDLORD_PHASE2_SENT,
      category: "landlord",
      entityType: "whatsapp_message",
      entityId: messageSid,
      details: {
        tenancy_id: tenancy.id,
        from_phone: fromPhone,
        phase2_message_id: sendResult.messageId,
        trigger: buttonPayload === "tell_me_more" ? "button_payload" : "body_match",
      },
      status: "success",
    });
    // @ts-ignore EdgeRuntime is a Supabase runtime global
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(auditPromise);
    } else {
      await auditPromise;
    }
    return ack();
  }

  console.error("[whatsapp-inbound] phase 2 send failed", {
    tenancy_id: tenancy.id,
    message_sid: messageSid,
    error: sendResult.error,
  });
  const failPromise = audit.log({
    action: AuditActions.LANDLORD_PHASE2_FAILED,
    category: "landlord",
    entityType: "whatsapp_message",
    entityId: messageSid,
    details: {
      tenancy_id: tenancy.id,
      from_phone: fromPhone,
    },
    status: "failure",
    errorCode: sendResult.error ?? "phase2_send_failed",
    errorMessage: sendResult.error ?? "Unknown error",
  });
  // @ts-ignore EdgeRuntime is a Supabase runtime global
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(failPromise);
  } else {
    await failPromise;
  }
  return ack();
});
