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
    body: "₹{amount} settled to {landlord_name}'s account. One less thing to worry about.",
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
    title: "Your landlord confirmed you",
    body: "{landlord_name} verified your tenancy. You're all set to pay rent through Flent.",
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
  payment_refunded: "payment_refunded",
  milestone_streak: "milestone_streak",
};

// ==============================================
// WHATSAPP TEMPLATE MAP
// ==============================================

/**
 * Maps notification type → Twilio WhatsApp Content Template.
 * ContentSids are stored as env vars for easy updates without code deploys.
 * Only types with WhatsApp templates are included (Partial).
 */
export interface WhatsAppTemplateConfig {
  contentSidEnvVar: string;    // Env var name holding the HXxxxxxxxxx ContentSid
  variableKeys: string[];      // Keys from template_vars to map to {{1}}, {{2}}, ...
}

export const WHATSAPP_TEMPLATE_MAP: Partial<Record<NotificationType, WhatsAppTemplateConfig>> = {
  onboarding_dropoff:      { contentSidEnvVar: "WA_TPL_ONBOARDING_DROPOFF",  variableKeys: ["name"] },
  agreement_upload_failed: { contentSidEnvVar: "WA_TPL_AGREEMENT_FAILED",    variableKeys: [] },
  under_review:            { contentSidEnvVar: "WA_TPL_UNDER_REVIEW",        variableKeys: [] },
  waitlist_approved:       { contentSidEnvVar: "WA_TPL_APPROVED",            variableKeys: [] },
  waitlist_rejected:       { contentSidEnvVar: "WA_TPL_AGREEMENT_REJECTED",  variableKeys: [] },
  setup_incomplete:        { contentSidEnvVar: "WA_TPL_SETUP_INCOMPLETE",    variableKeys: [] },
  landlord_pending:        { contentSidEnvVar: "WA_TPL_LANDLORD_PENDING",    variableKeys: [] },
  rent_due:                { contentSidEnvVar: "WA_TPL_RENT_DUE",            variableKeys: [] },
  rent_overdue:            { contentSidEnvVar: "WA_TPL_MISSED_PAYMENT",      variableKeys: [] },
  payment_success:         { contentSidEnvVar: "WA_TPL_PAYMENT_SUCCESS",     variableKeys: ["cashback"] },
  payment_failed:          { contentSidEnvVar: "WA_TPL_PAYMENT_FAILED",      variableKeys: [] },
  payment_refunded:        { contentSidEnvVar: "WA_TPL_PAYMENT_REFUNDED",    variableKeys: [] },
  milestone_streak:        { contentSidEnvVar: "WA_TPL_MILESTONE_STREAK",    variableKeys: ["streak_months", "total_cashback"] },
};
