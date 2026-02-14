-- Flent Secured v2 - Migration: Create waitlist_entries table
-- Date: 2026-02-14
-- Description: Proper waitlist tracking with positions, admin review, and rejection handling.
--   Previously, waitlist status was derived solely from extracted_rental_info with hardcoded
--   position=1000. This table gives real position assignment, priority boosts from referrals,
--   admin review workflow, and rejection reasons with re-application cooldown.

-- ==============================================
-- TABLE: waitlist_entries
-- ==============================================

CREATE TABLE IF NOT EXISTS public.waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Position (lower = earlier in queue). Mutable: referral boosts decrement this.
  position INTEGER NOT NULL,

  -- Admin review status
  admin_review TEXT NOT NULL DEFAULT 'due'
    CHECK (admin_review IN ('due', 'in_progress', 'approved', 'rejected')),

  -- Rejection details
  rejection_reasons TEXT[] DEFAULT '{}',
  next_application_at TIMESTAMPTZ, -- cooldown before re-applying after rejection

  -- Referral boost tracking
  priority_boost INTEGER NOT NULL DEFAULT 0,

  -- Link to agreement extraction (null until user uploads agreement)
  extraction_id UUID REFERENCES extracted_rental_info(id),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================
-- INDEXES
-- ==============================================

CREATE INDEX IF NOT EXISTS idx_waitlist_entries_user_id ON waitlist_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_entries_position ON waitlist_entries(position);
CREATE INDEX IF NOT EXISTS idx_waitlist_entries_admin_review ON waitlist_entries(admin_review);
CREATE INDEX IF NOT EXISTS idx_waitlist_entries_created_at ON waitlist_entries(created_at DESC);

-- ==============================================
-- TRIGGER: Auto-update updated_at
-- ==============================================

CREATE OR REPLACE FUNCTION update_waitlist_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_waitlist_entries_updated_at
  BEFORE UPDATE ON waitlist_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_waitlist_entries_updated_at();

-- ==============================================
-- FUNCTION: Assign next waitlist position (atomic)
-- ==============================================

CREATE OR REPLACE FUNCTION next_waitlist_position()
RETURNS INTEGER AS $$
DECLARE
  v_next INTEGER;
BEGIN
  SELECT COALESCE(MAX(position), 0) + 1 INTO v_next FROM waitlist_entries;
  RETURN v_next;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- FUNCTION: Join waitlist (idempotent)
-- Returns the existing or newly created entry.
-- ==============================================

CREATE OR REPLACE FUNCTION join_waitlist(p_user_id UUID)
RETURNS TABLE (
  entry_id UUID,
  entry_position INTEGER,
  is_new BOOLEAN
) AS $$
DECLARE
  v_existing_id UUID;
  v_existing_position INTEGER;
  v_new_id UUID;
  v_new_position INTEGER;
BEGIN
  -- Check for existing entry
  SELECT we.id, we.position INTO v_existing_id, v_existing_position
  FROM waitlist_entries we
  WHERE we.user_id = p_user_id;

  IF v_existing_id IS NOT NULL THEN
    RETURN QUERY SELECT v_existing_id, v_existing_position, false;
    RETURN;
  END IF;

  -- Assign position and create entry
  v_new_position := next_waitlist_position();

  INSERT INTO waitlist_entries (user_id, position)
  VALUES (p_user_id, v_new_position)
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT v_new_id, v_new_position, true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- FUNCTION: Apply priority boost to waitlist position
-- Called after referral code is applied.
-- ==============================================

CREATE OR REPLACE FUNCTION apply_waitlist_priority_boost(
  p_user_id UUID,
  p_boost INTEGER
)
RETURNS TABLE (
  old_position INTEGER,
  new_position INTEGER,
  total_boost INTEGER
) AS $$
DECLARE
  v_old_position INTEGER;
  v_new_position INTEGER;
  v_total_boost INTEGER;
