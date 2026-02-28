/**
 * Notification copy templates for all trigger scenarios.
 *
 * Placeholders use `{key}` syntax — callers replace before sending.
 * Referenced by edge functions (server-side) and local notification helpers (client-side).
 */

export type NotificationType =
  | 'waitlist_approved'
  | 'waitlist_rejected'
  | 'rent_due'
  | 'settlement_complete'
  | 'settlement_failed'
  | 'rent_due_tomorrow'
  | 'rent_overdue'
  | 'landlord_confirmed'
  | 'landlord_rejected'
  | 'app_update'
  | 'reminder_utility'
  | 'reminder_landlord_invite'
  | 'reminder_agreement';

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
    body: 'Pay ₹{amount} before it\'s overdue. Takes under a minute.',
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
    body: 'Add your electricity or water bill ID to complete setup. Takes 30 seconds.',
  },
  reminder_landlord_invite: {
    title: "Your landlord's waiting",
    body: 'Send the invite so they can confirm your tenancy and you can start paying.',
  },
  reminder_agreement: {
    title: 'Upload your rent agreement',
    body: "It'll only take a minute to verify your tenancy.",
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
