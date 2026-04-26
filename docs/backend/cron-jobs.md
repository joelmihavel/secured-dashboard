# Cron Jobs Reference

19 scheduled jobs run on the prod Supabase project (`uowjtrzmszuaiokqxgir`) via `pg_cron`. Dev (`zqlowjveyqiagnbmfwsb`) was aligned to the same set on 2026-04-25 (see commit history).

> **Last reviewed:** 2026-04-25
>
> Source of truth: `SELECT * FROM cron.job ORDER BY jobname;` on the linked project. This doc is a snapshot — re-export when adding new jobs.

## Schedule format quick reference

`pg_cron` uses standard cron syntax (5 fields: `min hour day month dow`). Times are **UTC** — IST is UTC+5:30.

- `*/5 * * * *` — every 5 minutes
- `2-57/5 * * * *` — every 5 min starting at minute 2 (offsets the load from neighbouring jobs)
- `30 19 * * *` — 19:30 UTC daily = 01:00 IST
- `0 22 * * *` — 22:00 UTC daily = 03:30 IST
- `0 0 * * 0` — midnight UTC every Sunday

## Inventory

| Job | Schedule (UTC) | What it does | Edge fn / SQL fn called | Failure mode |
|---|---|---|---|---|
| `cleanup-audit-logs` | `0 0 * * 0` (Sun midnight) | Deletes `audit_logs` rows older than 1 year, except those with `action_category IN ('payment','security')` | inline `DELETE` | Audit retention regression — flag if row counts spike |
| `cleanup-expired-sessions` | `0 3 * * *` (08:30 IST) | `DELETE FROM active_sessions WHERE expires_at < NOW() - 1 day; DELETE FROM revoked_tokens WHERE expires_at < NOW();` | inline `DELETE` | Session table growth |
| `cleanup-idempotency-keys` | `30 20 * * *` (02:00 IST) | `DELETE FROM idempotency_keys WHERE expires_at < NOW()` | inline `DELETE` | Idempotency table growth |
| `cleanup-processed-webhooks` | `0 3 * * *` (08:30 IST) | `DELETE FROM processed_webhooks WHERE expires_at < NOW()` | inline `DELETE` | Same as above |
| `cleanup-stale-payments` | `4-59/5 * * * *` (every 5 min) | Triggers edge fn that marks payments `pending → expired` based on Cashfree gateway status | `cleanup-stale-payments` edge fn | Stale `pending` payments stay live, lock UI |
| `expire-cashback` | `30 19 * * *` (01:00 IST) | Calls `expire_old_cashback()` SQL fn — deducts expired cashback from user balance | `expire_old_cashback()` SQL | Users see incorrect cashback balance |
| `expire-stale-otp-requests` | `*/5 * * * *` | `UPDATE otp_requests SET status='expired' WHERE status='pending' AND expires_at < now()` | inline `UPDATE` | OTP retry UX degraded |
| `expire-stale-payments` | `* * * * *` (every minute) | `SELECT expire_stale_payments()` — terminates rows stuck in `processing` past TTL | `expire_stale_payments()` SQL | Race conditions on retry |
| `extraction-recovery` | `7,37 * * * *` (twice an hour) | Triggers Cloud Run extraction-service for stuck/failed extractions in last 4h | `extraction-recovery` edge fn | Stuck extractions never finish |
| `poll-settlement-and-reconcile` | `3,33 * * * *` (twice an hour) | Polls Cashfree for settlement status when webhooks miss | `poll-settlement-status` edge fn | Landlord payouts show stale state |
| `process-notification-queue` | `*/5 * * * *` | Drains `notification_queue` → push/SMS/WhatsApp dispatch | `process_notification_queue()` SQL | Notifications delayed; users miss rent reminders |
| `process-notification-schedule` | `*/5 * * * *` | Schedules new notifications (e.g., rent due in N days) into the queue | `process-notification-schedule` edge fn | New scheduled notifications don't fire |
| `retry-failed-notifications` | `*/15 * * * *` | `UPDATE notification_queue SET status='pending' WHERE status='failed' AND retry_count < max_retries AND age < 24h` | inline `UPDATE` | Failed notifications never retry |
| `send-onboarding-reminders` | `*/5 * * * *` | Reminds users on the waitlist who haven't completed bank/utility/landlord steps | `send-onboarding-reminders` edge fn | Funnel drops |
| `settle-to-landlord` | `2-57/5 * * * *` (every 5 min) | Initiates Cashfree vendor adjustment + on-demand transfer to the landlord for completed payments | `settle-to-landlord` edge fn | Landlord doesn't get paid |
| `sweep-stamp-verifications` | `0 22 * * *` (03:30 IST) | Catches stamp verifications that didn't fire fire-and-forget — last 48h scope | `sweep-stamp-verifications` edge fn | Stamp verification gaps in admin views |
| `sync-vendors` | `*/15 * * * *` | Syncs Cashfree vendor (landlord bank account) status into `bank_accounts.cf_beneficiary_status` | `sync-vendors` edge fn | Stale vendor status shown to admin |
| `upgrade-landlord-status` | `*/15 * * * *` | Calls `upgrade-landlord-status` edge fn via `net.http_post` (uses `current_setting('app.service_role_key')`) | `upgrade-landlord-status` edge fn | Landlord-tier upgrades delayed |
| `warmup-auth-otp` | `*/4 * * * *` | Pings `auth-otp` edge fn with `{"action":"health"}` to keep cold start at bay during peak rent days | `auth-otp` edge fn | First login of the morning has higher latency |

