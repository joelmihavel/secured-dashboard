-- PR-4 helper RPC: revert user_status from waitlisted back to signed_up.
-- Used by resetForReupload when an agreement re-upload invalidates the
-- prior extraction-name match. Idempotent and only acts on 'waitlisted'
-- — never touches approved/active/not_eligible.

-- @security-definer: must update users.user_status across user boundaries when client-side resetForReupload reverts an in-progress re-upload. Caller is the rn-app re-upload flow which authenticates the user before invoking; the RPC's WHERE clause restricts the write to the matching user_id row.
CREATE OR REPLACE FUNCTION public.revert_to_signed_up(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users
    SET user_status = 'signed_up',
        status_updated_at = NOW()
    WHERE id = p_user_id
      AND user_status = 'waitlisted';
  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.revert_to_signed_up(uuid) IS
  'PR-4: reverts user_status from waitlisted back to signed_up. Used by '
  'the re-upload flow when the extraction goes stale. No-op for any other '
  'current status — does NOT touch approved/active/not_eligible.';

-- rollback:
--   DROP FUNCTION IF EXISTS public.revert_to_signed_up(uuid);
