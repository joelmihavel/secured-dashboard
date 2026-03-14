/**
 * Notifications API Service
 *
 * Handles notification preferences CRUD.
 * Uses Supabase direct queries to notification_preferences table.
 */

import { supabase } from '../supabase/client';

// ==============================================
// TYPES
// ==============================================

export interface NotificationPreferences {
  payment_reminders: boolean;
  payment_confirmations: boolean;
  cashback_alerts: boolean;
  promotional: boolean;
  push_enabled: boolean;
  whatsapp_enabled: boolean;
}

// ==============================================
// TIMEOUT
// ==============================================

const QUERY_TIMEOUT_MS = 10_000;

/** Race a promise against a timeout -- used for direct Supabase client queries */
const withTimeout = <T>(promise: Promise<T>, ms: number = QUERY_TIMEOUT_MS): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Query timeout')), ms)
    ),
  ]);

// ==============================================
// ERROR MAPPING
// ==============================================

/**
 * Map raw Supabase errors to user-friendly messages.
 * Prevents DB internals from leaking to the UI.
 */
function mapNotificationError(errorMessage: string): string {
  const lower = errorMessage.toLowerCase();
  if (lower.includes('not authenticated') || lower.includes('unauthorized') || lower.includes('invalid jwt') || lower.includes('jwt expired')) {
    return 'Please sign in to continue';
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('timed out') || lower.includes('query timeout')) {
    return 'Please check your internet connection';
  }

  // Sanitize DB internals that shouldn't leak to UI
  if (/column\s+"?\w+"?\s+(?:does not exist|of relation)/i.test(errorMessage) ||
      /relation\s+"?\w+"?\s+does not exist/i.test(errorMessage) ||
      /\bSELECT\b.*\bFROM\b/i.test(errorMessage) ||
      /violates\s+(?:unique|check|foreign key)\s+constraint/i.test(errorMessage)) {
    return 'Something went wrong. Please try again.';
  }

  return errorMessage;
}

// ==============================================
// API FUNCTIONS
// ==============================================

/**
 * Fetch the current user's notification preferences.
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  // Use getSession() instead of getUser() to avoid triggering SDK refresh chain race
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');
  const user = session.user;

  const { data, error } = await withTimeout(
    supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()
      .then((r) => r) as Promise<{ data: NotificationPreferences | null; error: { message: string } | null }>
  );

  if (error) throw new Error(mapNotificationError(error.message));
  return data!;
}

/**
 * Update the current user's notification preferences.
 * Uses upsert to create on first call.
 */
export async function updateNotificationPreferences(
  prefs: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  // Use getSession() instead of getUser() to avoid triggering SDK refresh chain race
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');
  const user = session.user;

  const { data, error } = await withTimeout(
    supabase
      .from('notification_preferences')
      .upsert({ user_id: user.id, ...prefs }, { onConflict: 'user_id' })
      .select()
      .single()
      .then((r) => r) as Promise<{ data: NotificationPreferences | null; error: { message: string } | null }>
  );

  if (error) throw new Error(mapNotificationError(error.message));
  return data!;
}
