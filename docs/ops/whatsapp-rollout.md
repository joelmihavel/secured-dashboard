# WhatsApp Notification Infra — Rollout Runbook

This runbook covers the deploy + cutover of the WhatsApp kill-switch + spam-policy
infrastructure introduced on branch `wa-infra-kill-switch`.

## What changed

- Three runtime feature flags in `private.feature_flags`:
  - `whatsapp_send` — master kill (any send anywhere)
  - `whatsapp_automated` — cron-driven funnel sends
  - `whatsapp_broadcast` — admin manual campaigns
  - `whatsapp_daily_cap_per_user` — global per-user-per-day cap (default 3)
- Spam-protection policy in `notification_policy` (per-type lifetime / daily / window caps, quiet-hours, opt-out columns).
- Race-safe slot reservation (`public.reserve_whatsapp_slot` / `public.release_whatsapp_slot`) under per-user advisory locks.
- `notification_send_log` table records every WhatsApp send attempt (sent / pending / failed / skipped).
- `notify-user`, `whatsapp-broadcast`, `invite-landlord-whatsapp`, `landlord-confirm` all gated through the slot-reservation helper.
- Three cron entrypoints (`process-notification-schedule`, `send-onboarding-reminders`, `send-reminders`) check `whatsapp_automated` before processing.
- `process_notification_queue` PL/pgSQL function checks `whatsapp_send`; blocked WA rows are marked `failed` with `error_message='wa_kill_switch'`.
- `retry-failed-notifications` cron now skips rows with kill-switch error messages so they stay terminally failed.
- `reminder_agreement` removed from `WHATSAPP_TEMPLATE_MAP` (push-only; no approved Twilio template).

## Initial flag state (per locked decision)

After the first deploy, **all three boolean flags are OFF on every environment**. The operator must explicitly flip them per environment after verifying the policy table and testing.

## Deploy order — strict

1. **Apply migrations first** (in order):
   - `20260430120001_feature_flags_table.sql`
   - `20260430120002_notification_policy_and_send_log.sql`
   - `20260430120003_kill_switch_in_process_notification_queue.sql`
   - `20260430120004_reserve_slot_and_retry_filter.sql`

   `supabase db push` against the target project.

2. **Verify migrations applied:**
   ```sql
   SELECT version, name FROM supabase_migrations.schema_migrations
   WHERE version LIKE '202604301200%' ORDER BY version;
   ```
   Should return four rows.

