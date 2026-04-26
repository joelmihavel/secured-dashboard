# Point-in-Time Recovery (PITR) runbook

> **Audience:** solo dev when prod data is corrupted (bad migration, bad UPDATE, bad DELETE).
>
> **Last reviewed:** 2026-04-26 (Phase 0.6b deliverable — rehearsal pending)
>
> **Status:** ⚠️ **Untested.** Per the plan, Phase 0.6b requires a rehearsal: restore prod-at-T-1h to a preview branch, verify schema/row counts, document timing. **Until that rehearsal happens, treat this runbook as design-only.** The numbers below are vendor-documented expectations, not measured outcomes for our project.

PITR is Supabase Pro's "undo button" for data corruption. It restores the database to any timestamp within the retention window (7 days on Pro; 14 on Team). It does **not** restore Storage objects, edge function source, or function secrets — those are recovered separately (see end of doc).

---

## When PITR is the right answer

| Scenario | PITR? | Alternative |
|---|---|---|
| Bad migration dropped a column with data | ✅ Yes | Restore + selectively re-apply correct migration |
| Bad UPDATE wiped 1000 `payments` rows | ✅ Yes | (manually patching is error-prone; PITR is safer) |
| Bad DELETE on `audit_logs` | ✅ Yes (also: this should be impossible after Phase 8c immutability) |
| Bad code deploy returning 500s | ❌ No | Edge function rollback (`gh workflow run rollback.yml -f surface=edge-fns`) |
| Bad webhook handler corrupting `payments.status` | ✅ Yes for data; also fix the code | |
| Storage bucket files deleted | ❌ No (PITR is DB-only) | GCS object versioning / soft-delete (out-of-scope) |
| Function secrets leaked | ❌ No | Rotate via Supabase dashboard; PITR doesn't help |

---

## Pre-flight (do this BEFORE the incident)

These cannot be done during an incident — they're rehearsal artifacts.

### 1. Verify PITR is enabled
Supabase dashboard → Project settings → Backups → Point-in-Time Recovery. On Pro tier, this is on by default with 7-day retention. Confirm last successful WAL archive is < 5min old.

### 2. Snapshot expected restore behavior (rehearsal)
```bash
# At a calm time, pick a timestamp 1h ago.
# Use Supabase dashboard's PITR tool to restore to a preview branch
# (NOT the live project — a preview branch is an isolated clone).

# Document:
# - Time from "Restore" click → preview branch ready
# - Schema match between live prod and restored snapshot (use mcp__supabase__list_tables on both)
# - Row count match within the 1h window for `payments`, `audit_logs`, `users`, `tenancies`

# Delete the preview branch when done — preview branches cost compute hours.
```

### 3. Document the recovery contact path
- Open Supabase dashboard → Help → Submit ticket
- Subject: "PITR restore for project uowjtrzmszuaiokqxgir to <ISO-timestamp>"
- Pro-tier response SLA: 24h (best-effort faster on critical data-loss incidents)
- Alternative: dashboard self-serve PITR may work without ticket

---

## Incident response — restore prod to a preview branch (recommended)

The safest pattern: **restore to a preview branch first, validate, then promote.** Direct in-place restore is supported but risks losing in-flight writes.

### Step 1 — identify recovery target timestamp
```sql
-- Inside the prod DB (still accessible as root, via Supabase dashboard SQL editor):
-- Find the bad statement timestamp from `audit_logs`:
SELECT created_at, event_type, target_table, actor
FROM audit_logs
WHERE created_at > now() - interval '2 hours'
  AND event_type IN ('migration_apply', 'bulk_update', 'admin_action')
ORDER BY created_at DESC
LIMIT 20;
```

Pick a timestamp **5–15 min before** the bad event. PITR resolution is 1-second on Supabase Pro.

### Step 2 — initiate PITR to a preview branch
Supabase dashboard → Project → Branching → "Create preview branch from PITR snapshot"
- Source: `uowjtrzmszuaiokqxgir` (prod)
- Restore point: `<ISO-timestamp>` (e.g. `2026-04-26T18:23:00Z`)
- Branch name: `incident-<date>-<slug>` (e.g. `incident-20260426-payments-corruption`)

Expected timing: **30–90 min for restore to complete** depending on DB size. Watch the branch's status in the dashboard.

### Step 3 — validate restored state
Once the preview branch is ready:

