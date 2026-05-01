-- Fix audit_user_status_change() — drop the ::text cast on entity_id.
--
-- Migration 20260430230846 introduced trg_audit_user_status_change which
-- inserts NEW.id::text into audit_logs.entity_id, but that column is UUID,
-- not TEXT. Every UPDATE on users.user_status hits the trigger and gets
-- rejected with 42804 ("column entity_id is of type uuid but expression
-- is of type text"), so the entire transaction rolls back.
--
-- Blast radius: ALL paths that advance user_status are dead on dev DB
-- (process-document signed_up → waitlisted, sync_user_status_on_waitlist_change
-- waitlisted → approved/not_eligible, check_and_advance_to_active approved →
-- active, claim_invite_code VIP promotion, admin approval cascade). The
-- tenancy.status='active' flip is also dead because it ships in the same
-- transaction as the user_status UPDATE inside sync_user_status_on_waitlist_change.
--
-- The sibling function audit_tenancy_verification_change (added by the same
-- migration family) already uses NEW.id without a cast against the same
-- UUID column, confirming the cast here was an oversight.
--
-- This migration is idempotent — CREATE OR REPLACE just rewrites the body.

CREATE OR REPLACE FUNCTION public.audit_user_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.user_status IS DISTINCT FROM OLD.user_status THEN
    INSERT INTO public.audit_logs (
      user_id, actor_type, action, action_category,
      entity_type, entity_id,
      old_values, new_values,
      status
    ) VALUES (
      NEW.id, 'system', 'USER_STATUS_CHANGED', 'verification',
      'user', NEW.id,
      jsonb_build_object('user_status', OLD.user_status),
      jsonb_build_object('user_status', NEW.user_status),
      'success'
    );
  END IF;
  RETURN NEW;
END;
$$;
