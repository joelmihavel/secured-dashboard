-- Fix: get_onboarded_count() was counting orphaned waitlist_entries whose
-- user_id no longer exists in users (5 such entries were inflating the count
-- from 109 -> 114). Add an inner join to users so only entries with real
-- users are counted.

CREATE OR REPLACE FUNCTION public.get_onboarded_count()
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $function$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM waitlist_entries w
    INNER JOIN users u ON u.id = w.user_id
    WHERE w.admin_review = 'approved'
  );
END;
$function$;
