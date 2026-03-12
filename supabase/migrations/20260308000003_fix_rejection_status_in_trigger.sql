-- Fix: rejection should set user_status to 'not_eligible', not 'waitlisted'
-- The previous trigger (20260308000002) incorrectly kept rejected users as 'waitlisted',
-- creating an inconsistent state if the edge function failed mid-operation.

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
    SET user_status = 'not_eligible',
        status_updated_at = NOW()
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;