# Stamp Verification — SHCIL e-Stamp Pipeline

The stamp verification pipeline cross-checks the e-Stamp certificate referenced in a rent agreement against SHCIL's official portal (`shcilestamp.com`). Shipped in production 2026-04-24 (migrations `20260424000001`–`20260424000004` + `stamp-verification-service-prod` Cloud Run).

> **Last reviewed:** 2026-04-25
>
> **Service source code lives outside this repo.** `stamp-verification-service-{prod,dev}` was deployed via image-reuse (see `docs/ENVIRONMENT_INFRASTRUCTURE.md` § Cloud Run Services). To rebuild from source, you need access to wherever the stamp service code is owned.

## Why we built it

Indian rental agreements require a stamp paper purchased from SHCIL (Stock Holding Corporation of India Ltd) for amounts above ₹100. The stamp certificate has a unique number and metadata (issuance date, parties, consideration amount). Tenants sometimes upload agreements with forged or invalid stamps. Verifying against SHCIL's portal catches these before payouts start flowing.

For v1, only Karnataka (KA) is supported (the only state we've mapped SHCIL's article-number dropdown for). Other states return `unsupported_state`.

## High-level flow

```
extracted_rental_info row created (extraction_status='completed')
   │
   │  Cloud Run extraction-service finalize step (or sweep cron)
   │  fires-and-forgets a call to stamp-verification-service
   ▼
stamp-verification-service (Cloud Run, asia-south1)
   │
   │  1. Resolves SHCIL state code + article number from extracted fields
   │  2. Solves SHCIL captcha via 2Captcha API
   │  3. Submits the verification form via ZenRows (anti-bot bypass)
   │  4. Parses SHCIL response → extracts stamp certificate fields
   │  5. Compares SHCIL fields vs extracted_rental_info fields
   │  6. Inserts row into stamp_verifications with status
   ▼
trg_sync_stamp_verification (DB trigger)
   │
   │  Mirrors latest status onto extracted_rental_info.stamp_verification_*
   │  → admin app reads via v_user_funnel without a join
   ▼
sweep-stamp-verifications cron (03:30 IST daily)
   │
   │  Catches fire-and-forget triggers that didn't land — last 48h scope
```

## Schema

### `stamp_verifications` (migration 20260424000001)

One row per verification attempt. Multiple attempts per extraction are expected (retries on captcha failure, manual re-verification from admin app).

| Column | Type | Purpose |
|---|---|---|
| `id` | UUID | Primary key |
| `extraction_id` | UUID FK → `extracted_rental_info(id)` ON DELETE CASCADE | What we're verifying |
| `attempt_number` | INT | Monotonic per extraction. Latest attempt wins for the denormalized status. |
| `status` | TEXT (CHECK constraint) | One of: `pending`, `verified`, `mismatch`, `not_found`, `captcha_failed`, `site_error`, `unsupported_state`, `missing_article`, `missing_fields` |
| `shcil_state_code` / `shcil_article_code` / `shcil_article_number` | TEXT | What we sent to SHCIL — captured for debugging |
| `shcil_certificate_no`, `shcil_certificate_issued_date`, `shcil_account_reference`, `shcil_unique_doc_reference`, `shcil_purchased_by`, `shcil_description_of_document`, `shcil_property_description`, `shcil_first_party`, `shcil_second_party`, `shcil_stamp_duty_paid_by`, `shcil_consideration_price_paise`, `shcil_stamp_duty_amount_paise` | TEXT / TIMESTAMPTZ / BIGINT | What SHCIL returned. Nullable — only populated on `verified` / `mismatch`. |
| `field_mismatches` | JSONB | `[{field, extracted, shcil, severity}]` — populated when status='mismatch' |
| `error_code`, `error_message` | TEXT | Failure diagnostics |
| `captcha_solve_ms`, `total_duration_ms` | INT | Observability |
| `raw_response_excerpt` | TEXT | First 64KB of raw SHCIL HTML — kept for debugging classifier edge cases |
| `verified_at` | TIMESTAMPTZ | Set on terminal status |
| `created_at` | TIMESTAMPTZ DEFAULT NOW() | |

Indexes:
- `idx_stamp_verifications_extraction (extraction_id, created_at DESC)` — latest verification per extraction
- `idx_stamp_verifications_status_recent (status, created_at DESC)` — admin "show me all mismatches from last week"
- `idx_stamp_verifications_verified_unique (extraction_id) WHERE status='verified'` — UNIQUE; prevents double-counting verified attempts

### `extracted_rental_info` denormalized columns (migration 20260424000003)

The trigger `trg_sync_stamp_verification` mirrors the latest status onto the parent row so the RN app and admin can read without a JOIN:

- `stamp_verification_status` — latest status from `stamp_verifications`
- `stamp_verification_attempt` — monotonic; the trigger only writes if the new attempt is ≥ existing
- `stamp_verified_at` — verification timestamp
- `stamp_verification_updated_at` — when the trigger fired

