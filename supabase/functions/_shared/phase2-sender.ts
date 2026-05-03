/**
 * Flent Secured v2 — Landlord Phase 2 Sender
 *
 * Helper used by the inbound WhatsApp webhook to fire the Phase 2 founder
 * pitch + 60s video + "Contact us" URL button to a landlord who tapped the
 * Phase 1 "Tell me more" quick-reply.
 *
 * The 24h customer-service window is opened by the inbound user reply that
 * triggered this call, so an interactive Content Template is allowed.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { sendWhatsApp } from "./notifications.ts";

export interface SendLandlordPhase2Args {
  tenancyId: string;
  landlordPhoneE164: string; // e.g. "+919978899383"
  tenantName: string;
}

export interface SendLandlordPhase2Result {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendLandlordPhase2(
  _supabase: SupabaseClient,
  args: SendLandlordPhase2Args,
): Promise<SendLandlordPhase2Result> {
  const phase2Sid = Deno.env.get("TWILIO_LANDLORD_PHASE2_CONTENT_SID");
  if (!phase2Sid) {
    console.error(
      "[phase2-sender] TWILIO_LANDLORD_PHASE2_CONTENT_SID not set",
      { tenancy_id: args.tenancyId },
    );
    return { success: false, error: "phase2_sid_missing" };
  }

  // sendWhatsApp builds ContentSid + ContentVariables ({"1": tenantName})
  // and routes through the master kill-switch and Twilio API key auth.
  const result = await sendWhatsApp({
    to: args.landlordPhoneE164,
    template: phase2Sid,
    templateParams: [args.tenantName],
  });

  return {
    success: result.success,
    messageId: result.messageId,
    error: result.error,
  };
}