3. **Deploy edge functions** (this PR's diff). Order doesn't matter between functions, but **all** of these must redeploy:
   - `_shared/` (helpers): `notifications`, `feature-flags`, `notification-policy`, `notification-templates`
   - `notify-user`, `send-whatsapp`, `whatsapp-broadcast`
   - `send-onboarding-reminders`, `send-reminders`, `process-notification-schedule`
   - `invite-landlord-whatsapp`, `landlord-confirm`

4. **Remove obsolete env var**. The old `WA_NOTIFICATIONS_ENABLED` env var is no longer read. Remove it from Supabase secrets (`supabase secrets unset WA_NOTIFICATIONS_ENABLED`) so it doesn't drift.

5. **Verify the kill is in effect.** Default flag state is OFF — confirm by inspecting `notification_send_log` after a few minutes; no new `outcome='sent'` rows should appear.

## Flipping flags on (cutover)

Flags live in `private.feature_flags`. Toggle via direct UPDATE (you'll need a service-role psql session or the Supabase SQL editor).

**To enable transactional WA only** (payment events, etc.) — automated funnel + broadcasts stay off:
```sql
UPDATE private.feature_flags
SET enabled = true, updated_by = 'rishabh', note = 'cutover: transactional only'
WHERE key = 'whatsapp_send';
```

**To enable automated funnel sends** (onboarding nudges, reminders) — requires `whatsapp_send` already ON:
```sql
UPDATE private.feature_flags
SET enabled = true, updated_by = 'rishabh', note = 'cutover: automated on'
WHERE key = 'whatsapp_automated';
```

**To enable manual broadcasts:**
```sql
UPDATE private.feature_flags
SET enabled = true, updated_by = 'rishabh', note = 'cutover: broadcast on'
WHERE key = 'whatsapp_broadcast';
```

**To kill everything immediately:**
```sql
UPDATE private.feature_flags SET enabled = false WHERE key = 'whatsapp_send';
```
Up to 30 seconds of in-flight requests may already have read `enabled=true` from the cache; new requests will see `false` immediately. Send-WhatsApp short-circuits at the top so cached calls also bail before reaching Twilio.

## Behavior caveats to know before flipping flags

### `whatsapp_automated=false` also pauses scheduled push notifications
The three crons (`process-notification-schedule`, `send-onboarding-reminders`, `send-reminders`) blanket-skip when `whatsapp_automated` is OFF. Two of them are 100% WhatsApp paths, but `process-notification-schedule` also drives **scheduled push** notifications (rent_due reminders, payment_failed retries fired via the scheduler). Flipping `whatsapp_automated=false` will stop those push notifications too. If you only want to silence WhatsApp without affecting push, leave `whatsapp_automated=true` and rely on `whatsapp_send=false` instead — `whatsapp_send` is checked at the bottom of every send path so push continues to fire.

### Broadcasts ignore quiet hours
The `whatsapp-broadcast` endpoint uses synthetic notification types (`broadcast:<campaign>`) that have no `notification_policy` row, so quiet-hours and category opt-outs aren't checked. Only `whatsapp_enabled=false` (per-user opt-out) and the global daily cap protect recipients. Schedule broadcasts during reasonable IST hours yourself.

### Broadcast log insert is soft-fail
If `whatsapp_broadcast_log` insert errors (e.g., the `total_skipped` column from migration `20260430120004` isn't applied), the response is still 200 but includes `log_failed: true` and `log_error`. The compliance trail is still written to `audit_logs`. Watch for `log_failed` in the response when running broadcasts soon after a deploy — if it appears, apply pending migrations.

### Landlord-without-Flent-account = unbounded WA sends
`invite-landlord-whatsapp` looks up the landlord's `users.id` by phone. If the landlord has no Flent account (the common case), no slot is reserved and no row lands in `notification_send_log`. Per-tenancy rate limit (`tenancies.landlord_invite_count`) is the only protection. If you ever need a global by-phone limit, that's a separate addition.

## Tuning policy (no redeploy needed)

### Change daily cap
```sql
UPDATE private.feature_flags
SET config = '{"cap": 5}'::jsonb
WHERE key = 'whatsapp_daily_cap_per_user';
```

### Disable global daily cap entirely
```sql
UPDATE private.feature_flags
SET enabled = false
WHERE key = 'whatsapp_daily_cap_per_user';
```

### Adjust per-type caps
```sql
UPDATE notification_policy
SET max_per_user_per_day = 2
WHERE notification_type = 'onboarding_dropoff';
```

### Disable a specific notification type's WhatsApp channel
```sql
UPDATE notification_policy
SET enabled = false
WHERE notification_type = 'milestone_streak';
```
(Push + in-app still fire for that type.)

## Inspecting traffic

### Recent WhatsApp sends
```sql
SELECT created_at, user_id, notification_type, outcome, skip_reason, external_id, error_message
FROM notification_send_log
WHERE channel = 'whatsapp'
ORDER BY created_at DESC LIMIT 50;
```

### Per-user counts today
```sql
SELECT user_id, COUNT(*) AS sent_today
FROM notification_send_log
WHERE channel = 'whatsapp'
  AND outcome IN ('sent','pending')
  AND created_at >= (
    SELECT date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'
  )
GROUP BY user_id
ORDER BY sent_today DESC LIMIT 25;
```

### Stale `pending` rows (slot leak — caller didn't release)
```sql
SELECT id, user_id, notification_type, created_at
FROM notification_send_log
WHERE outcome = 'pending'
  AND created_at < NOW() - INTERVAL '1 hour'
ORDER BY created_at LIMIT 50;
```
A handful is fine (function timed out mid-Twilio); a flood means the slot release path is broken. Mark them as failed manually:
```sql
UPDATE notification_send_log
SET outcome = 'failed', error_message = 'manual_cleanup_stale_pending'
WHERE outcome = 'pending' AND created_at < NOW() - INTERVAL '1 hour';
```

### Skip reasons over the last 24h
```sql
SELECT skip_reason, COUNT(*) AS n
FROM notification_send_log
WHERE channel = 'whatsapp'
  AND outcome = 'skipped'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY skip_reason
ORDER BY n DESC;
```

## Cleanup of legacy stuck rows (dev only)

After the kill-switch is verified live and `whatsapp_send` is OFF on dev, the 14 rows stuck in `notification_queue.status='processing'` since 2026-04-02 can be cleared safely. With kill-switch off, even if retry cron flips them back to `pending` and `process_notification_queue` re-picks them, they'll be marked `failed` with `wa_kill_switch` and the retry cron's new exclusion will leave them terminal.

Quick clean (no auto-resend possible while flag is off):
```sql
UPDATE notification_queue
SET status = 'failed',
    error_message = 'manual_cleanup',
    retry_count = max_retries
WHERE status = 'processing'
  AND notification_type = 'whatsapp'
  AND created_at < NOW() - INTERVAL '14 days';
```

## Manual broadcast — example

```bash
curl -X POST "$SUPABASE_URL/functions/v1/whatsapp-broadcast" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "admin_key": "'$ADMIN_API_KEY'",
    "campaign_name": "rent_day_apr30",
    "content_sid": "HX492a30d3edfa8a254863c6f23d9ef2e3",
    "audience": "approved",
    "dry_run": true,
    "max_recipients": 100
  }'
```

Drop `dry_run` to actually send. Audience filters: `all | no_agreement | approved`.

## Rollback

If the new flags or policy tables cause an outage, the safest rollback is to **flip every flag OFF and redeploy the previous edge-function set** (the migrations are additive and safe to keep). The migrations themselves are not destructive — leaving them in place doesn't affect anything.
