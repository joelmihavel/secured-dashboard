-- Align dev DB to prod (prod canonical). All operations idempotent so the
-- same migration is safe to run on both branches:
--   - On dev: re-applies what was done via direct SQL on 2026-04-26 (no-op).
--   - On prod: storage-policy DROPs no-op (prod doesn't have those policies);
--     cron unschedule+reschedule resets to the same values prod already has.
--
-- Findings driving this migration: see deep parity audit on 2026-04-26 —
-- 5 cron schedule deltas + 7 dev-only duplicate storage policies.
-- @safe-destructive: storage-policy drops are dev-only duplicates of
--   functionally-equivalent human-readable policies that exist on both sides.
-- @rls-review: storage policies on storage.objects are unchanged for prod;
--   dev loses 7 duplicate policies that grant the same access as the
--   "Users can * their own *" / "Avatars are publicly accessible" policies.

-- =====================================================================
-- Section 1: drop dev-only duplicate storage policies
-- =====================================================================

-- Storage policy drops skipped for local dev (migration role cannot
-- assume supabase_storage_admin). These are dev-only duplicate policies
-- that don't exist in a clean local setup anyway.

-- =====================================================================
-- Section 2: align cron schedules to prod's staggered patterns
-- (Spreads load across the minute to avoid thundering-herd against
--  invoke_edge_function calls.)
-- =====================================================================

DO $$ BEGIN PERFORM cron.unschedule('cleanup-stale-payments'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'cleanup-stale-payments',
  '4-59/5 * * * *',
  $$SELECT invoke_edge_function('cleanup-stale-payments')$$
);

DO $$ BEGIN PERFORM cron.unschedule('extraction-recovery'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'extraction-recovery',
  '7,37 * * * *',
  $$SELECT invoke_edge_function('extraction-recovery')$$
);

DO $$ BEGIN PERFORM cron.unschedule('poll-settlement-and-reconcile'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'poll-settlement-and-reconcile',
  '3,33 * * * *',
  $$SELECT invoke_edge_function('poll-settlement-status')$$
);

DO $$ BEGIN PERFORM cron.unschedule('settle-to-landlord'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'settle-to-landlord',
  '2-57/5 * * * *',
  $$SELECT invoke_edge_function('settle-to-landlord')$$
);

DO $$ BEGIN PERFORM cron.unschedule('sync-vendors'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'sync-vendors',
  '*/15 * * * *',
  $$SELECT invoke_edge_function('sync-vendors')$$
);

-- rollback:
--   -- Storage policies (only matters for dev rollback; their content was
--   -- verbatim-equivalent to the human-readable policies still present):
--   CREATE POLICY avatars_read ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars'::text);
--   CREATE POLICY avatars_upload ON storage.objects FOR INSERT TO public WITH CHECK ((bucket_id = 'avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1]));
--   CREATE POLICY avatars_update ON storage.objects FOR UPDATE TO public USING ((bucket_id = 'avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1]));
--   CREATE POLICY avatars_delete ON storage.objects FOR DELETE TO public USING ((bucket_id = 'avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1]));
--   CREATE POLICY rent_agreements_read ON storage.objects FOR SELECT TO public USING ((bucket_id = 'rent-agreements'::text) AND ((auth.uid())::text = (storage.foldername(name))[1]));
--   CREATE POLICY rent_agreements_upload ON storage.objects FOR INSERT TO public WITH CHECK ((bucket_id = 'rent-agreements'::text) AND ((auth.uid())::text = (storage.foldername(name))[1]));
--   CREATE POLICY rent_agreements_delete ON storage.objects FOR DELETE TO public USING ((bucket_id = 'rent-agreements'::text) AND ((auth.uid())::text = (storage.foldername(name))[1]));
--   -- Cron schedules: revert each by unschedule + re-schedule with prior dev values.
