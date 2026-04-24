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
 * Options for scheduleNotification.
 */
interface ScheduleNotificationOptions {
  /**
   * Entity this notification is about (e.g., 'extraction'). Used for dedup.
   */
  relatedEntityType?: string;
  /**
   * Entity ID (e.g., an extraction_id). Used for dedup.
   */
  relatedEntityId?: string;
  /**
   * If true, skip sending when a notification of the same type/entity was
   * sent to this user within the last `dedupWindowHours` hours.
   * Default: true when relatedEntityId is provided, false otherwise.
   */
  dedup?: boolean;
  /**
   * Dedup lookback window, default 24 hours.
   */
  dedupWindowHours?: number;
}

/**
 * Schedule a notification for a user.
 * For immediate notifications, calls notify-user directly.
 * The notify-user edge function handles template resolution, preference checking,
 * in-app creation, push delivery, and WhatsApp.
 *
 * @param userId - User ID to notify
 * @param notificationType - Notification type key (e.g., "agreement_upload_failed")
 * @param templateVars - Optional template variable substitutions
 * @param options - Related entity and dedup controls
 */
export async function scheduleNotification(
  userId: string,
  notificationType: string,
  templateVars?: Record<string, string>,
  options?: ScheduleNotificationOptions
): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.SB_URL;
  const serviceKey = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.warn('[notifications] Supabase URL or service key not configured, skipping notification');
    return;
  }

  const dedupEnabled = options?.dedup ?? !!options?.relatedEntityId;
  const dedupWindowHours = options?.dedupWindowHours ?? 24;

  // Dedup: check whether a notification with matching user + type +
  // related_entity_id was already sent within the window.
  // This prevents spam when the pipeline re-runs (e.g. extraction-recovery
  // retriggers Cloud Run for the same extraction).
  if (dedupEnabled && options?.relatedEntityId) {
    try {
      const since = new Date(Date.now() - dedupWindowHours * 3600_000).toISOString();
      const q = new URLSearchParams({
        select: 'id',
        user_id: `eq.${userId}`,
        related_entity_id: `eq.${options.relatedEntityId}`,
        created_at: `gte.${since}`,
      });
      if (options.relatedEntityType) {
        q.append('related_entity_type', `eq.${options.relatedEntityType}`);
      }
      const checkRes = await fetch(
        `${supabaseUrl}/rest/v1/notifications?${q.toString()}&limit=1`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
        }
      );
      if (checkRes.ok) {
        const rows = (await checkRes.json()) as Array<unknown>;
        if (Array.isArray(rows) && rows.length > 0) {
          console.log(`[notifications] Dedup hit: ${notificationType} for user ${userId} entity ${options.relatedEntityId} — skipping`);
          return;
        }
      }
    } catch (err) {
      // Dedup check is best-effort; fall through to send on error.
      console.warn('[notifications] Dedup check failed (sending anyway):', err instanceof Error ? err.message : String(err));
    }
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
          related_entity_type: options?.relatedEntityType,
          related_entity_id: options?.relatedEntityId,
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
