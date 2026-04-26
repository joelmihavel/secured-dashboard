-- Audit log immutability — Phase 8c of cleanup plan.
--
-- Background:
--   `audit_logs` currently has a single service-role policy
--   (`audit_logs_service_all`) that grants ALL operations: INSERT, SELECT,
--   UPDATE, DELETE. For a fintech with RBI / DPDP audit requirements,
--   this is too permissive — any code path running as service_role can
--   silently rewrite or wipe audit trail.
--
-- This migration replaces the single ALL policy with separate policies
-- per command, scoped to match exactly what production needs:
--
--   INSERT   service_role only (edge functions writing audit rows)
--   SELECT   service_role + authenticated (existing user-select policy preserved)
--   UPDATE   nobody — audit rows are immutable. To correct an audit row,
--            insert a new row with action_category='audit_correction'
--            referencing the original via entity_id.
--   DELETE   service_role, BUT only matching the cleanup cron's pattern:
--            rows older than 1 year AND not in ('payment','security') categories.
--            This means:
--              - The existing `cleanup-audit-logs` cron continues to work
--              - Ad-hoc DELETE of recent rows is blocked (silently no-ops)
--              - Payment + security audit rows are NEVER deletable per the
--                RBI 7-year retention pattern (informally — official policy TBD)
--
-- Verification before this migration:
--   SELECT count(*) FROM cron.job WHERE command LIKE '%audit_logs%';  -- 1 (cleanup-audit-logs)
--   grep UPDATE audit_logs in supabase/functions/ → none in code
--   grep DELETE audit_logs in supabase/functions/ → only the cleanup cron's pattern
--
-- @safe-destructive: replaces overly-broad policy with stricter set;
--   net effect is immutability + cron preservation. No data lost.
-- @rls-review: restricts service_role from arbitrary UPDATE/DELETE on
--   audit_logs. Preserves cleanup cron's specific DELETE pattern.
--   Paired test under supabase/tests/policies/ — TBD; tracking in plan.

-- Drop the broad ALL policy
DROP POLICY IF EXISTS audit_logs_service_all ON audit_logs;

-- @rls-review: INSERT — service_role only. Edge functions writing audit rows.
CREATE POLICY audit_logs_service_insert
  ON audit_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- @rls-review: SELECT — service_role can read all rows (existing
--   audit_logs_user_select policy continues to scope authenticated reads).
CREATE POLICY audit_logs_service_select
  ON audit_logs
  FOR SELECT
  TO service_role
  USING (true);

-- @rls-review: DELETE — service_role can only delete rows that match the
--   cleanup-audit-logs cron's exact criteria. This keeps the cron working
--   while blocking ad-hoc DELETEs of recent or sensitive audit rows.
CREATE POLICY audit_logs_service_cleanup_only
  ON audit_logs
  FOR DELETE
  TO service_role
  USING (
    created_at < NOW() - INTERVAL '1 year'
    AND action_category NOT IN ('payment', 'security')
  );

-- NO UPDATE policy = no role can UPDATE audit_logs. Even service_role.
-- To correct an audit row, INSERT a new row with action_category='audit_correction'.

COMMENT ON POLICY audit_logs_service_insert ON audit_logs IS
  'service_role can INSERT audit rows from edge functions and DB triggers.';
COMMENT ON POLICY audit_logs_service_select ON audit_logs IS
  'service_role can read all audit rows.';
COMMENT ON POLICY audit_logs_service_cleanup_only ON audit_logs IS
  'service_role can DELETE audit rows ONLY if they are >1 year old AND NOT in payment/security categories. Matches the cleanup-audit-logs cron. All other DELETEs silently no-op (RLS filter). Audit logs are otherwise immutable.';

-- rollback:
--   DROP POLICY IF EXISTS audit_logs_service_insert ON audit_logs;
--   DROP POLICY IF EXISTS audit_logs_service_select ON audit_logs;
--   DROP POLICY IF EXISTS audit_logs_service_cleanup_only ON audit_logs;
--   CREATE POLICY audit_logs_service_all ON audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
