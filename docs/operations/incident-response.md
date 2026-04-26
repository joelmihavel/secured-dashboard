# Incident response runbook

> **Audience:** solo dev (`@atrishabh-flent`) on call. Designed to be runnable at 2am with minimal cognitive load.
>
> **Last reviewed:** 2026-04-26 (Phase 5 deliverable)

This runbook covers the recurring failure modes for Flent Secured prod. Each section has a **detection signal**, a **first action**, and a **rollback verb** that takes < 5 minutes (worst case for code-only rollbacks; native rebuilds via EAS are 24–48h).

The single mental model: **every prod surface has one rollback verb.** No "panic and revert in dashboard" — every workflow is captured below.

---

## Surface map (rollback verbs at a glance)

| Surface | Rollback verb | Time-to-revert |
|---|---|---|
| Cloud Run (extraction / stamp-verification) | `gh workflow run rollback.yml -f surface=cloud-run -f revision_or_sha=<prev-revision> -f confirm=ROLLBACK` | 60s |
| Edge functions | `gh workflow run rollback.yml -f surface=edge-fns -f revision_or_sha=<sha> -f confirm=ROLLBACK` | 60–120s |
| Migrations (schema rollback) | Print `-- rollback:` block from migration file → manually apply via `supabase db query` | 5–15 min (manual review required) |
| Mobile (OTA) | `eas update --branch production --republish --group <prev-group-id>` | 5 min |
| Mobile (native, PayU SDK / native deps) | Full EAS rebuild + store re-submit | 24–48h |
| Supabase project (data corruption) | Daily snapshot — see `recovery-runbook.md` | 30–120 min (Supabase support; PITR is NOT enabled — RPO ≤24h) |
| Vercel (admin-app) | Vercel dashboard → Deployments → "Promote previous" | 60s |

---

## P0 — Payments broken in prod

**Detection signals:**
- `synthetic-prod-health.yml` alert (5-min cron) — see issue auto-filed by workflow
- User support tickets ("payment failed" cluster)
- Cashfree dashboard error rate spike
- `payments.status='failed'` rate exceeds baseline 10x in last 1h:
  ```sql
  SELECT date_trunc('hour', created_at), status, count(*)
  FROM payments WHERE created_at > now() - interval '6 hours'
  GROUP BY 1, 2 ORDER BY 1 DESC;
  ```

**First action: verify which gateway is active.** The killswitch is in `app_config.payment_gateway`:
```sql
SELECT value FROM app_config WHERE key = 'payment_gateway';
```

**If Cashfree is down (vendor-side outage):**
1. Confirm Cashfree status page: https://status.cashfree.com
2. Flip killswitch to PayU (assumes PayU still active per Phase P sequencing):
   ```sql
   UPDATE app_config
   SET value = jsonb_set(
     jsonb_set(value, '{primary}', '"payu"'),
     '{reason}', '"cashfree-outage-<incident-id>"'
   ),
   updated_at = NOW()
   WHERE key = 'payment_gateway';
   ```
   ⚠️ Phase 3.5b is currently **observe-only** — server response is logged but client still chooses gateway. Until 3.5c lands, the killswitch is informational. Real flip requires OTA update.
3. Watch payment success rate return to baseline (15-min window).
4. File an incident doc in `docs/security/incidents/` post-mortem.

**If our code is broken (regression in initiate-payment):**
1. Find the bad SHA — check recent merges to `main`:
   ```bash
   gh pr list --state merged --limit 5
   ```
2. Rollback the edge function:
   ```bash
   gh workflow run rollback.yml -f surface=edge-fns -f revision_or_sha=<good-sha> -f confirm=ROLLBACK
   ```
3. Watch logs:
   ```bash
   supabase functions logs initiate-payment --project-ref uowjtrzmszuaiokqxgir --tail
   ```

**Recovery verification:**
- Manual test payment in production (₹1) — all four statuses cycle correctly
- Cashfree webhook fires + `payments` row updates within 60s
- `synthetic-prod-health.yml` resolves the auto-filed issue

