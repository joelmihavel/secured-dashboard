-- Activate tenancy when user is approved from the waitlist.
--
-- ROOT CAUSE: Tenancy status was only set to 'active' by landlord-approve,
-- but the actual business rule is: waitlist approval → tenancy active.
-- Landlord approval only gates credit card eligibility and cashback
-- redemption, NOT the tenancy status itself.
--
-- FIX: Extend the existing waitlist sync trigger to also activate the
-- user's tenancy when admin_review transitions to 'approved'.

-- Drop the incorrect landlord-based trigger if it exists
DROP TRIGGER IF EXISTS trigger_activate_tenancy_on_landlord_approval ON tenancies;

DROP FUNCTION IF EXISTS activate_tenancy_on_landlord_approval();

-- Replace the waitlist sync function to also activate tenancies
CREATE OR REPLACE FUNCTION sync_user_status_on_waitlist_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.admin_review = 'approved' AND (OLD.admin_review IS DISTINCT FROM 'approved') THEN
    -- Sync user status
    UPDATE public.users
    SET user_status = 'approved',
        status_updated_at = NOW()
    WHERE id = NEW.user_id;

    -- Activate the user's tenancy (pending_verification → active)
    UPDATE public.tenancies
    SET status = 'active',
        updated_at = NOW()
    WHERE user_id = NEW.user_id
      AND status = 'pending_verification';

  ELSIF NEW.admin_review = 'rejected' AND (OLD.admin_review IS DISTINCT FROM 'rejected') THEN
    UPDATE public.users
    SET user_status = 'waitlisted',
        status_updated_at = NOW()
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger already exists from 20260304140001, just replace the function above.
-- Re-create to be safe:
DROP TRIGGER IF EXISTS on_waitlist_admin_review_change ON waitlist_entries;

CREATE TRIGGER on_waitlist_admin_review_change
  AFTER UPDATE OF admin_review ON waitlist_entries
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_status_on_waitlist_change();

-- Backfill: activate tenancies for users already approved from waitlist
-- but whose tenancy is still stuck in pending_verification
UPDATE tenancies t
SET status = 'active', updated_at = NOW()
FROM waitlist_entries w
WHERE w.user_id = t.user_id
  AND w.admin_review = 'approved'
  AND t.status = 'pending_verification';