-- Flent Secured v2 - Migration: Waitlist schema (final)
-- Date: 2026-02-14
-- Description: Adds columns, functions, triggers, and RLS for waitlist_entries.
--   No backfill INSERT (existing FK constraint to profiles prevents it).
--   New users get entries via auto_join_waitlist trigger.
--   Existing users get entries on-demand via join-waitlist edge function.

-- ==============================================
-- ADD COLUMNS (idempotent)
-- ==============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'waitlist_entries' AND column_name = 'admin_review') THEN
    ALTER TABLE waitlist_entries ADD COLUMN admin_review TEXT NOT NULL DEFAULT 'due';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'waitlist_entries' AND column_name = 'rejection_reasons') THEN
    ALTER TABLE waitlist_entries ADD COLUMN rejection_reasons TEXT[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'waitlist_entries' AND column_name = 'next_application_at') THEN
    ALTER TABLE waitlist_entries ADD COLUMN next_application_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'waitlist_entries' AND column_name = 'priority_boost') THEN
    ALTER TABLE waitlist_entries ADD COLUMN priority_boost INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'waitlist_entries' AND column_name = 'extraction_id') THEN
    ALTER TABLE waitlist_entries ADD COLUMN extraction_id UUID;
  END IF;
END $$;

-- Constraint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_waitlist_admin_review') THEN
    ALTER TABLE waitlist_entries ADD CONSTRAINT chk_waitlist_admin_review
      CHECK (admin_review IN ('due', 'in_progress', 'approved', 'rejected'));
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Migrate status → admin_review
UPDATE waitlist_entries
SET admin_review = CASE WHEN status::text = 'approved' THEN 'approved' WHEN status::text = 'rejected' THEN 'rejected' ELSE 'due' END
WHERE admin_review = 'due';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_waitlist_entries_admin_review ON waitlist_entries(admin_review);

-- ==============================================
-- FUNCTIONS
-- ==============================================

CREATE OR REPLACE FUNCTION next_waitlist_position() RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT COALESCE(MAX(waitlist_position), 0) + 1 FROM waitlist_entries);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION join_waitlist(p_user_id UUID)
RETURNS TABLE (entry_id UUID, entry_position INTEGER, is_new BOOLEAN) AS $$
DECLARE v_id UUID; v_pos INTEGER; v_new_id UUID; v_new_pos INTEGER;
BEGIN
  SELECT we.id, we.waitlist_position INTO v_id, v_pos FROM waitlist_entries we WHERE we.user_id = p_user_id;
  IF v_id IS NOT NULL THEN RETURN QUERY SELECT v_id, v_pos, false; RETURN; END IF;
  v_new_pos := next_waitlist_position();
  INSERT INTO waitlist_entries (user_id, waitlist_position) VALUES (p_user_id, v_new_pos) RETURNING id INTO v_new_id;
  RETURN QUERY SELECT v_new_id, v_new_pos, true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION apply_waitlist_priority_boost(p_user_id UUID, p_boost INTEGER)
RETURNS TABLE (old_position INTEGER, new_position INTEGER, total_boost INTEGER) AS $$
DECLARE v_old INTEGER; v_new INTEGER; v_boost INTEGER;
BEGIN
  SELECT we.waitlist_position, we.priority_boost INTO v_old, v_boost FROM waitlist_entries we WHERE we.user_id = p_user_id;
  IF v_old IS NULL THEN RETURN QUERY SELECT 0, 0, 0; RETURN; END IF;
  v_new := GREATEST(1, v_old - p_boost); v_boost := v_boost + p_boost;
  UPDATE waitlist_entries SET waitlist_position = v_new, priority_boost = v_boost WHERE user_id = p_user_id;
  RETURN QUERY SELECT v_old, v_new, v_boost;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_onboarded_count() RETURNS INTEGER AS $$
BEGIN RETURN (SELECT COUNT(*)::INTEGER FROM waitlist_entries WHERE admin_review = 'approved'); END;
$$ LANGUAGE plpgsql STABLE;

-- ==============================================
-- RLS
-- ==============================================

ALTER TABLE waitlist_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS waitlist_entries_select_own ON waitlist_entries;
DROP POLICY IF EXISTS waitlist_entries_service_all ON waitlist_entries;
CREATE POLICY waitlist_entries_select_own ON waitlist_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY waitlist_entries_service_all ON waitlist_entries FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==============================================
-- TRIGGERS
-- ==============================================

CREATE OR REPLACE FUNCTION auto_join_waitlist() RETURNS TRIGGER AS $$
BEGIN PERFORM join_waitlist(NEW.id); RETURN NEW; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_created_join_waitlist ON public.users;
CREATE TRIGGER on_user_created_join_waitlist AFTER INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION auto_join_waitlist();

CREATE OR REPLACE FUNCTION link_extraction_to_waitlist() RETURNS TRIGGER AS $$
BEGIN
  UPDATE waitlist_entries SET extraction_id = NEW.id WHERE user_id = NEW.user_id AND extraction_id IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_extraction_created_link_waitlist ON extracted_rental_info;
CREATE TRIGGER on_extraction_created_link_waitlist AFTER INSERT ON extracted_rental_info FOR EACH ROW EXECUTE FUNCTION link_extraction_to_waitlist();

-- Link existing extractions (safe — only updates, no FK issues)
UPDATE waitlist_entries we
SET extraction_id = (SELECT eri.id FROM extracted_rental_info eri WHERE eri.user_id = we.user_id ORDER BY eri.created_at DESC LIMIT 1)
WHERE we.extraction_id IS NULL;

-- Realtime
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE waitlist_entries;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