BEGIN
  -- Get current position
  SELECT we.position, we.priority_boost
  INTO v_old_position, v_total_boost
  FROM waitlist_entries we
  WHERE we.user_id = p_user_id;

  IF v_old_position IS NULL THEN
    -- No waitlist entry, nothing to boost
    RETURN QUERY SELECT 0, 0, 0;
    RETURN;
  END IF;

  -- Calculate new position (never below 1)
  v_new_position := GREATEST(1, v_old_position - p_boost);
  v_total_boost := v_total_boost + p_boost;

  -- Update entry
  UPDATE waitlist_entries
  SET position = v_new_position,
      priority_boost = v_total_boost
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT v_old_position, v_new_position, v_total_boost;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- FUNCTION: Get onboarded count (approved entries)
-- ==============================================

CREATE OR REPLACE FUNCTION get_onboarded_count()
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT COUNT(*)::INTEGER FROM waitlist_entries WHERE admin_review = 'approved');
END;
$$ LANGUAGE plpgsql STABLE;

-- ==============================================
-- RLS POLICIES
-- ==============================================

ALTER TABLE waitlist_entries ENABLE ROW LEVEL SECURITY;

-- Users can view their own waitlist entry
CREATE POLICY waitlist_entries_select_own ON waitlist_entries
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Only service role can insert/update/delete (via edge functions)
CREATE POLICY waitlist_entries_service_all ON waitlist_entries
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ==============================================
-- TRIGGER: Auto-create waitlist entry on user signup
-- Fires after handle_new_user creates the public.users row.
-- ==============================================

CREATE OR REPLACE FUNCTION auto_join_waitlist()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM join_waitlist(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_created_join_waitlist ON public.users;
CREATE TRIGGER on_user_created_join_waitlist
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_join_waitlist();

-- ==============================================
-- TRIGGER: Link extraction to waitlist entry
-- When extracted_rental_info is created, link it to the user's waitlist entry.
-- ==============================================

CREATE OR REPLACE FUNCTION link_extraction_to_waitlist()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE waitlist_entries
  SET extraction_id = NEW.id
  WHERE user_id = NEW.user_id
    AND extraction_id IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_extraction_created_link_waitlist ON extracted_rental_info;
CREATE TRIGGER on_extraction_created_link_waitlist
  AFTER INSERT ON extracted_rental_info
  FOR EACH ROW
  EXECUTE FUNCTION link_extraction_to_waitlist();

-- ==============================================
-- BACKFILL: Create waitlist entries for existing users
-- Assigns positions in order of user creation.
-- ==============================================

INSERT INTO waitlist_entries (user_id, position)
SELECT u.id, ROW_NUMBER() OVER (ORDER BY u.created_at ASC)
FROM public.users u
WHERE NOT EXISTS (
  SELECT 1 FROM waitlist_entries we WHERE we.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- Link existing extractions
UPDATE waitlist_entries we
SET extraction_id = (
  SELECT eri.id FROM extracted_rental_info eri
  WHERE eri.user_id = we.user_id
  ORDER BY eri.created_at DESC
  LIMIT 1
)
WHERE we.extraction_id IS NULL;

-- ==============================================
-- REALTIME
-- ==============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE waitlist_entries;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ==============================================
-- COMMENTS
-- ==============================================

COMMENT ON TABLE waitlist_entries IS 'Tracks user position in the waitlist with admin review workflow';
COMMENT ON COLUMN waitlist_entries.position IS 'Queue position (lower = earlier). Decremented by referral priority boosts.';
COMMENT ON COLUMN waitlist_entries.admin_review IS 'Admin review status: due, in_progress, approved, rejected';
COMMENT ON COLUMN waitlist_entries.rejection_reasons IS 'Array of rejection reasons shown to user';
COMMENT ON COLUMN waitlist_entries.next_application_at IS 'Timestamp after which rejected user can re-apply';
COMMENT ON COLUMN waitlist_entries.priority_boost IS 'Cumulative priority boost from referral codes';
COMMENT ON FUNCTION join_waitlist IS 'Idempotently joins user to waitlist with next available position';
COMMENT ON FUNCTION apply_waitlist_priority_boost IS 'Applies referral priority boost to waitlist position';
COMMENT ON FUNCTION get_onboarded_count IS 'Returns count of approved waitlist entries';
