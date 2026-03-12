/**
 * Admin Encrypt — encrypts a value using the shared ENCRYPTION_KEY.
 * Service-role only. One-off utility.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyServiceRole } from "../_shared/supabase.ts";
import { handleCors, errorResponse } from "../_shared/cors.ts";
import { encrypt } from "../_shared/crypto.ts";

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    verifyServiceRole(req.headers.get("Authorization"));
  } catch {
    return errorResponse("Unauthorized", 401);
  }

  const { value } = await req.json();
  if (!value) return errorResponse("Missing value", 400);

  const encrypted = await encrypt(value);
  return new Response(JSON.stringify({ encrypted }), {
    headers: { "Content-Type": "application/json" },
  });
});
