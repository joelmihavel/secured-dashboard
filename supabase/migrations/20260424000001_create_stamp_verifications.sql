-- Stamp certificate verification log.
--
-- One row per verification attempt against SHCIL's e-Stamp portal
-- (shcilestamp.com) for a given extracted_rental_info row. Multiple rows
-- per extraction are expected (retries after captcha failure, manual
-- re-verification from admin app).
--
-- Status values:
--   pending           — row created, background job not yet run
--   verified          — SHCIL returned a cert AND all critical fields match extraction
--   mismatch          — SHCIL returned a cert BUT critical fields differ
--   not_found         — SHCIL reports no such certificate
--   captcha_failed    — 2Captcha solved wrong or SHCIL redirected to login
--   site_error        — SHCIL 5xx / timeout / unexpected HTML
--   unsupported_state — state not yet mapped to SHCIL dropdown (non-Karnataka for v1)
--   missing_article   — could not extract article number from description_of_document
--   missing_fields    — extraction row lacks cert_no/state/issue_date to even try

CREATE TABLE IF NOT EXISTS stamp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  extraction_id UUID NOT NULL
    REFERENCES extracted_rental_info(id) ON DELETE CASCADE,

  attempt_number INT NOT NULL DEFAULT 1,

  status TEXT NOT NULL
    CHECK (status IN (
      'pending',
      'verified',
      'mismatch',
      'not_found',
      'captcha_failed',
      'site_error',
      'unsupported_state',
      'missing_article',
      'missing_fields'
    )),

  -- What we sent to SHCIL (captured for debugging / audit).
  shcil_state_code TEXT,
  shcil_article_code TEXT,
  shcil_article_number TEXT,

  -- What SHCIL returned. All nullable — populated only on verified/mismatch.
  shcil_certificate_no TEXT,
  shcil_certificate_issued_date TIMESTAMPTZ,
  shcil_account_reference TEXT,
  shcil_unique_doc_reference TEXT,
  shcil_purchased_by TEXT,
  shcil_description_of_document TEXT,
  shcil_property_description TEXT,
  shcil_first_party TEXT,
  shcil_second_party TEXT,
  shcil_stamp_duty_paid_by TEXT,
  shcil_consideration_price_paise BIGINT,
  shcil_stamp_duty_amount_paise BIGINT,

  -- Mismatches found when comparing SHCIL data vs extracted_rental_info.
  -- Shape: [{field, extracted, shcil, severity}]
  field_mismatches JSONB,

  -- Failure diagnostics.
  error_code TEXT,
  error_message TEXT,

  -- Observability.
  captcha_solve_ms INT,
  total_duration_ms INT,

  -- Kept for debugging classifier edge cases. Truncated at 64KB by the service.
  raw_response_excerpt TEXT,

  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookups: latest verification per extraction (admin views, pipeline idempotency).
CREATE INDEX IF NOT EXISTS idx_stamp_verifications_extraction
  ON stamp_verifications (extraction_id, created_at DESC);

-- Admin dashboards filter by status + recency.
CREATE INDEX IF NOT EXISTS idx_stamp_verifications_status_recent
  ON stamp_verifications (status, created_at DESC);

-- At most one VERIFIED row per extraction — prevents double-counting and
-- makes "is this extraction verified?" a cheap unique-index hit.
CREATE UNIQUE INDEX IF NOT EXISTS idx_stamp_verifications_verified_unique
  ON stamp_verifications (extraction_id)
  WHERE status = 'verified';

-- Service-role only. Users never read this table directly; the admin app
-- reads it via a JOIN from extracted_rental_info through a service-role call.
ALTER TABLE stamp_verifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'stamp_verifications_service_role'
  ) THEN
    CREATE POLICY stamp_verifications_service_role
      ON stamp_verifications
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE stamp_verifications IS
  'Log of SHCIL e-Stamp verification attempts. One row per attempt; latest row per extraction wins. Populated by stamp-verification-service Cloud Run app.';
