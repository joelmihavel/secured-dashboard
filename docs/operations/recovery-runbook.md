# Database recovery runbook

> **Audience:** solo dev when prod data is corrupted (bad migration, bad UPDATE, bad DELETE).
>
> **Last reviewed:** 2026-04-26
>
> **Important constraint:** **Supabase PITR is NOT enabled on this project.** Recovery uses daily backup snapshots (24h granularity, NOT 1-second resolution). Plan accordingly. If you need sub-day RPO, the path is to enable the Supabase PITR add-on (~$100/mo on Pro tier) and rewrite this runbook.

---

## What's actually available

| Mechanism | Granularity | Retention | Available now? |
|---|---|---|---|
| **Daily Supabase backup snapshots** | 1/day | 7 days (Pro tier) | ✅ Yes |
| **Schema rollback via migration `-- rollback:` blocks** | Per-migration | Forever (in git) | ✅ Yes — enforced by `migration-lint` Rule 4 |
| **Manual `pg_dump` snapshots** | On-demand | Wherever you store the file | ✅ Yes — run before risky operations |
| **Supabase PITR (1-second granularity)** | 1s | Up to 28 days | ❌ Not enabled — would require add-on |
| **Read replicas** | Live | Live | ❌ Not configured |

**RPO** (max data you can lose): up to 24h.
**RTO** (time to restore): 30–120 min for full DB restore from a daily snapshot, faster for selective row restore.

---

## When each option is the right answer

