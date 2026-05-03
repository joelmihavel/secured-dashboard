/**
 * Flent Secured v2 - Notification Templates (Server-Side)
 *
 * Server-side copy of notification templates with deep link routing,
 * preference mapping, and DB type mapping.
 *
 * Keep in sync with: rn-app/src/constants/notificationTemplates.ts
 */

// ==============================================
// TYPES
// ==============================================

export type NotificationType =
  | "waitlist_approved"
  | "waitlist_rejected"
  | "rent_due"
  | "payment_success"
  | "payment_failed"
  | "settlement_complete"
  | "settlement_failed"
  | "rent_due_tomorrow"
  | "rent_overdue"
  | "landlord_confirmed"
  | "landlord_verified"
  | "landlord_verification_failed"
  | "landlord_rejected"
  | "app_update"
  | "reminder_utility"
  | "reminder_landlord_invite"
  | "reminder_agreement"
  | "onboarding_dropoff"
  | "agreement_upload_failed"
  | "under_review"
  | "setup_incomplete"
  | "landlord_pending"
  | "payment_processing"
  | "payment_refunded"
  | "milestone_streak";

interface NotificationTemplate {
  title: string;
  body: string;
}

// ==============================================
// TEMPLATES
// ==============================================

export const NOTIFICATION_TEMPLATES: Record<
  NotificationType,
  NotificationTemplate
> = {
  waitlist_approved: {
    title: "You're in, {name}.",
    body: "Welcome to the right side of renting. Tap to get started.",
  },
  waitlist_rejected: {
    title: "We couldn't approve your application",
    body: "Sorry, your current rental contract doesn't qualify our eligibility criteria.",
  },
  payment_success: {
    title: "Rent paid, {name}",
    body: "₹{amount} received. You saved ₹{cashback} with Flent.",
  },
  payment_failed: {
    title: "Payment didn't go through",
    body: "Your rent payment of ₹{amount} couldn't be processed. Tap to retry.",
  },
  rent_due: {
    title: "Rent's coming up",
    body: "₹{amount} due on {date}. Pay early, earn cashback.",
  },
  settlement_complete: {
    title: "Your landlord got paid",
    body: "₹{amount} settled to your landlord's account. UTR: {utr}.",
  },
  settlement_failed: {
    title: "Landlord payout didn't go through",
    body: "₹{amount} has been reversed to your account. We're looking into it.",
  },
  rent_due_tomorrow: {
    title: "Tomorrow's the last day",
    body: "Pay ₹{amount} before it's overdue. Takes under a minute.",
  },
  rent_overdue: {
    title: "Gentle reminder",
    body: "Don't miss your payment. ₹{amount} was due on {date}.",
  },
  landlord_confirmed: {
    title: "Landlord confirmed your tenancy",
    body: "We're running the final checks now. Once everything is verified, your account will be approved shortly.",
  },
  landlord_verified: {
    title: "You're verified",
    body: "You can now continue getting 1% cashback on your rent payments.",
  },
  landlord_verification_failed: {
    title: "Verification needs attention",
    body: "We couldn't complete your landlord verification after our internal anti-fraud checks. Someone from our team will reach out to help. You can contact our support if you've any questions.",
  },
  landlord_rejected: {
    title: "Landlord couldn't verify tenancy",
    body: "{landlord_name} didn't confirm the details. Tap to update and resend.",
  },
  app_update: {
    title: "New update available",
    body: "We've improved speed and stability. Update now for the best experience.",
  },
  reminder_utility: {
    title: "One step left — utility verification",
    body: "Add your electricity bill ID to complete setup. Takes 30 seconds.",
  },
  reminder_landlord_invite: {
    title: "Your landlord's waiting",
    body: "Send the invite so they can confirm your tenancy and you can start paying.",
  },
  reminder_agreement: {
    title: "Upload your rent agreement",
    body: "It'll only take a minute to verify your tenancy.",
  },
  onboarding_dropoff: {
    title: "Complete your signup",
    body: "Upload your rental agreement to unlock access & start earning 1% cashback.",
  },
  agreement_upload_failed: {
    title: "Upload didn't go through",
    body: "Your agreement upload failed. Try again to start earning cashback.",
  },
  under_review: {
    title: "Agreement under review",
    body: "We're reviewing your agreement. Approvals typically take < 6 hours.",
  },
  setup_incomplete: {
    title: "Almost there!",
    body: "Complete your setup to unlock 1% cashback on rent payments.",
  },
  landlord_pending: {
    title: "Waiting on your landlord",
    body: "We're waiting on your landlord's confirmation. We'll keep you posted.",
  },
  payment_processing: {
    title: "Payment in progress",
    body: "Your payment is on its way. Shouldn't take long.",
  },
  payment_refunded: {
    title: "Payment refunded",
    body: "Your payment of ₹{amount} has been refunded. It should hit your account within 48 hours.",
  },
  milestone_streak: {
    title: "Streak milestone!",
    body: "{streak_months} months of on-time rent. You've earned ₹{total_cashback} back!",
  },
};

