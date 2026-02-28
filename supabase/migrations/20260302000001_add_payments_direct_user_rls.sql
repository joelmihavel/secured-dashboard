-- Direct user_id RLS policy for payments table
--
-- The existing payments_user_select policy uses a subquery join through tenancies.
-- Supabase Realtime cannot evaluate subquery-based policies for row-level filtering.
-- This direct policy enables realtime subscriptions filtered by user_id.

DROP POLICY IF EXISTS payments_user_direct_select ON payments;
CREATE POLICY payments_user_direct_select ON payments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
