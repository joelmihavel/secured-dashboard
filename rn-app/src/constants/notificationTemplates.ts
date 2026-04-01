/**
 * Notification copy templates for all trigger scenarios.
 *
 * Placeholders use `{key}` syntax — callers replace before sending.
 * Keep in sync with: supabase/functions/_shared/notification-templates.ts
 */

export type NotificationType =
  | 'waitlist_approved'
  | 'waitlist_rejected'
  | 'rent_due'
  | 'payment_success'
  | 'payment_failed'
  | 'settlement_complete'
  | 'settlement_failed'
  | 'rent_due_tomorrow'
  | 'rent_overdue'
  | 'landlord_confirmed'
  | 'landlord_rejected'
  | 'app_update'
  | 'reminder_utility'
  | 'reminder_landlord_invite'
  | 'reminder_agreement'
  | 'onboarding_dropoff'
  | 'agreement_upload_failed'
  | 'under_review'
  | 'setup_incomplete'
  | 'landlord_pending'
  | 'payment_refunded'
  | 'milestone_streak';

interface NotificationTemplate {
  title: string;
  body: string;
}

export const NOTIFICATION_TEMPLATES: Record<NotificationType, NotificationTemplate> = {
  waitlist_approved: {
    title: "You're in, {name}.",
    body: 'Welcome to the right side of renting. Tap to get started.',
  },
  waitlist_rejected: {
    title: "We couldn't approve your application",
    body: "Sorry, your current rental contract doesn't qualify our eligibility criteria.",
  },
  payment_success: {
    title: 'Rent paid, {name}',
    body: '₹{amount} received. You saved ₹{cashback} with Flent.',
  },
  payment_failed: {
    title: "Payment didn't go through",
    body: '₹{amount} couldn\'t be processed. Tap to retry.',
  },
  rent_due: {
    title: "Rent's coming up",
    body: '₹{amount} due on {date}. Pay early, earn cashback.',
  },
  settlement_complete: {
    title: 'Your landlord got paid',
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
    title: 'Gentle reminder',
    body: "Don't miss your payment. ₹{amount} was due on {date}.",
  },
  landlord_confirmed: {
    title: 'Your landlord confirmed you',
    body: "{landlord_name} verified your tenancy. You're all set to pay rent through Flent.",
  },
  landlord_rejected: {
    title: "Landlord couldn't verify tenancy",
    body: "{landlord_name} didn't confirm the details. Tap to update and resend.",
  },
  app_update: {
    title: 'New update available',
    body: "We've improved speed and stability. Update now for the best experience.",
  },
  reminder_utility: {
    title: 'One step left — utility verification',
    body: 'Add your electricity bill ID to complete setup. Takes 30 seconds.',
  },
  reminder_landlord_invite: {
    title: "Your landlord's waiting",
    body: 'Send the invite so they can confirm your tenancy and you can start paying.',
  },
  reminder_agreement: {
    title: 'Upload your rent agreement',
    body: "It'll only take a minute to verify your tenancy.",
  },
  onboarding_dropoff: {
    title: 'Complete your signup',
    body: 'Upload your rental agreement to unlock access & start earning 1% cashback.',
  },
  agreement_upload_failed: {
    title: "Upload didn't go through",
    body: 'Your agreement upload failed. Try again to start earning cashback.',
  },
  under_review: {
    title: 'Agreement under review',
    body: "We're reviewing your agreement. Approvals typically take < 6 hours.",
  },
  setup_incomplete: {
    title: 'Almost there!',
    body: 'Complete your setup to unlock 1% cashback on rent payments.',
  },
  landlord_pending: {
    title: 'Waiting on your landlord',
    body: "We're waiting on your landlord's confirmation. We'll keep you posted.",
  },
  payment_refunded: {
    title: 'Payment refunded',
    body: 'Your payment of ₹{amount} has been refunded. It should hit your account within 48 hours.',
  },
  milestone_streak: {
    title: 'Streak milestone!',
    body: "{streak_months} months of on-time rent. You've earned ₹{total_cashback} back!",
  },
};

/**
 * Interpolate placeholders in a template string.
 * e.g. interpolate("Hello {name}", { name: "Rishi" }) → "Hello Rishi"
 */
export function interpolateTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => vars[key] ?? match);
}

/**
 * Maps notification type -> deep link route within the app.
 * Used to navigate the user to the right screen when tapping a notification.
 * Keep in sync with: supabase/functions/_shared/notification-templates.ts
 */
export const NOTIFICATION_ROUTES: Record<NotificationType, string> = {
  waitlist_approved: '/(waitlist)/approved',
  waitlist_rejected: '/(waitlist)/rejected',
  payment_success: '/(payment)/status',
  payment_failed: '/(payment)/status',
  rent_due: '/(payment)/enter-rent',
  settlement_complete: '/(main)',
  settlement_failed: '/(main)',
  rent_due_tomorrow: '/(payment)/enter-rent',
  rent_overdue: '/(payment)/enter-rent',
  landlord_confirmed: '/(main)',
  landlord_rejected: '/(setup)/invite-landlord',
  app_update: '/(main)',
  reminder_utility: '/(setup)/add-utility',
  reminder_landlord_invite: '/(setup)/invite-landlord',
  reminder_agreement: '/(agreement)/upload',
  onboarding_dropoff: '/(agreement)/upload',
  agreement_upload_failed: '/(agreement)/upload',
  under_review: '/(waitlist)',
  setup_incomplete: '/(setup)',
  landlord_pending: '/(main)',
  payment_refunded: '/(main)',
  milestone_streak: '/(main)',
};
