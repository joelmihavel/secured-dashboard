import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_WHATSAPP_NUMBER = Deno.env.get("TWILIO_WHATSAPP_NUMBER") ?? "NOT_SET";

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  const body = await req.json().catch(() => ({}));

  // Check specific message status
  if (body.message_sid) {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages/${body.message_sid}.json`,
      { headers: { Authorization: `Basic ${auth}` } }
    );
    const data = await res.json();
    return jsonResponse({
      sid: data.sid,
      status: data.status,
      error_code: data.error_code,
      error_message: data.error_message,
      from: data.from,
      to: data.to,
      date_sent: data.date_sent,
      direction: data.direction,
    });
  }

  // List recent messages
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json?PageSize=10`,
    { headers: { Authorization: `Basic ${auth}` } }
  );
  const data = await res.json();

  return jsonResponse({
    whatsapp_from_number: TWILIO_WHATSAPP_NUMBER,
    recent_messages: (data.messages ?? []).map((m: any) => ({
      sid: m.sid,
      from: m.from,
      to: m.to,
      status: m.status,
      error_code: m.error_code,
      error_message: m.error_message,
      date_sent: m.date_sent,
      body: m.body?.slice(0, 80),
    })),
  });
});
