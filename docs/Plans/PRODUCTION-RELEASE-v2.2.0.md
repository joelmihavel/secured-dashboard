# Production Release Plan: Dev → Main (FINAL)

## Context
Migrate dev branch `v2-backend-dev` to production `main` on Supabase, ship production iOS app via EAS. **Payment app — zero tolerance for failures.**

**Approach**: `supabase db push` (NOT branch merge) + wave-based edge function deployment + EAS binary build.

---

## Backup & Rollback Strategy (No PITR)

PITR is not enabled. Our safety net is a **three-layer approach**:

| Layer | What It Protects | How to Restore |
|-------|-----------------|----------------|
| **1. pg_dump** | Full database snapshot before deployment | `pg_restore` from dump file |
| **2. auth.users backup table** | Phone numbers (riskiest migration target) | `UPDATE auth.users SET phone = b.phone FROM auth_users_phone_backup b WHERE auth.users.id = b.id` |
| **3. Transaction-wrapped phone migration** | Run migration #9 manually inside BEGIN/ROLLBACK | Instant atomic ROLLBACK if phones look wrong |

**Why this is sufficient**:
- Deployment at 2-4 AM IST with zero active payments
- pg_dump captures exact pre-migration state
- The riskiest migration (#9 phone normalization) runs inside a transaction — instant rollback
- All other migrations are additive (new columns, tables, views) — safe and idempotent
- Edge functions can be rolled back by redeploying from pre-release git state

---

## Pre-Flight Fixes (Before Deployment Day)

### PF1. Add `withCashfree` plugin to app.json
**Blocker**: iOS UPI payments won't work without it.
```
rn-app/app.json → plugins array → add: "./plugins/withCashfree"
```

### PF2. Rotate EAS CLI token
Token exposed in git history. Revoke at expo.dev > Account Settings > Access Tokens. Create new token.

### PF3. Fix .gitignore + remove env files from git
```bash
# In both root/.gitignore and rn-app/.gitignore, change pattern:
#   .env.*.local  →  .env.*

git rm --cached rn-app/.env.main rn-app/.env.dev
git commit -m "chore: remove env files from tracking, fix gitignore"
```

### PF4. Fix migration SQL (3 files)

**`20260328100001_add_retrying_payout_status.sql`** — cron.unschedule exception handling:
```sql
-- Replace line 17: SELECT cron.unschedule('settle-to-landlord');
-- With:
DO $$ BEGIN PERFORM cron.unschedule('settle-to-landlord'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
```

**`20260330000001_fix_auth_phone_plus_prefix.sql`** — trigger double-prefix bug:
```sql
-- In sync_phone_columns() trigger, replace:
--   NEW.phone := '+' || NEW.phone_number;
-- With:
NEW.phone := CASE WHEN LEFT(NEW.phone_number, 1) = '+' THEN NEW.phone_number ELSE '+' || NEW.phone_number END;
```

**`20260330100001_add_session_tracking.sql`** — idempotent CREATE POLICY:
```sql
-- Wrap each CREATE POLICY:
DO $$ BEGIN CREATE POLICY "..." ON table ...; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

### PF5. Commit all pre-flight fixes
```bash
git add -A && git commit -m "fix: pre-release migration safety + withCashfree plugin"
```

---

## Phase 1: Freeze & Branch

```bash
# Create release branch from current dev state
git checkout -b release/v2.2.0

# Merge into main
git checkout main
git pull origin main
git merge release/v2.2.0 --no-ff -m "release: v2.2.0"
# DO NOT push main yet — deploy backend first
```

---

## Phase 2: Set Production Secrets

**Two sets of Cashfree keys** — understand the distinction:

| Key Set | Env Vars | Status | Action |
|---------|----------|--------|--------|
| **Secured ID / M360** (identity, OTP) | `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY` | Already PRODUCTION | No change needed |
| **PG** (payments, Easy Split) | `CASHFREE_PG_APP_ID`, `CASHFREE_PG_APP_SECRET` | Currently SANDBOX | **MUST switch to production** |

```bash
PROJECT=uowjtrzmszuaiokqxgir

# Cashfree PG PRODUCTION keys (from ~/Downloads/Cashfree Prod PG Keys.csv)
supabase secrets set CASHFREE_PG_APP_ID=1215890173d25e2c8c44bd2d5380985121 --project-ref $PROJECT
supabase secrets set CASHFREE_PG_APP_SECRET=cfsk_ma_prod_d2b64e1f2a9faca83a225a31d21b6abd_ef188505 --project-ref $PROJECT
supabase secrets set CASHFREE_PG_BASE_URL=https://api.cashfree.com/pg --project-ref $PROJECT

# Cashfree Easy Split / Payouts uses same PG keys — no separate payout keys needed

# CORS + environment (without this, CORS allows localhost in production)
supabase secrets set ENVIRONMENT=production --project-ref $PROJECT

# Secured ID / M360 keys — already production, no change needed:
# CASHFREE_APP_ID (already set)
# CASHFREE_SECRET_KEY (already set)

# Verify all secrets
supabase secrets list --project-ref $PROJECT
```

---

## Phase 3: Verify EAS Environment Variables

Check expo.dev > Project > Environment Variables > **Production** environment:

| Variable | Value |
|----------|-------|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://uowjtrzmszuaiokqxgir.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_c80tL8IG3x46DQhLQ7WKfg_QUgIMI2x` |
| `EXPO_PUBLIC_PAYMENT_GATEWAY` | `cashfree` |
| `EXPO_PUBLIC_CASHFREE_ENV` | `PRODUCTION` |
| `EXPO_PUBLIC_PAYU_KEY` | `PLycrf` |
| `EXPO_PUBLIC_USE_OTP_ROUTING` | `true` |

EAS cloud builds use these, NOT local `.env` files.

---

## Phase 4: Backup (Deploy Day, First Thing)

```bash
# 1. Record UTC timestamp (your restore reference point)
date -u

# 2. Full pg_dump
pg_dump "postgresql://postgres:[PASSWORD]@db.uowjtrzmszuaiokqxgir.supabase.co:5432/postgres" \
  --no-owner --no-acl -F c -f backup_pre_v2.2.0_$(date +%Y%m%d_%H%M%S).dump

# 3. Verify dump integrity
pg_restore --list backup_pre_v2.2.0_*.dump | head -20
```

Then backup auth.users phones via SQL editor:
```sql
CREATE TABLE IF NOT EXISTS public.auth_users_phone_backup AS
SELECT id, phone, raw_user_meta_data->>'phone_number' as phone_number FROM auth.users;
```

---

## Phase 5: Apply Migrations (2-4 AM IST)

### 5.1 Verify zero active payments
```sql
SELECT count(*) FROM payments WHERE status IN ('initiated', 'processing');
-- Must be 0
```

### 5.2 Link and dry-run
```bash
cd "/Users/atrishabh/Documents/Dev/Secured v2-react-native project"
supabase link --project-ref uowjtrzmszuaiokqxgir

supabase db push --dry-run
# Expected: 11 migrations (20260326000003 → 20260330200001)
```

### 5.3 Apply migrations #1-#8 (safe, additive)
Temporarily move migration #9-#11 out:
```bash
mkdir -p /tmp/deferred-migrations
mv supabase/migrations/20260330000001_fix_auth_phone_plus_prefix.sql /tmp/deferred-migrations/
mv supabase/migrations/20260330100001_add_session_tracking.sql /tmp/deferred-migrations/
mv supabase/migrations/20260330200001_expand_risk_mapping.sql /tmp/deferred-migrations/

supabase db push
# Applies migrations #1-#8 only
```

### 5.4 Apply migration #9 (phone normalization) — MANUALLY IN TRANSACTION
This is the riskiest migration. Run it manually via SQL editor with transaction wrapping:

```sql
BEGIN;

-- Paste content of 20260330000001_fix_auth_phone_plus_prefix.sql here
-- (the fixed version with the trigger bug fix from PF4)

-- VERIFY before committing:
SELECT id, phone FROM auth.users WHERE phone IS NOT NULL LIMIT 10;
-- All should start with '+91...' (no '++91', no '91' without '+')

SELECT count(*) FROM auth.users WHERE phone LIKE '++%';
-- Must be 0

-- If good:
COMMIT;
-- If bad:
-- ROLLBACK;
```

Then mark it as applied:
```bash
supabase migration repair --status applied 20260330000001
```

### 5.5 Apply migrations #10-#11
```bash
mv /tmp/deferred-migrations/*.sql supabase/migrations/
supabase db push
# Applies session_tracking + expand_risk_mapping
```

### 5.6 Fee config backwards compatibility fix
Migration #6 (`add_convenience_fee_billing`) seeds Cashfree fee rows as `is_active = true`. The OLD `initiate-payment` function (still running until Phase 6) queries `fee_config` by method only — two active rows per method causes `.maybeSingle()` to fail with PGRST116.

**Fix**: Modify the migration to seed with `is_active = false`:
```sql
-- In 20260329000001_add_convenience_fee_billing.sql, change:
--   ('upi', 0, 'percentage', 'cashfree', true),
-- To:
--   ('upi', 0, 'percentage', 'cashfree', false),
-- (same for all 4 rows)
```

Then AFTER new edge functions deploy (Phase 6), activate them:
```sql
UPDATE fee_config SET is_active = true WHERE gateway = 'cashfree';
```

### 5.7 Verify schema
```sql
-- Cashfree columns
SELECT column_name FROM information_schema.columns
WHERE table_name = 'payments' AND column_name IN ('cf_order_id', 'cf_split_posted', 'convenience_fee_paise');

-- New tables
SELECT tablename FROM pg_tables WHERE tablename IN ('active_sessions', 'revoked_tokens', 'notification_dedup');

-- Cron jobs
SELECT jobname, schedule FROM cron.job
WHERE jobname IN ('settle-to-landlord', 'send-reminders', 'cleanup-expired-sessions');

-- Phone normalization
SELECT count(*) FROM auth.users WHERE phone IS NOT NULL AND phone <> '' AND LEFT(phone, 1) <> '+';
-- Must be 0
```

---

## Phase 6: Deploy Edge Functions

### Wave 1: Webhook receivers FIRST
```bash
PROJECT=uowjtrzmszuaiokqxgir
supabase functions deploy payment-webhook --project-ref $PROJECT --no-verify-jwt
supabase functions deploy cashfree-split-webhook --project-ref $PROJECT --no-verify-jwt
supabase functions deploy cashfree-vendor-webhook --project-ref $PROJECT --no-verify-jwt
```

### Wave 2: Everything else
```bash
supabase functions deploy --project-ref $PROJECT
```

### Clean up dev/debug functions from production
```bash
for fn in dev-seed seed-test-data debug-payment payu-hash-test payu-post-inspector twilio-debug test-gemini-extraction test-cashfree-m360 cf-env-check check-key check-vendor; do
  supabase functions delete $fn --project-ref $PROJECT 2>/dev/null
done
```

### Register Cashfree webhooks (Cashfree merchant dashboard)
1. Payment Events → `https://uowjtrzmszuaiokqxgir.supabase.co/functions/v1/payment-webhook`
2. Split Settlement → `https://uowjtrzmszuaiokqxgir.supabase.co/functions/v1/cashfree-split-webhook`
3. Vendor Status → `https://uowjtrzmszuaiokqxgir.supabase.co/functions/v1/cashfree-vendor-webhook`

```bash
supabase secrets set CASHFREE_WEBHOOK_SECRET=<secret_from_dashboard> --project-ref $PROJECT
```

### Re-link to dev branch (CRITICAL — prevents accidental production pushes)
```bash
supabase link --project-ref zqlowjveyqiagnbmfwsb
```

---

## Phase 7: Build & Release iOS App

```bash
cd rn-app

# Production build (BINARY required — native deps changed)
eas build --profile production --platform ios
```

**Internal test checklist** (on build artifact before App Store):
- [ ] OTP login
- [ ] Dashboard loads
- [ ] Agreement upload + extraction
- [ ] Bank verification (Cashfree PRODUCTION penny drop)
- [ ] UPI payment on iOS (verify withCashfree plugin — PhonePe/PayTM intents)
- [ ] Payment webhook received
- [ ] Waitlist flow
- [ ] Push notifications

```bash
# Submit to App Store (1-3 day review)
eas submit --platform ios --profile production
```

Old app is **100% backwards-compatible** with new backend — no user disruption during review.

---

## Phase 8: Post-Deployment

### Monitoring SQL (run at t+1h, t+4h, t+24h)
```sql
-- Payment health
SELECT status, count(*) FROM payments WHERE created_at > now() - interval '4 hours' GROUP BY status;

-- Stuck payments
SELECT id, status, created_at FROM payments
WHERE status IN ('initiated', 'processing') AND created_at < now() - interval '15 minutes';

-- Cron failures
SELECT jobname, status, return_message FROM cron.job_run_details
WHERE status = 'failed' AND start_time > now() - interval '4 hours' ORDER BY start_time DESC LIMIT 10;

-- Auth health
SELECT count(*) FROM auth.users WHERE last_sign_in_at > now() - interval '4 hours';
```

### Git cleanup
```bash
# Push main to remote
git push origin main

# Merge main back into dev (sync)
git checkout dev
git merge main
git push origin dev

# Clean up deferred migrations temp dir
rm -rf /tmp/deferred-migrations
```

### Drop phone backup table (after 1 week of stable operation)
```sql
DROP TABLE IF EXISTS public.auth_users_phone_backup;
```

---

## Rollback Procedures

### If migrations #1-#8 fail
Forward-fix: write corrective SQL. These are all additive (new columns/constraints) — easy to undo:
```sql
ALTER TABLE payments DROP COLUMN IF EXISTS cf_order_id; -- etc.
```

### If phone migration (#9) fails
Already in a transaction — just `ROLLBACK`. If already committed and phones are corrupted:
```sql
UPDATE auth.users u SET phone = b.phone
FROM public.auth_users_phone_backup b WHERE u.id = b.id;
```

### If edge functions break
Redeploy ALL from pre-release state (shared `_shared/` changed — can't rollback individually):
```bash
git stash
git checkout main~1 -- supabase/functions/
supabase functions deploy --project-ref uowjtrzmszuaiokqxgir
git checkout release/v2.2.0 -- supabase/functions/
git stash pop
```

### If app crashes
- JS bug: `eas update --channel production --message "hotfix"`
- Native crash: new binary build + submit

### Emergency: disable Cashfree payments
```sql
-- If you added the kill switch (PF5 optional):
UPDATE app_config SET value = '{"cashfree_enabled": false, "payu_enabled": true}'::jsonb
WHERE key = 'payment_gateway_config';
```

---

## How Ongoing Changes Fit In

```
You are here (dev, active changes)
    │
    ├── Pre-flight fixes (PF1-PF5)
    ├── git commit
    ├── git checkout -b release/v2.2.0  ← freeze point
    │
    ├── (continue working on dev if needed)
    │
    └── Deploy from release/v2.2.0:
        ├── Secrets → Migrations → Edge Functions → Webhooks
        ├── Build & test iOS app
        ├── Submit to App Store
        └── Merge main → dev (sync back)
```

Any changes you make on dev AFTER cutting the release branch go into the NEXT release. The release branch captures exactly what ships.

---

## Summary Checklist

**Before deployment day:**
- [ ] PF1: Add withCashfree to app.json
- [ ] PF2: Rotate EAS token
- [ ] PF3: Fix .gitignore, remove env files from git
- [ ] PF4: Fix 3 migration SQL files
- [ ] PF5: Commit all fixes
- [ ] Verify EAS production env vars on expo.dev

**Deployment day (2-4 AM IST):**
- [ ] pg_dump backup + auth.users phone backup
- [ ] Verify zero active payments
- [ ] Dry-run migrations
- [ ] Apply migrations #1-#8
- [ ] Run phone migration #9 in transaction, verify, commit
- [ ] Apply migrations #10-#11
- [ ] Verify schema
- [ ] Deploy webhook functions (wave 1)
- [ ] Deploy all functions (wave 2)
- [ ] Delete dev/debug functions from production
- [ ] Register Cashfree webhooks
- [ ] Re-link CLI to dev branch
- [ ] Build production iOS app
- [ ] Internal testing
- [ ] Submit to App Store

**After deployment:**
- [ ] Monitor at t+1h, t+4h, t+24h
- [ ] Push main to remote
- [ ] Merge main → dev
- [ ] Drop phone backup table after 1 week
