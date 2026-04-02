# WhatsApp Notification System — Flent Secured

## Overview

WhatsApp notifications are sent to users at key lifecycle stages via Twilio's WhatsApp Business API. The system supports:
- **14 BAU automated notifications** triggered by user events (signup, payments, approvals, etc.)
- **4 one-time broadcast notifications** triggered manually for campaigns
- **Dynamic scheduling** with configurable delays and reminders per notification type

## Architecture

```
Event occurs (signup, payment, approval, etc.)
  → scheduleNotification() inserts into notification_schedule table
    → process-notification-schedule cron (every 5 min) picks up due notifications
      → State check: has user completed the desired action?
        → YES: skip notification (mark as "skipped")
        → NO: send via notify-user orchestrator
          → Push notification (Expo Push API)
          → WhatsApp notification (Twilio Content Template)
```

### Key Components

| Component | Purpose |
|-----------|---------|
| `_shared/notification-templates.ts` | Template text, routes, preferences, WA template map, timing config |
| `_shared/notifications.ts` | `scheduleNotification()`, `sendWhatsAppForUser()`, `notifyUser()`, Twilio API |
| `notify-user/index.ts` | Orchestrator: in-app + push + WhatsApp in parallel |
| `process-notification-schedule/index.ts` | Cron processor: sends due scheduled notifications + rent-due calendar |
| `send-onboarding-reminders/index.ts` | Dedicated cron for 15-min + 6-hour onboarding nudges |
| `whatsapp-broadcast/index.ts` | Manual broadcast sender with audience filtering |
| `open-app/index.ts` | Smart deep-link redirect page for CTA buttons |
| `notification_schedule` table | Queue of scheduled notification sends |

## Notification Types

### BAU Automated Notifications

