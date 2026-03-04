-- Sync users.user_status when waitlist_entries.admin_review changes
-- Ensures approving/rejecting a user on the waitlist automatically
-- updates the users table without manual intervention.

CREATE OR REPLACE FUNCTION sync_user_status_on_waitlist_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.admin_review = 'approved' AND (OLD.admin_review IS DISTINCT FROM 'approved') THEN
    UPDATE public.users
    SET user_status = 'approved',
        status_updated_at = NOW()
    WHERE id = NEW.user_id;
  ELSIF NEW.admin_review = 'rejected' AND (OLD.admin_review IS DISTINCT FROM 'rejected') THEN
    UPDATE public.users
    SET user_status = 'waitlisted',
        status_updated_at = NOW()
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_waitlist_admin_review_change ON waitlist_entries;
CREATE TRIGGER on_waitlist_admin_review_change
  AFTER UPDATE OF admin_review ON waitlist_entries
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_status_on_waitlist_change();