```bash
# Get the preview branch's connection string from the dashboard
PREVIEW_DB_URL="postgresql://postgres:<pass>@<branch-host>.supabase.co:5432/postgres"

# 1. Schema fingerprint match
PROD_SCHEMA=$(supabase db dump --schema-only --project-ref uowjtrzmszuaiokqxgir | sha256sum)
PREVIEW_SCHEMA=$(pg_dump --schema-only "$PREVIEW_DB_URL" | sha256sum)
echo "Prod : $PROD_SCHEMA"
echo "Preview: $PREVIEW_SCHEMA"
# Should differ by exactly the bad migration if that's the cause

# 2. Row count match for critical tables
psql "$PREVIEW_DB_URL" -c "SELECT 'payments' tbl, count(*) FROM payments
                          UNION ALL
                          SELECT 'audit_logs', count(*) FROM audit_logs
                          UNION ALL
                          SELECT 'tenancies', count(*) FROM tenancies
                          UNION ALL
                          SELECT 'users', count(*) FROM users;"

# 3. Spot-check the corrupted data is healed
# (Specific to incident — e.g. for a bad UPDATE that wiped statuses):
psql "$PREVIEW_DB_URL" -c "SELECT status, count(*) FROM payments WHERE created_at > now() - interval '7 days' GROUP BY 1;"
```

### Step 4 — choose intervention strategy

**Option A — full DB swap (heavy, last resort).** Promote the preview branch to replace prod. Loses any writes between restore-point and now. Only viable if those writes are also bad (e.g. bad migration kept running for 30min).

**Option B — selective row-level restore (most common).** Export specific rows from preview, import to prod:
```bash
# Example: restore the 1,234 payment rows wiped by bad UPDATE
pg_dump "$PREVIEW_DB_URL" \
  --data-only --table=payments \
  --where="payment_id IN (SELECT payment_id FROM payments WHERE updated_at > '<bad-update-timestamp>')" \
  > /tmp/payments-restore.sql

# Review the file before applying — confirm it's the rows you expect
wc -l /tmp/payments-restore.sql
head -30 /tmp/payments-restore.sql

# Apply to prod (manual, with explicit user authorization, NOT via CI)
PGPASSWORD=<prod-pass> psql "$PROD_DB_URL" < /tmp/payments-restore.sql
```

**Option C — schema-only revert.** If the corruption is a bad migration (not bad data), copy the schema diff from preview to prod:
```bash
# Generate a diff migration
supabase db diff --linked --use-migra --schema public > /tmp/recovery-migration.sql

# Review carefully — this becomes a new migration committed to git
# Apply via mcp__supabase__apply_migration with explicit user authorization
```

### Step 5 — clean up
- Delete the preview branch from the dashboard (compute cost)
- File a post-mortem in `docs/security/incidents/`
- If the recovery touched `audit_logs` (against immutability policy from Phase 8c), document the override + rationale

---

## In-place PITR restore (NOT recommended, only if branching unavailable)

Supabase supports restoring the live project in-place, but this:
- Loses ALL writes between restore-point and "now" (no undo)
- Causes downtime during restore (30–90 min)
- Cannot be reversed except by another PITR

Use only if:
- Preview-branch path is failing (branching unavailable)
- You're confident no good writes occurred since corruption

```
Supabase dashboard → Project → Backups → "Restore in place" → confirm timestamp
```

⚠️ Solo-dev safety check: do NOT do this without first taking a manual `pg_dump` of the current (corrupted) state, in case the recovery target turns out to be wrong.

---

## What PITR doesn't recover

| Asset | Recovery path |
|---|---|
| Edge function source code | `git checkout <pre-incident-tag> -- supabase/functions/<name> && supabase functions deploy <name>` |
| Edge function secrets | `/tmp/prod-fn-secrets.txt` snapshot from Phase 0.6a — manually re-set via `supabase secrets set` |
| GCS Storage objects (rent agreements) | GCS object versioning (NOT currently enabled — out-of-scope follow-up) |
| Cloud Run revisions | `gcloud run services update-traffic --to-revisions=<good-rev>=100` |
| Cron schedules | `cron.job` baseline snapshot at `/tmp/prod-cron-baseline.sql` from Phase 0 |

---

## Recovery time objective (RTO) / point objective (RPO)

| Metric | Target | Measured |
|---|---|---|
| RPO (max data loss) | 5 seconds (WAL archival lag) | Untested — pending Phase 0.6b rehearsal |
| RTO preview-branch path | 90 min | Untested — pending rehearsal |
| RTO selective row restore | 5–15 min after preview branch ready | Untested |
| RTO in-place restore | 30–90 min | Untested |

**Action item:** schedule the Phase 0.6b rehearsal once Phase 5 CI/CD soak window completes. Replace the "Untested" rows above with measured numbers.

---

## Cross-references

- Incident response (entry point): [`incident-response.md`](./incident-response.md)
- Migration rollback (when PITR is overkill): [`incident-response.md#p0--migration-broke-prod-schema`](./incident-response.md#p0--migration-broke-prod-schema)
- Audit immutability (which limits arbitrary `audit_logs` writes): `docs/backend/edge-functions.md` and migration `20260425141937_audit_logs_immutability.sql`
- Function secrets recovery: snapshot in `/tmp/prod-fn-secrets.txt` (Phase 0.6a)
