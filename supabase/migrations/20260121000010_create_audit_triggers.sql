-- Flent Secured v2 - Migration: Audit Triggers
-- Automatically log changes to sensitive tables

-- ==============================================
-- GENERIC AUDIT TRIGGER FUNCTION
-- ==============================================

CREATE OR REPLACE FUNCTION audit_table_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_old_data JSONB;
  v_new_data JSONB;
  v_user_id UUID;
  v_action_name TEXT;
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    v_action := 'INSERT';
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
    v_action_name := UPPER(TG_TABLE_NAME) || '_CREATED';
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    v_action_name := UPPER(TG_TABLE_NAME) || '_UPDATED';
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
    v_action_name := UPPER(TG_TABLE_NAME) || '_DELETED';
  END IF;

  -- Try to get user_id from the record
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
  ELSE
    v_user_id := NEW.user_id;
  END IF;

  -- Insert audit log
  INSERT INTO audit_logs (
    user_id,
    actor_type,
    action,
    action_category,
    entity_type,
    entity_id,
    old_values,
    new_values,
    details
  )
  VALUES (
    v_user_id,
    'system',
    v_action_name,
    CASE TG_TABLE_NAME
      WHEN 'payments' THEN 'payment'
      WHEN 'tenancies' THEN 'tenancy'
      WHEN 'bank_accounts' THEN 'verification'
      WHEN 'identity_verifications' THEN 'verification'
      WHEN 'cashback_ledger' THEN 'cashback'
      ELSE 'system'
    END,
    TG_TABLE_NAME,
    CASE
      WHEN TG_OP = 'DELETE' THEN OLD.id
      ELSE NEW.id
    END,
    v_old_data,
    v_new_data,
    jsonb_build_object(
      'trigger', TG_NAME,
      'operation', TG_OP,
      'timestamp', NOW()
    )
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- PAYMENT STATUS CHANGE AUDIT
-- ==============================================

CREATE OR REPLACE FUNCTION audit_payment_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO audit_logs (
      user_id,
      actor_type,
      action,
      action_category,
      entity_type,
      entity_id,
      old_values,
      new_values,
      details
    )
    VALUES (
      NEW.user_id,
      'system',
      'PAYMENT_STATUS_CHANGED',
      'payment',
      'payment',
      NEW.id,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      jsonb_build_object(
        'payu_txn_id', NEW.payu_txn_id,
        'amount_paise', NEW.amount_paise,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_audit_payment_status
  AFTER UPDATE OF status ON payments
  FOR EACH ROW
  EXECUTE FUNCTION audit_payment_status_change();

-- ==============================================
-- TENANCY VERIFICATION STATUS AUDIT
-- ==============================================

CREATE OR REPLACE FUNCTION audit_tenancy_verification_change()
RETURNS TRIGGER AS $$
DECLARE
  v_changes JSONB := '{}';
BEGIN
  -- Track which verifications changed
  IF OLD.bank_verified IS DISTINCT FROM NEW.bank_verified THEN
    v_changes := v_changes || jsonb_build_object('bank_verified', NEW.bank_verified);
  END IF;

  IF OLD.utility_verified IS DISTINCT FROM NEW.utility_verified THEN
    v_changes := v_changes || jsonb_build_object('utility_verified', NEW.utility_verified);
  END IF;

  IF OLD.landlord_approved IS DISTINCT FROM NEW.landlord_approved THEN
    v_changes := v_changes || jsonb_build_object('landlord_approved', NEW.landlord_approved);
  END IF;

  -- Only log if something changed
  IF v_changes != '{}' THEN
    INSERT INTO audit_logs (
      user_id,
      actor_type,
      action,
      action_category,
      entity_type,
      entity_id,
      old_values,
      new_values,
      details
    )
    VALUES (
      NEW.user_id,
      'system',
      'TENANCY_VERIFICATION_UPDATED',
      'verification',
      'tenancy',
      NEW.id,
      jsonb_build_object(
        'bank_verified', OLD.bank_verified,
        'utility_verified', OLD.utility_verified,
        'landlord_approved', OLD.landlord_approved
      ),
      jsonb_build_object(
        'bank_verified', NEW.bank_verified,
        'utility_verified', NEW.utility_verified,
        'landlord_approved', NEW.landlord_approved
      ),
      v_changes
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_audit_tenancy_verification
  AFTER UPDATE OF bank_verified, utility_verified, landlord_approved ON tenancies
  FOR EACH ROW
  EXECUTE FUNCTION audit_tenancy_verification_change();

-- ==============================================
-- BANK ACCOUNT VERIFICATION AUDIT
-- ==============================================

CREATE TRIGGER trigger_audit_bank_accounts
  AFTER INSERT OR UPDATE OR DELETE ON bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION audit_table_changes();

-- ==============================================
-- IDENTITY VERIFICATION AUDIT
-- ==============================================

CREATE TRIGGER trigger_audit_identity_verifications
  AFTER INSERT ON identity_verifications
  FOR EACH ROW
  EXECUTE FUNCTION audit_table_changes();

-- ==============================================
-- CASHBACK LEDGER AUDIT (INSERT ONLY - IMMUTABLE)
-- ==============================================

CREATE TRIGGER trigger_audit_cashback_ledger
  AFTER INSERT ON cashback_ledger
  FOR EACH ROW
  EXECUTE FUNCTION audit_table_changes();

COMMENT ON FUNCTION audit_table_changes() IS 'Generic audit trigger for table changes';
COMMENT ON FUNCTION audit_payment_status_change() IS 'Specific audit for payment status transitions';
COMMENT ON FUNCTION audit_tenancy_verification_change() IS 'Tracks verification flag changes on tenancies';
