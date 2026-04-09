/**
 * Notification service for the extraction pipeline.
 * Calls the Supabase `notify-user` edge function via HTTP POST.
 *
 * Ported from: supabase/functions/_shared/notifications.ts (notifyUser, scheduleNotification)
 *
 * Changes from Deno version:
 * - Uses `process.env` instead of `Deno.env.get()`
 * - Uses Node.js native fetch
 * - Simplified: only exposes scheduleNotification (the pipeline's entry point)
 */

/**
 * Schedule a notification for a user.
 * For immediate notifications, calls notify-user directly.
 * The notify-user edge function handles template resolution, preference checking,
 * in-app creation, push delivery, and WhatsApp.
 *
 * @param userId - User ID to notify
 * @param notificationType - Notification type key (e.g., "agreement_upload_failed")
 * @param templateVars - Optional template variable substitutions
 */
export async function scheduleNotification(
  userId: string,
  notificationType: string,
  templateVars?: Record<string, string>
): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.SB_URL;
  const serviceKey = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.warn('[notifications] Supabase URL or service key not configured, skipping notification');
    return;
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/notify-user`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          notification_type: notificationType,
          template_vars: templateVars,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[notifications] notify-user returned ${response.status}: ${errorText.substring(0, 200)}`);
    } else {
      console.log(`[notifications] Notification sent: ${notificationType} for user ${userId}`);
    }
  } catch (err) {
    // Non-blocking: notification failure should never fail the extraction
    console.warn(
      '[notifications] Failed to send notification:',
      err instanceof Error ? err.message : String(err)
    );
  }
}
