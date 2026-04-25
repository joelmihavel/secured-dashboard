-- Nightly cron: safety net for fire-and-forget stamp verification triggers
-- that didn't land (e.g. extraction-service container died mid-pipeline,
-- SHCIL was down, etc.).
--
-- Scope: only the last 48h of uploads. Does NOT backfill history — older
-- stuck extractions must be re-verified manually or via the backfill script.
--
-- Depends on:
--   - stamp_verifications table (migration 20260424000001)
--   - invoke_edge_function() helper (migration 20260308000001)
--   - pg_cron + pg_net extensions (already enabled on Flent Secured)

-- ==============================================
-- 1. Straggler-finding RPC
-- ==============================================
-- Returns KA extractions from the last N hours that have no terminal
-- stamp verification row. SECURITY DEFINER because the edge function
-- invokes it with service-role auth anyway, and this centralizes the
-- eligibility logic in the DB rather than scattering it across the edge
-- function and future admin views.

CREATE OR REPLACE FUNCTION find_stamp_verification_stragglers(
  lookback_hours INT DEFAULT 48
) RETURNS TABLE (id UUID, created_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT eri.id, eri.created_at
  FROM extracted_rental_info eri
  WHERE eri.certificate_no IS NOT NULL
    AND eri.property_state ILIKE 'karnataka'
    AND eri.extraction_status = 'completed'
    AND eri.created_at > NOW() - (lookback_hours || ' hours')::interval
    AND NOT EXISTS (
      SELECT 1 FROM stamp_verifications sv
      WHERE sv.extraction_id = eri.id
        AND sv.status IN (
          'verified',
          'mismatch',
          'not_found',
          'unsupported_state',
          'missing_article',
          'missing_fields'
        )
    )
  ORDER BY eri.created_at DESC;
$$;

COMMENT ON FUNCTION find_stamp_verification_stragglers(INT) IS
  'Returns Karnataka extractions in the last N hours that have no terminal stamp verification row. Called by sweep-stamp-verifications edge function.';

REVOKE EXECUTE ON FUNCTION find_stamp_verification_stragglers(INT) FROM anon, authenticated;

-- ==============================================
-- 2. Daily sweep cron
-- ==============================================
-- 03:30 IST = 22:00 UTC. Pg_cron schedules in UTC. This puts the sweep
-- during India's off-hours AND during SHCIL's lightest-load window.

DO $$ BEGIN
  PERFORM cron.unschedule('sweep-stamp-verifications');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'sweep-stamp-verifications',
  '0 22 * * *',
  $$SELECT invoke_edge_function('sweep-stamp-verifications')$$
);