| Scenario | Use this | Why |
|---|---|---|
| Bad migration dropped a column with data | Migration `-- rollback:` block first; if data was lost, daily snapshot | Rollback block restores schema; snapshot needed only if column had data and DROP CASCADE fired |
| Bad UPDATE wiped 1000 `payments` rows from minutes ago | Daily snapshot — yesterday's data | Acceptance: 24h of writes between yesterday's snapshot and now will be re-replayed manually if needed |
| Bad DELETE on `audit_logs` (recent rows) | This shouldn't happen — `audit_logs_service_cleanup_only` policy prevents DELETE on non-old rows | If somehow it does, daily snapshot is the only path |
| Bad code deploy returning 500s | Edge function rollback (`gh workflow run rollback.yml -f surface=edge-fns`) | DB isn't corrupted; this is a code issue |
| Bad webhook handler corrupting `payments.status` | Daily snapshot for old corrupt rows; fix code; re-process webhook events from `processed_webhooks` log | The dedup table tells you which events to re-process |
| Storage bucket files (rent agreements) deleted | Not recoverable today (Supabase Storage doesn't retain deleted objects) | Out-of-scope follow-up: enable GCS object versioning |
| Supabase project unhealthy | Restore from daily snapshot or contact Supabase support | Support is the actual escalation path |

---

## Pre-incident: what to do BEFORE you need this runbook

### 1. Verify daily backups are actually running
Supabase dashboard → Project → Database → Backups → confirm last backup is < 24h old. If older, open a support ticket immediately.

### 2. Take a manual snapshot before any risky operation
Before applying a migration that's not idempotent or that has destructive ops:
```bash
# Get connection string from Supabase dashboard → Project Settings → Database
PGPASSWORD=<prod-pass> pg_dump \
  -h db.uowjtrzmszuaiokqxgir.supabase.co \
  -U postgres \
  -d postgres \
  --schema-only \
  > /tmp/prod-schema-pre-migration-$(date +%Y%m%d-%H%M%S).sql

# Or full dump including data (slower, larger):
PGPASSWORD=<prod-pass> pg_dump \
  -h db.uowjtrzmszuaiokqxgir.supabase.co \
  -U postgres \
  -d postgres \
  > /tmp/prod-full-pre-migration-$(date +%Y%m%d-%H%M%S).sql
```
Store the file somewhere durable (encrypted backup drive, your password manager's secure file storage, etc.). Do NOT commit it to git — it's full of PII.

### 3. Document the recovery contact path
- Supabase dashboard → Help → Submit ticket
- Subject: "Recovery from daily backup for project uowjtrzmszuaiokqxgir to <date>"
- Pro-tier response SLA: 24h, faster on critical data-loss
- Alternative for schema-only recovery: dashboard's "Restore Backup" button (may exist depending on tier)

---

## Incident response — restore from daily backup

### Step 1 — assess scope
```sql
-- How much data has changed since the most likely backup time?
-- Daily backups typically run during low-traffic windows (00:00–06:00 UTC for ap-south-1).
-- Assume the most recent backup is from this morning ~02:00 UTC.

-- Count rows that would be affected by a full restore:
SELECT 'payments' AS tbl, count(*) FROM payments WHERE created_at > '2026-04-26 02:00:00+00'
UNION ALL
SELECT 'tenancies', count(*) FROM tenancies WHERE created_at > '2026-04-26 02:00:00+00'
UNION ALL
SELECT 'audit_logs', count(*) FROM audit_logs WHERE created_at > '2026-04-26 02:00:00+00'
UNION ALL
SELECT 'users', count(*) FROM users WHERE created_at > '2026-04-26 02:00:00+00';
```
If this count is non-trivial (more than a handful of rows in `payments`), a full restore loses real user data. Strongly prefer **selective row restore** (Step 3) over full restore (Step 2).

### Step 2 — full DB restore (heavy, last resort)
**Only do this if scope from Step 1 is manageable** (e.g., a Saturday morning incident with no payments yet).

1. Supabase dashboard → Project → Database → Backups
2. Pick the most recent daily backup
3. "Restore" — this REPLACES live DB with the backup. **All writes since the backup are LOST.**
4. Wait 30–120 min for restore to complete. Service may be unavailable during restore.
5. After restore: verify schema and key row counts match expectations.

⚠️ **Take a manual `pg_dump` of the corrupted state BEFORE clicking restore.** If the restore turns out to be wrong, that dump is your only path back to the corrupted-but-known state.

### Step 3 — selective row restore (preferred for partial corruption)
Use when the corruption is bounded (e.g., a bad UPDATE on a known set of payment rows from minutes ago).

1. **Open a Supabase support ticket** asking for a temporary read-only access to the most recent daily backup, OR follow the dashboard "Restore to a new project" path if available on your plan tier.
2. Wait for support to provision (typically 4–24h on Pro tier).
3. Once you have read access to the backup as a separate project/connection:
   ```bash
   # Dump only the affected rows from the backup
   pg_dump -h <backup-host> -U postgres -d postgres \
     --data-only --table=payments \
     --where="payment_id IN ('uuid-1', 'uuid-2', ...)" \
     > /tmp/payments-restore.sql

   # Review the file — confirm it's the rows you expect
   wc -l /tmp/payments-restore.sql
   head -30 /tmp/payments-restore.sql

   # Apply to live prod (manual, with explicit user authorization, NOT via CI)
   PGPASSWORD=<prod-pass> psql -h db.uowjtrzmszuaiokqxgir.supabase.co \
     -U postgres -d postgres < /tmp/payments-restore.sql
   ```

### Step 4 — schema-only revert (when corruption is structural, not row-level)
If the corruption is from a bad migration (column dropped, table renamed, etc.), the migration's `-- rollback:` block is your fast path:

1. Find the bad migration in `supabase/migrations/`
2. Read its `-- rollback:` comment block (every migration has one — Rule 4 of `lint-migrations.mjs`)
3. **DO NOT auto-apply.** Schema reverts can lose data if not designed carefully. Manual review required.
4. Apply via `mcp__supabase__apply_migration` with explicit user authorization, OR via Supabase dashboard SQL editor with the rollback SQL pasted in.

---

## What this runbook does NOT recover

| Asset | Recovery path |
|---|---|
| Edge function source code | `git checkout <pre-incident-tag> -- supabase/functions/<name> && supabase functions deploy <name>` |
| Edge function secrets | `/tmp/prod-fn-secrets.txt` snapshot from Phase 0.6a (run `bash scripts/ops/snapshot-fn-secrets.sh` to refresh) — names only; values come from your password manager / Cashfree / Twilio dashboards |
| GCS Storage objects (rent agreements) | Not currently recoverable — GCS object versioning is NOT enabled on the `rent-agreements` bucket. Out-of-scope follow-up. |
| Cloud Run revisions | `gcloud run services update-traffic --to-revisions=<good-rev>=100` |
| Cron schedules | `cron.job` baseline snapshot at `/tmp/prod-cron-baseline.sql` from Phase 0 |

---

## Cross-references

- Incident response (entry point): [`incident-response.md`](./incident-response.md)
- Migration rollback (when a migration broke schema): [`incident-response.md#p0--migration-broke-prod-schema`](./incident-response.md#p0--migration-broke-prod-schema)
- Audit immutability (which limits arbitrary `audit_logs` writes): `docs/backend/edge-functions.md` and migration `20260425141937_audit_logs_immutability.sql`
- Function secrets recovery: snapshot in `/tmp/prod-fn-secrets.txt` (Phase 0.6a)

---

## If you want to enable PITR later

PITR add-on (Supabase Pro) gives 1-second-granularity recovery for up to 28 days. Cost: ~$100/mo for 7d, scales up for longer windows. To enable:
1. Supabase dashboard → Project → Settings → Add-ons → enable Point-in-Time Recovery
2. Wait ~24h for initial WAL archive to populate
3. Verify by checking `Restore` options now show "Restore to point in time"
4. Update this runbook to reflect PITR capability + remove the "PITR not available" memory

Currently judged unnecessary for the project's risk profile. Revisit if a data-corruption incident makes the 24h RPO unacceptable.
