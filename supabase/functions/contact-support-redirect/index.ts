/**
 * Flent Secured v2 — Contact Support Redirect
 *
 * Public 302 redirect to a wa.me support handoff URL. Used as the destination
 * for the "Contact us" button on the landlord Phase 2 WhatsApp message —
 * Meta blocks `wa.me/...` directly inside template URL buttons, so we route
 * through this stable Supabase edge function instead.
 *
 * Endpoint: GET /functions/v1/contact-support-redirect
 * Auth: None (public)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, errorResponse } from "../_shared/cors.ts";

const SUPPORT_TARGET_URL =
  "https://wa.me/919741327879?text=Hi%2C%20I%20have%20a%20question%20about%20Flent%20Secured";

serve((req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: SUPPORT_TARGET_URL,
      // Don't let intermediaries cache forever — keeps this swap-able.
      "Cache-Control": "no-store",
    },
  });
});