## Inline JWT issue (Phase Z)

Two of the cron jobs above embed the prod service-role JWT directly in their command strings:

- `process-notification-queue`: `SET app.service_role_key = '<JWT>'; SELECT process_notification_queue()`
- `upgrade-landlord-status`: reads via `current_setting('app.service_role_key',true)` — depends on a SET being run by another job before, which the JWT-embedding pattern provides

The JWT is also present in `migrations/20260308000001_migrate_cron_keys_to_vault.sql:34`. Phase Z of the cleanup plan rotates this JWT and refactors the cron commands to read from a `private.cron_secrets` table populated out-of-band.

Until Phase Z runs, the JWT in git is **the live production key**. Repo is private + solo-dev, so blast radius is currently limited, but treat it as a known-late-rotation issue (per the plan's audit findings).

## How to add a new cron job

1. Write the migration that creates the cron via `cron.schedule(name, schedule, command)`. Use idempotency wrappers:
   ```sql
   DO $$ BEGIN
     IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
       PERFORM cron.unschedule('my-new-job');
     END IF;
   EXCEPTION WHEN OTHERS THEN NULL;
   END $$;

   DO $$ BEGIN
     IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
       PERFORM cron.schedule('my-new-job', '*/5 * * * *',
         $$SELECT invoke_edge_function('my-new-edge-fn')$$);
     END IF;
   END $$;
   ```
2. The `IF EXISTS pg_cron` guard makes the migration safe to apply locally where pg_cron isn't enabled.
3. If the cron needs service-role auth, **do NOT inline the JWT**. Use the indirection table pattern Phase Z is moving the existing crons to (read from `private.cron_secrets` via `set_config('app.service_role_key', (SELECT value FROM private.cron_secrets WHERE key='service_role_key'), false)` first, then use `current_setting` downstream).
4. Update this doc.

## How to debug a failed cron run

```sql
-- Last 50 runs of a specific job
SELECT * FROM cron.job_run_details
WHERE jobname = '<job-name>'
ORDER BY start_time DESC
LIMIT 50;

-- Failures only
SELECT jobname, status, return_message, start_time
FROM cron.job_run_details
WHERE status = 'failed'
ORDER BY start_time DESC
LIMIT 50;
```

For edge-fn-backed crons, also check the function logs in Supabase Studio.