---

## P0 — Cloud Run extraction down

**Detection signals:**
- `synthetic-prod-health.yml` `/health` probe failure
- Edge function `extraction-recovery` invocation rate spikes (means clients are retrying)
- `extracted_rental_info` insert rate drops to zero in last 30min

**First action — check service health:**
```bash
gcloud run services describe extraction-service-prod \
  --region asia-south1 --project secured-by-flent \
  --format='value(status.conditions[0].status,status.conditions[0].message)'
```

**If a recent deploy is the cause:**
1. List revisions:
   ```bash
   gcloud run revisions list --service extraction-service-prod \
     --region asia-south1 --project secured-by-flent --limit 5
   ```
2. Roll back traffic:
   ```bash
   gh workflow run rollback.yml -f surface=cloud-run \
     -f revision_or_sha=<previous-revision-name> -f confirm=ROLLBACK
   ```
   Or directly:
   ```bash
   gcloud run services update-traffic extraction-service-prod \
     --region asia-south1 --to-revisions=<prev-revision>=100
   ```

**If the issue is upstream (Document AI / Vertex AI region outage):**
1. Check GCP status: https://status.cloud.google.com
2. Vertex AI fallback path already exists in `extraction-pipeline.ts` — Gemini handles when DocAI fails
3. If both DocAI + Vertex are down, queue extractions: set `extraction_status='queued'` on incoming uploads, replay later via `extraction-recovery` cron

**Recovery verification:**
- `curl <service-url>/health` returns 200
- Test agreement upload extracts successfully
- `extracted_rental_info` row count resumes

---

## P0 — Migration broke prod schema

**Detection signals:**
- Schema fingerprint check in `_reusable-supabase.yml` failed post-deploy
- Post-deploy queries return errors / 5xx burst on edge functions
- `pg_dump --schema-only | sha256sum` doesn't match expected hash

**First action — DO NOT auto-rollback migrations.** Schema reverts can lose data. Manual review required.

1. Find the problematic migration:
   ```bash
   ls -t supabase/migrations/ | head -3
   ```
2. Read its `-- rollback:` block (every migration has one — enforced by Rule 4 of `lint-migrations.mjs`).
3. **If the rollback is a pure DROP (column/table/policy), apply via `mcp__supabase__apply_migration` with explicit user authorization:**
   ```bash
   # Example:
   echo "DROP POLICY IF EXISTS audit_logs_service_all_v2 ON audit_logs;" \
     > supabase/migrations/$(date +%Y%m%d%H%M%S)_rollback_<original>.sql
   git commit -am "rollback: <migration-name>"
   gh workflow run deploy-prod-trigger.yml
   ```
4. **If the rollback involves data preservation (e.g., column drop with prior backfill), engage extreme caution:** open Supabase dashboard, do a manual backup snapshot first, then apply rollback under monitored conditions.

**If schema is partially applied (some files succeeded, others failed):**
- This is the worst case. With daily-only backups (no PITR), restore loses up to 24h of writes — manual reconciliation may still be needed.
- See `recovery-runbook.md` for the daily-backup-snapshot recovery flow (selective row restore preferred over full restore).

---

## P1 — Webhook signature failures

**Detection signals:**
- `cashfree-pg-webhook` / `cashfree-vendor-webhook` / `cashfree-split-webhook` 401 rate spike
- Supabase function logs: `[cashfree-*] signature verification failed`

**First action — check secret name + value:**
```bash
supabase secrets list --project-ref uowjtrzmszuaiokqxgir | grep -i cashfree
```

Expected secrets:
- `CASHFREE_PG_APP_ID` + `CASHFREE_PG_SECRET_KEY` (PG callbacks)
- (No separate webhook secrets — Cashfree only supports one merchant-wide signing key, the PG Client Secret. All webhooks sign with `CASHFREE_PG_APP_SECRET`.)

