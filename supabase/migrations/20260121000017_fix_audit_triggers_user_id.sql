-- Flent Secured v2 - Migration: Fix Audit Triggers
-- Fixes triggers that incorrectly reference user_id on payments table
-- (payments has tenancy_id, user_id is on tenancies)

-- ==============================================
-- FIX: Generic audit trigger - handle missing user_id
-- ==============================================

CREATE OR REPLACE FUNCTION audit_table_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_old_data JSONB;
  v_new_data JSONB;
  v_user_id UUID;
  v_action_name TEXT;
  v_record RECORD;
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    v_action := 'INSERT';
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
    v_action_name := UPPER(TG_TABLE_NAME) || '_CREATED';
    v_record := NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    v_action_name := UPPER(TG_TABLE_NAME) || '_UPDATED';
    v_record := NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
    v_action_name := UPPER(TG_TABLE_NAME) || '_DELETED';
    v_record := OLD;
  END IF;

  -- Try to get user_id from the record - handle tables without user_id
  BEGIN
    IF TG_TABLE_NAME = 'payments' THEN
      -- Payments: get user_id via tenancy
      SELECT t.user_id INTO v_user_id
      FROM tenancies t
      WHERE t.id = (to_jsonb(v_record)->>'tenancy_id')::UUID;
    ELSIF TG_TABLE_NAME = 'cashback_ledger' THEN
      -- Cashback ledger has user_id directly
      v_user_id := (to_jsonb(v_record)->>'user_id')::UUID;
    ELSE
      -- Default: try to get user_id from record
      v_user_id := (to_jsonb(v_record)->>'user_id')::UUID;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

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
    (to_jsonb(v_record)->>'id')::UUID,
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
-- FIX: Payment status change audit - get user via tenancy
-- ==============================================

CREATE OR REPLACE FUNCTION audit_payment_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Get user_id from tenancy (payments don't have user_id directly)
    SELECT t.user_id INTO v_user_id
    FROM tenancies t
    WHERE t.id = NEW.tenancy_id;

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
      'PAYMENT_STATUS_CHANGED',
      'payment',
      'payment',
      NEW.id,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      jsonb_build_object(
        'payu_txn_id', NEW.payu_txn_id,
        'rent_amount_paise', NEW.rent_amount_paise,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_table_changes() IS 'Generic audit trigger - handles tables with and without user_id';
COMMENT ON FUNCTION audit_payment_status_change() IS 'Payment status audit - gets user_id via tenancy join';
