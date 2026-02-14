/**
 * Flent Secured v2 - Join Waitlist Edge Function
 *
 * Idempotently creates a waitlist entry for the authenticated user.
 * If the user already has an entry, returns the existing one.
 *
 * Endpoint: POST /functions/v1/join-waitlist
 * Auth: Required (JWT)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     entry_id: string,
 *     position: number,
 *     is_new: boolean
 *   }
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient, createAuthenticatedClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, getCorsHeaders } from "../_shared/cors.ts";
import { handleError } from "../_shared/errors.ts";
import { AuditLogger } from "../_shared/audit.ts";

// ==============================================
// TYPES
// ==============================================

interface JoinWaitlistResult {
  entry_id: string;
  entry_position: number;
  is_new: boolean;
}

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const headers = getCorsHeaders(req);

  if (req.method !== "POST") {
    return jsonResponse(
      { error: true, message: "Method not allowed", code: "METHOD_NOT_ALLOWED" },
      405,
      headers
    );
  }

  const supabase = createServiceClient();
  let audit: AuditLogger | null = null;
  let userId: string | null = null;

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const { userId: uid } = await createAuthenticatedClient(authHeader);
    userId = uid;

    // Initialize audit logger
    audit = AuditLogger.fromRequest(supabase, req, userId, "join-waitlist");

    // Call the join_waitlist RPC (idempotent)
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc("join_waitlist", { p_user_id: userId })
      .single();

    if (rpcError) {
      console.error("[join-waitlist] RPC error:", rpcError);
      throw new Error("Failed to join waitlist");
    }

    const result = rpcResult as JoinWaitlistResult;

    // Log audit event
    if (result.is_new) {
      await audit.logSuccess(
        "WAITLIST_JOINED",
        "waitlist",
        "waitlist_entries",
        result.entry_id,
        { position: result.entry_position }
      );
    }

    return jsonResponse(
      {
        success: true,
        data: {
          entry_id: result.entry_id,
          position: result.entry_position,
          is_new: result.is_new,
        },
      },
      200,
      headers
    );
  } catch (error) {
    if (audit && userId) {
      await audit.logFailure(
        "WAITLIST_JOIN_FAILED",
        "waitlist",
        error instanceof Error ? error.message : "Unknown error",
        "Failed to join waitlist",
        "user",
        userId
      );
    }
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
