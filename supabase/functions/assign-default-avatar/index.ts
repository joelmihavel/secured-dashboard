/**
 * Assign Default Avatar Edge Function
 *
 * Assigns a random pre-tinted Pokemon pixel art avatar to a user.
 * Idempotent: if user already has an avatar, returns existing.
 *
 * Endpoint: POST /functions/v1/assign-default-avatar
 * Auth: Required (JWT)
 *
 * Response: { success, data: { avatarUrl, wasAssigned } }
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  createServiceClient,
  createAuthenticatedClient,
} from "../_shared/supabase.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { handleError } from "../_shared/errors.ts";
import { getDefaultAvatarUrl } from "../_shared/avatar-utils.ts";

const NUM_DEFAULT_AVATARS = 30;

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return jsonResponse({ error: true, message: "Method not allowed" }, 405);
  }

  try {
    // Authenticate
    const authHeader = req.headers.get("Authorization");
    const { userId } = await createAuthenticatedClient(authHeader);
    const supabase = createServiceClient();

    // Check if user already has an avatar
    const { data: user, error: fetchError } = await supabase
      .from("users")
      .select("avatar_url")
      .eq("id", userId)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    // Idempotent: return existing avatar if already set
    if (user?.avatar_url) {
      return jsonResponse({
        success: true,
        data: {
          avatarUrl: user.avatar_url,
          wasAssigned: false,
        },
      });
    }

    // Pick a random default avatar (1-30)
    const avatarNumber = Math.floor(Math.random() * NUM_DEFAULT_AVATARS) + 1;
    const avatarUrl = getDefaultAvatarUrl(supabase, avatarNumber);

    // Update user profile with the default avatar
    const { error: updateError } = await supabase
      .from("users")
      .update({ avatar_url: avatarUrl })
      .eq("id", userId);

    if (updateError) {
      throw updateError;
    }

    return jsonResponse({
      success: true,
      data: {
        avatarUrl,
        wasAssigned: true,
      },
    });
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
