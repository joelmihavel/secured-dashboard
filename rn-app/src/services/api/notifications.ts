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
// API FUNCTIONS
// ==============================================

/**
 * Fetch the current user's notification preferences.
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update the current user's notification preferences.
 * Uses upsert to create on first call.
 */
export async function updateNotificationPreferences(
  prefs: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert({ user_id: user.id, ...prefs }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}