// ==============================================
// INTERPOLATION
// ==============================================

/**
 * Interpolate {key} placeholders in a template string.
 * e.g. interpolateTemplate("Hello {name}", { name: "Rishi" }) → "Hello Rishi"
 */
export function interpolateTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => vars[key] ?? match);
}

// ==============================================
// DEEP LINK ROUTES
// ==============================================

/**
 * Maps notification type → deep link route within the app.
 * Used to set `data.route` on push payloads so the app opens the right screen.
 */
export const NOTIFICATION_ROUTES: Record<NotificationType, string> = {
  waitlist_approved: "/(waitlist)/approved",
  waitlist_rejected: "/(waitlist)/rejected",
  payment_success: "/(payment)/status",
  payment_failed: "/(payment)/status",
  rent_due: "/(payment)/enter-rent",
  settlement_complete: "/(main)",
  settlement_failed: "/(main)",
  rent_due_tomorrow: "/(payment)/enter-rent",
  rent_overdue: "/(payment)/enter-rent",
  landlord_confirmed: "/(main)",
  landlord_verified: "/(main)",
  landlord_verification_failed: "/(main)",
  landlord_rejected: "/(setup)/invite-landlord",
  app_update: "/(main)",
  reminder_utility: "/(setup)/add-utility",
  reminder_landlord_invite: "/(setup)/invite-landlord",
  reminder_agreement: "/(agreement)/upload",
  onboarding_dropoff: "/(agreement)/upload",
  agreement_upload_failed: "/(agreement)/upload",
  under_review: "/(waitlist)",
  setup_incomplete: "/(setup)",
  landlord_pending: "/(main)",
  payment_processing: "/(main)",
  payment_refunded: "/(main)",
  milestone_streak: "/(main)",
};

// ==============================================
// PREFERENCE MAPPING
// ==============================================

/**
 * Maps notification type → column name in `notification_preferences` table.
 * `null` means always send (cannot be disabled by the user).
 */
export const PREFERENCE_MAP: Record<NotificationType, string | null> = {
  waitlist_approved: null, // always send
  waitlist_rejected: null, // always send
  payment_success: "payment_confirmations",
  payment_failed: "payment_confirmations",
  rent_due: "payment_reminders",
  settlement_complete: "payment_confirmations",
  settlement_failed: "payment_confirmations",
  rent_due_tomorrow: "payment_reminders",
  rent_overdue: "payment_reminders",
  landlord_confirmed: "landlord_updates",
  landlord_verified: "landlord_updates",
  landlord_verification_failed: "landlord_updates",
  landlord_rejected: "landlord_updates",
  app_update: "promotional",
  reminder_utility: "verification_updates",
  reminder_landlord_invite: "verification_updates",
  reminder_agreement: "verification_updates",
  onboarding_dropoff: null,           // always send
  agreement_upload_failed: null,      // always send
  under_review: null,                 // always send
  setup_incomplete: "verification_updates",
  landlord_pending: "landlord_updates",
  payment_processing: "payment_confirmations",
  payment_refunded: "payment_confirmations",
  milestone_streak: "payment_confirmations",
};

// ==============================================
// DB TYPE MAPPING
// ==============================================

/**
 * Maps notification type → value stored in the `type` column of the
 * `notifications` table (must match the CHECK constraint).
 */
export const DB_TYPE_MAP: Record<NotificationType, string> = {
  waitlist_approved: "waitlist_approved",
  waitlist_rejected: "waitlist_rejected",
  payment_success: "payment_success",
  payment_failed: "payment_failed",
  rent_due: "rent_due",
  settlement_complete: "settlement_complete",
  settlement_failed: "settlement_failed",
  rent_due_tomorrow: "rent_due_tomorrow",
  rent_overdue: "rent_overdue",
  landlord_confirmed: "landlord_confirmed",
  landlord_verified: "landlord_verified",
  landlord_verification_failed: "landlord_verification_failed",
  landlord_rejected: "landlord_rejected",
  app_update: "app_update",
  reminder_utility: "reminder_utility",
  reminder_landlord_invite: "reminder_landlord_invite",
  reminder_agreement: "reminder_agreement",
  onboarding_dropoff: "onboarding_dropoff",
  agreement_upload_failed: "agreement_upload_failed",
  under_review: "under_review",
  setup_incomplete: "setup_incomplete",
  landlord_pending: "landlord_pending",
  payment_processing: "payment_processing",
  payment_refunded: "payment_refunded",
  milestone_streak: "milestone_streak",
};