| # | Type | Image | Trigger | Timing | State Check |
|---|------|-------|---------|--------|-------------|
| 1 | `onboarding_dropoff` | 01 | User signs up, no agreement | 15 min + 6h reminder | Still `signed_up`, no waitlist entry |
| 2 | `agreement_upload_failed` | 02 | Extraction fails | 15 min + 6h reminder | Still `signed_up` |
| 3 | `under_review` | 03 | Agreement uploaded | Immediate | — |
| 4 | `waitlist_rejected` | 04 | Admin rejects | Immediate + 6h reminder | Still `not_eligible` |
| 5 | `waitlist_approved` | 06 | Admin approves | Immediate + 6h reminder | Still `approved` (hasn't started setup) |
| 6 | `setup_incomplete` | 07 | Admin approves (alongside #5) | 15 min + 6h reminder | Still `approved` |
| 7 | `landlord_pending` | 08a | Landlord invite sent | 15 min + 6h reminder | Landlord still `invited` |
| 8 | `rent_due` | 09 | Calendar (1st, 3rd, 5th of month) | At 10 AM IST | User hasn't paid this month |
| 9 | `rent_overdue` | 10 | Due date passes | 15 min + 6h reminder | Still unpaid |
| 10 | `payment_processing` | 13 | Cashfree PENDING webhook | Immediate | — |
| 11 | `payment_success` | 11 | Cashfree SUCCESS webhook | Immediate | — |
| 12 | `payment_failed` | 13 | Cashfree FAILED webhook | Immediate + 6h reminder | No successful retry in 6h |
| 13 | `payment_refunded` | 13 | Cashfree refund webhook | Immediate | — |
| 14 | `milestone_streak` | 15 | 3/6 consecutive on-time payments | **PAUSED** | — |

### One-Time Broadcasts

| # | Name | Image | CTA |
|---|------|-------|-----|
| 1 | Rent Day | 09 | — |
| 2 | Credit Card | 09 | Pay Now |
| 3 | Last Call | 09 | Pay Now |
| 4 | Agreement Nudge | 09 | Upload Agreement |

## Twilio Configuration

- **Account SID**: `ACa1d44932d3d7e5f359012a666c442b4f`
- **WhatsApp Number**: `+919980021293`
- **Auth**: API Key (`TWILIO_API_KEY_SID` + `TWILIO_API_KEY_SECRET`)
- **Templates**: Created via Twilio Content API, approved by Meta/WhatsApp
- **Template SIDs**: Stored as Supabase secrets (`WA_TPL_*` env vars)

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `WA_NOTIFICATIONS_ENABLED` | Global kill-switch (`true`/`false`) |
| `TWILIO_ACCOUNT_SID` | Twilio account (used in API URL) |
| `TWILIO_API_KEY_SID` | API Key for auth |
| `TWILIO_API_KEY_SECRET` | API Key secret |
| `TWILIO_WHATSAPP_NUMBER` | Production WhatsApp number |
| `WA_TPL_ONBOARDING_DROPOFF` | ContentSid for onboarding template |
| `WA_TPL_AGREEMENT_FAILED` | ContentSid for agreement failed |
| `WA_TPL_UNDER_REVIEW` | ContentSid for under review |
| `WA_TPL_APPROVED` | ContentSid for approved |
| `WA_TPL_AGREEMENT_REJECTED` | ContentSid for rejected |
| `WA_TPL_SETUP_INCOMPLETE` | ContentSid for setup incomplete |
| `WA_TPL_LANDLORD_PENDING` | ContentSid for landlord pending |
| `WA_TPL_RENT_DUE` | ContentSid for rent due |
| `WA_TPL_MISSED_PAYMENT` | ContentSid for missed payment |
| `WA_TPL_PAYMENT_SUCCESS` | ContentSid for payment success |
| `WA_TPL_PAYMENT_PROCESSING` | ContentSid for payment processing |
| `WA_TPL_PAYMENT_FAILED` | ContentSid for payment failed |
| `WA_TPL_PAYMENT_REFUNDED` | ContentSid for payment refunded |
| `WA_TPL_MILESTONE_STREAK` | ContentSid for milestone streak |
| `ADMIN_API_KEY` | Second-factor auth for broadcast endpoint |

## Cron Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| `process-notification-schedule` | Every 5 min | Processes scheduled notification queue + rent-due on 1st/3rd/5th |
| `send-onboarding-reminders` | Every 5 min | Onboarding drop-off at 15 min + 6 hours after signup |
| `send-reminders` | Daily 10 AM IST | Rent due (3/1 day before), overdue, utility/landlord/agreement reminders |

## Timing Configuration

Timing is configurable per notification type in `NOTIFICATION_TIMING` (`_shared/notification-templates.ts`):

```typescript
const MIN_15 = 15 * 60;     // 900 seconds
const HOUR_6 = 6 * 60 * 60; // 21600 seconds

NOTIFICATION_TIMING = {
  // 15 min delay + 6h reminder
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
};
```

To change timing, update the values and redeploy. No template changes needed.

## Broadcast Usage

Send one-time campaigns via the `whatsapp-broadcast` edge function:

```bash
curl -X POST "https://api-secured.flent.in/functions/v1/whatsapp-broadcast" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "admin_key": "YOUR_ADMIN_KEY",
    "campaign_name": "April rent day",
    "content_sid": "HX492a30d3edfa8a254863c6f23d9ef2e3",
    "audience": "all",
    "dry_run": true
  }'
```

**Audience filters**: `all`, `no_agreement`, `approved`
**`dry_run: true`**: Returns recipient count without sending

## Deep Link Redirect

CTA buttons use `https://api-secured.flent.in/functions/v1/open-app?path=/payment` which:
1. Tries to open the app via `flentsecured:///` custom scheme
2. Falls back to App Store if app isn't installed
3. Shows a branded loading page matching the app's design system

## Database Tables

| Table | Purpose |
|-------|---------|
| `notification_schedule` | Queue of scheduled sends with `scheduled_for` timestamp |
| `notification_dedup` | Prevents duplicate sends within time windows |
| `notification_preferences` | User opt-in/opt-out (`whatsapp_enabled` column) |
| `whatsapp_broadcast_log` | Tracks broadcast campaign results |

## Files Modified

### New Functions
- `supabase/functions/process-notification-schedule/index.ts`
- `supabase/functions/send-onboarding-reminders/index.ts`
- `supabase/functions/whatsapp-broadcast/index.ts`
- `supabase/functions/open-app/index.ts`

### Modified Functions
- `supabase/functions/_shared/notification-templates.ts` — Types, templates, timing config, WA map
- `supabase/functions/_shared/notifications.ts` — Twilio API Key auth, `sendWhatsAppForUser()`, `scheduleNotification()`
- `supabase/functions/notify-user/index.ts` — Parallel push + WhatsApp via `Promise.allSettled()`
- `supabase/functions/payment-webhook/index.ts` — Payment processing/refunded triggers (Cashfree)
- `supabase/functions/process-document/index.ts` — Agreement upload failed trigger
- `supabase/functions/upload-document/index.ts` — Under review trigger
- `supabase/functions/admin-waitlist/index.ts` — Approved + setup incomplete triggers
- `supabase/functions/send-landlord-invite/index.ts` — Landlord pending trigger
- `supabase/functions/send-reminders/index.ts` — Rent overdue via scheduler
- `supabase/functions/cashfree-split-webhook/index.ts` — Bug fix (event → payload)

### Client-Side
- `rn-app/src/constants/notificationTemplates.ts` — Synced notification types