**Common causes:**
1. **Cashfree dashboard rotated the signing key** without us updating Supabase secrets → fix: copy new secret from Cashfree merchant portal → `supabase secrets set CASHFREE_*=<new>`
2. **Replay attack** — check `payment_webhook_events` table for duplicate `event_id`. The replay-defense table catches these silently (`ON CONFLICT DO NOTHING`).
3. **Stale timestamp** — webhook handlers reject events > 5min old. Cashfree retries beyond that window are expected to 4xx.

**If the bug is in our code (e.g., wrong env var name):**
- See `docs/backend/cashfree-integration.md` "Webhook secrets" — Cashfree signs all webhooks with the merchant-wide `CASHFREE_PG_APP_SECRET`. Rotate that key in the Cashfree dashboard + Supabase secrets, then watch logs for 24h.

---

## P1 — Auth (OTP) broken

**Detection signals:**
- `synthetic-prod-health.yml` `auth-otp` probe failure
- User support: "I can't log in"
- `auth-otp` function logs: 5xx burst

**First action — check Twilio status + balance:**
```bash
# Manually via Twilio console (no CLI for this)
# Verify: account balance > 0, no service degradation alerts
```

**If Twilio is up but our function is failing:**
1. Roll back `auth-otp` if recent deploy:
   ```bash
   gh workflow run rollback.yml -f surface=edge-fns -f revision_or_sha=<prev-sha> -f confirm=ROLLBACK
   ```
2. Check rate limits — `auth-otp` enforces per-phone throttling. Sudden traffic spike could exhaust the limit.

**If Twilio routing is broken (regional outage):**
- No fallback configured currently (out-of-scope follow-up). Document as known gap.

---

## Filing an incident doc

After resolution, file a post-mortem:

```bash
DATE=$(date +%Y-%m-%d)
SLUG=<short-description>
mkdir -p docs/security/incidents
cat > "docs/security/incidents/${DATE}-${SLUG}.md" <<EOF
# Incident: <title>

**Date:** ${DATE}
**Duration:** <start> → <resolved>
**Surfaces affected:** <e.g. payments, extraction>
**Detected by:** <synthetic / user report / monitoring>
**Resolution:** <one sentence>

## Timeline

- HH:MM — Detection signal fired
- HH:MM — First action taken
- HH:MM — Service restored
- HH:MM — Verification passed

## Root cause

<technical detail>

## What worked

- <e.g. rollback verb fired in 60s>

## What didn't

- <e.g. detection took 12 min — should have been < 5>

## Action items

- [ ] <follow-up that prevents recurrence>
EOF
```

---

## Standing list of "do NOT do during incident"

- **Do NOT force-push to main.** Use `gh workflow run rollback.yml` instead — it preserves history and audit trail.
- **Do NOT bypass branch protection** ("admin override" on PR merge). The required checks are there to catch the second incident triggered by panicked first-incident response.
- **Do NOT commit secrets to fix incident.** Always go through Supabase / GCP Secret Manager / EAS env, even at 2am.
- **Do NOT disable RLS to "unblock"** a query. RLS is the only thing keeping `payments` and `audit_logs` tenant-isolated.
- **Do NOT auto-apply migration rollback.** Rule from Phase 5 — manual review required for schema rollbacks.

---

## Emergency contacts (in priority order)

| Service | Channel |
|---|---|
| Supabase support | dashboard ticket — Pro tier 24/7 |
| Cashfree support | merchant.support@cashfree.com / dashboard |
| GCP support | console — Standard tier (response < 4h) |
| Twilio | console — pay-as-you-go |
| Apple developer (TestFlight / store) | developer.apple.com — 1–3 day response |

---

## Where to find the dashboard URLs

- Supabase: https://supabase.com/dashboard/project/uowjtrzmszuaiokqxgir
- GCP Cloud Run: https://console.cloud.google.com/run?project=secured-by-flent
- Cashfree: https://merchant.cashfree.com
- Vercel (admin-app): https://vercel.com/dashboard
- GitHub Actions: https://github.com/flent-homes/Secured-v2/actions