// ==============================================
// WHATSAPP TEMPLATES (DB-DRIVEN)
// ==============================================

/**
 * The set of notification types that have WhatsApp templates configured.
 * O(1) presence check used by callers to decide whether to attempt a WA
 * dispatch at all (avoids reserving a slot for types that have no template).
 *
 * Authoritative SID + variable_keys live in `notification_policy` (seeded by
 * migration 20260430120002). Use `getWhatsAppTemplate()` to fetch them.
 *
 * `reminder_agreement` is intentionally absent: no approved Twilio template;
 * push-only for now (decision 2026-04-30).
 */
export const WHATSAPP_TEMPLATE_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  "onboarding_dropoff",
  "agreement_upload_failed",
  "under_review",
  "waitlist_approved",
  "waitlist_rejected",
  "setup_incomplete",
  "landlord_pending",
  "landlord_verified",
  "landlord_verification_failed",
  "rent_due",
  "rent_overdue",
  "payment_success",
  "payment_failed",
  "payment_processing",
  "payment_refunded",
  "milestone_streak",
  "settlement_complete",
]);

export interface WhatsAppTemplateConfig {
  contentSid: string;       // Twilio Content Template SID (HX...)
  variableKeys: string[];   // Order-sensitive keys for {{1}}, {{2}}, ...
}

/**
 * Fetches the WhatsApp template configuration for a notification type from
 * `notification_policy`. Returns null if the row is missing OR
 * content_template_sid is NULL (template not yet wired up — visible in audit
 * via `SELECT notification_type FROM notification_policy WHERE channel='whatsapp' AND content_template_sid IS NULL`).
 *
 * Hot path: single indexed lookup on a ~17-row table. Sub-millisecond.
 */
export async function getWhatsAppTemplate(
  supabase: { from: (table: string) => any },
  notificationType: NotificationType,
): Promise<WhatsAppTemplateConfig | null> {
  const { data, error } = await supabase
    .from("notification_policy")
    .select("content_template_sid, content_variable_keys")
    .eq("notification_type", notificationType)
    .eq("channel", "whatsapp")
    .maybeSingle();

  if (error || !data || !data.content_template_sid) return null;

  return {
    contentSid: data.content_template_sid,
    variableKeys: data.content_variable_keys ?? [],
  };
}

// ==============================================
// NOTIFICATION TIMING CONFIG
// ==============================================

/**
 * Dynamic timing configuration for each notification type.
 * Controls when first send and reminder are triggered after an event.
 *
 * triggerDelaySec: seconds after event to send first notification (0 = immediate)
 * reminderDelaySec: seconds after event to send reminder (null = no reminder)
 *
 * Timing is configurable — change values here to adjust for all notifications.
 */
export interface NotificationTimingConfig {
  triggerDelaySec: number;         // 0 = immediate
  reminderDelaySec: number | null; // null = no reminder
}

const MIN_15 = 15 * 60;    // 900 seconds
const HOUR_6 = 6 * 60 * 60; // 21600 seconds

export const NOTIFICATION_TIMING: Partial<Record<NotificationType, NotificationTimingConfig>> = {
  // 15 min + 6h reminder
  // onboarding_dropoff: handled by send-onboarding-reminders cron (not via scheduler)
  agreement_upload_failed: { triggerDelaySec: MIN_15, reminderDelaySec: HOUR_6 },
  setup_incomplete:        { triggerDelaySec: MIN_15, reminderDelaySec: HOUR_6 },
  landlord_pending:        { triggerDelaySec: MIN_15, reminderDelaySec: HOUR_6 },
  rent_overdue:            { triggerDelaySec: MIN_15, reminderDelaySec: HOUR_6 },

  // Immediate + 6h reminder
  waitlist_approved:       { triggerDelaySec: 0, reminderDelaySec: HOUR_6 },
  waitlist_rejected:       { triggerDelaySec: 0, reminderDelaySec: HOUR_6 },
  payment_failed:          { triggerDelaySec: 0, reminderDelaySec: HOUR_6 },

  // Immediate, no reminder
  under_review:            { triggerDelaySec: 0, reminderDelaySec: null },
  payment_success:         { triggerDelaySec: 0, reminderDelaySec: null },
  payment_processing:      { triggerDelaySec: 0, reminderDelaySec: null },
  payment_refunded:        { triggerDelaySec: 0, reminderDelaySec: null },
  milestone_streak:        { triggerDelaySec: 0, reminderDelaySec: null },

  // Rent due is calendar-based (1st, 3rd, 5th of month) — handled separately
  // rent_due has no entry here; it uses the rent-due cron
};
