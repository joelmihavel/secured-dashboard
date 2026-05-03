-- Split heartbeat metadata from final Gemini response.
--
-- The heartbeat process in cloud-run/extraction-service writes
-- {step, started_at, last_heartbeat} into gemini_raw_response every 30s
-- during extraction. That same column is supposed to hold the final
-- structured Gemini JSON once extraction completes. They cannot coexist --
-- whichever writer runs last wins, and we routinely lose the actual
-- Gemini response. This makes future debugging blind.
--
-- New column extraction_progress holds heartbeat-only data going forward.
-- gemini_raw_response stays as the canonical place for the final Gemini
-- output. Existing rows are not migrated; the heartbeat code change
-- prevents future collisions.

BEGIN;

ALTER TABLE public.extracted_rental_info
  ADD COLUMN IF NOT EXISTS extraction_progress jsonb;

COMMENT ON COLUMN public.extracted_rental_info.extraction_progress IS
  'Heartbeat / step metadata written by cloud-run extraction-service during '
  'long-running extractions. Format: {step, started_at, last_heartbeat}. '
  'Cleared on extraction completion. Distinct from gemini_raw_response '
  'which holds the final structured Gemini output.';

COMMIT;
