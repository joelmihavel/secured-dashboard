/**
 * Admin Encrypt — encrypts a value using the shared ENCRYPTION_KEY.
 * Admin-only. One-off utility.
 *
 * Auth: admin_key in request body (Supabase relay strips Authorization header
 * for opaque keys, so body-based auth is the only reliable method).
 *
 * Endpoint: POST /functions/v1/admin-encrypt
 * Body: { admin_key: string, value: string }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, errorResponse } from "../_shared/cors.ts";
import { encrypt } from "../_shared/crypto.ts";

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const expectedKey = Deno.env.get("ADMIN_API_KEY");
  if (!body.admin_key || !expectedKey || body.admin_key !== expectedKey) {
    return errorResponse("Unauthorized - invalid admin key", 401);
  }

  const value = body.value as string;
  if (!value) return errorResponse("Missing value", 400);

  const encrypted = await encrypt(value);
  return new Response(JSON.stringify({ encrypted }), {
    headers: { "Content-Type": "application/json" },
  });
});
