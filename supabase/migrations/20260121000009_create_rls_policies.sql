-- Flent Secured v2 - Migration: Row Level Security Policies
-- Ensures users can only access their own data

-- ==============================================
-- ENABLE RLS ON ALL NEW TABLES
-- ==============================================

ALTER TABLE tenancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashback_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- TENANCIES POLICIES
-- ==============================================

-- Tenants can view their own tenancies
CREATE POLICY tenancies_tenant_select ON tenancies
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Landlords can view tenancies where they are the landlord
CREATE POLICY tenancies_landlord_select ON tenancies
  FOR SELECT
  TO authenticated
  USING (landlord_user_id = auth.uid());

-- Tenants can insert their own tenancies
CREATE POLICY tenancies_tenant_insert ON tenancies
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Tenants can update their own tenancies (limited fields via trigger)
CREATE POLICY tenancies_tenant_update ON tenancies
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role can do everything (for Edge Functions)
CREATE POLICY tenancies_service_all ON tenancies
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==============================================
-- PAYMENTS POLICIES
-- ==============================================

-- Users can view their own payments (via tenancy)
CREATE POLICY payments_user_select ON payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenancies t
      WHERE t.id = payments.tenancy_id
        AND t.user_id = auth.uid()
    )
  );

-- Landlords can view payments for their tenancies
CREATE POLICY payments_landlord_select ON payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenancies t
      WHERE t.id = payments.tenancy_id
        AND t.landlord_user_id = auth.uid()
    )
  );

-- Only service role can insert/update payments (via Edge Functions)
CREATE POLICY payments_service_all ON payments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==============================================
-- BANK ACCOUNTS POLICIES
-- ==============================================

-- Users can view their own bank accounts
CREATE POLICY bank_accounts_user_select ON bank_accounts
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own bank accounts
CREATE POLICY bank_accounts_user_insert ON bank_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own bank accounts
CREATE POLICY bank_accounts_user_update ON bank_accounts
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own unverified bank accounts
CREATE POLICY bank_accounts_user_delete ON bank_accounts
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() AND verified = false);

-- Service role can do everything
CREATE POLICY bank_accounts_service_all ON bank_accounts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==============================================
-- IDENTITY VERIFICATIONS POLICIES
-- ==============================================

-- Users can view their own verifications
CREATE POLICY identity_verifications_user_select ON identity_verifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Only service role can insert/update (sensitive data)
CREATE POLICY identity_verifications_service_all ON identity_verifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==============================================
-- CASHBACK LEDGER POLICIES
-- ==============================================

-- Users can view their own cashback history
CREATE POLICY cashback_ledger_user_select ON cashback_ledger
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Only service role can modify cashback (no direct manipulation)
CREATE POLICY cashback_ledger_service_all ON cashback_ledger
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==============================================
-- IDEMPOTENCY KEYS POLICIES
-- ==============================================

-- Users can view their own idempotency keys
CREATE POLICY idempotency_keys_user_select ON idempotency_keys
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Only service role can manage idempotency keys
CREATE POLICY idempotency_keys_service_all ON idempotency_keys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==============================================
-- AUDIT LOGS POLICIES
-- ==============================================

-- Users can view their own audit logs (limited)
CREATE POLICY audit_logs_user_select ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND action_category NOT IN ('security', 'system') -- Hide sensitive logs
  );

-- Only service role can insert audit logs
CREATE POLICY audit_logs_service_all ON audit_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==============================================
-- HELPER POLICIES FOR LANDLORD ACCESS
-- ==============================================

-- Landlords can see tenant bank accounts (masked) for their tenancies
-- Note: This is handled via Edge Functions with service role, not direct access

COMMENT ON POLICY tenancies_tenant_select ON tenancies IS 'Tenants can view their own tenancies';
COMMENT ON POLICY payments_landlord_select ON payments IS 'Landlords can view payment history for their properties';