Partial index `idx_extracted_rental_info_stamp_status` covers `(stamp_verification_status, stamp_verification_updated_at DESC) WHERE stamp_verification_status IS NOT NULL` — keeps the index small by skipping the majority of pre-verification rows.

### `v_user_funnel` extension (migration 20260424000004)

Added 3 stamp columns to the existing admin funnel view: `stamp_verification_status`, `stamp_verified_at`, `stamp_verification_attempt`. Pure additive — no existing columns removed or renamed.

## Status semantics

| Status | When | Admin action |
|---|---|---|
| `pending` | Row inserted, background job not yet run | None — wait for sweep cron |
| `verified` | SHCIL returned a cert AND all critical fields match extraction | Auto-approve preflight pass |
| `mismatch` | SHCIL returned a cert BUT critical fields differ (party names, issue date, consideration amount) | Manual review; check `field_mismatches` |
| `not_found` | SHCIL says no such certificate exists | Investigate — likely a forgery or extraction error |
| `captcha_failed` | 2Captcha solved wrong or SHCIL redirected to login | Manual re-verification via admin app |
| `site_error` | SHCIL 5xx / timeout / unexpected HTML | Retry — SHCIL is flaky |
| `unsupported_state` | State not yet mapped to SHCIL dropdown (non-Karnataka for v1) | Skip — not a verification failure |
| `missing_article` | Could not extract article number from `description_of_document` | Manual review — extraction issue |
| `missing_fields` | Extraction row lacks `cert_no` / `state` / `issue_date` to even try | Block; user must re-upload |

## Cloud Run service

| Item | Value |
|---|---|
| Service name | `stamp-verification-service-prod` (and `-dev`) |
| Region | `asia-south1` |
| GCP project | `secured-by-flent` |
| Image registry | `asia-south1-docker.pkg.dev/secured-by-flent/cloud-run-source-deploy/stamp-verification-service-prod` |
| Memory / CPU / timeout | 2Gi / 2 / 300s / concurrency 1 |
| Env vars | `NODE_ENV`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TWOCAPTCHA_API_KEY`, `VERIFICATION_SECRET`, `ZENROWS_API_KEY` |
| Auth into the service | `--no-allow-unauthenticated` + per-request `x-verification-secret` header |
| Caller | `extraction-service-{prod,dev}` Cloud Run + `sweep-stamp-verifications` edge fn |

The `stamp-verification-service-dev` was deployed by image-reuse from prod's revision 6 (the source isn't in this repo). See `docs/ENVIRONMENT_INFRASTRUCTURE.md` § Cloud Run Services for the deploy command.

## Cron sweep

Migration `20260424000002` schedules `sweep-stamp-verifications` cron daily at 03:30 IST:

```sql
SELECT cron.schedule(
  'sweep-stamp-verifications',
  '0 22 * * *',
  $$SELECT invoke_edge_function('sweep-stamp-verifications')$$
);
```

The `find_stamp_verification_stragglers(lookback_hours)` SQL helper returns Karnataka extractions in the last N hours that have no terminal stamp verification row. The edge fn iterates these and re-fires the verification.

## Failure modes worth knowing

- **2Captcha rate limits during business hours.** Captcha solves can spike to 60s+ when 2Captcha is busy. Status: `captcha_failed` → admin re-runs manually.
- **SHCIL portal flakiness.** Their site goes down for hours at a time. `site_error` = retry next day.
- **SHCIL session expiry.** They redirect to login if our captcha solve attempt looks bot-like. The ZenRows wrapper helps but doesn't eliminate this. Manifests as `captcha_failed` (we redirect-detect at the response parser).
- **Article number extraction.** SHCIL's verification form needs the article number from `description_of_document`. Gemini extraction sometimes misses this. `missing_article` = extraction needs review.

## Reading verification status from RN

Mobile app reads `extracted_rental_info` directly via `getExtractedAgreementData()` in `rn-app/src/services/api/agreement.ts`. To surface the stamp status to the user, select `stamp_verification_status` + `stamp_verified_at` from the row. The denormalized columns mean no JOIN needed.

For the v1 release, the RN app does NOT display stamp status to users — it's an admin-only signal feeding the approval preflight. The `useExtractionStatus` hook may surface it later.

## Reading from admin app

`v_user_funnel` exposes the stamp columns at the user level. Filter by status for triage:

```sql
SELECT user_id, name, extraction_id, stamp_verification_status, stamp_verified_at
FROM v_user_funnel
WHERE stamp_verification_status IN ('mismatch','not_found')
ORDER BY agreement_uploaded_at DESC;
```

For full mismatch detail, JOIN to `stamp_verifications`:

```sql
SELECT sv.*
FROM stamp_verifications sv
JOIN extracted_rental_info eri ON eri.id = sv.extraction_id
WHERE sv.status = 'mismatch'
  AND eri.user_id = '...'
ORDER BY sv.created_at DESC;
```
