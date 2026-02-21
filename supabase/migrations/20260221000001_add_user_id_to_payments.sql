-- Flent Secured v2 - Migration: Add user_id to payments table
-- Denormalizes user_id from tenancies for direct user-level queries on payments

-- Add user_id column
ALTER TABLE payments ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Backfill from tenancies
UPDATE payments SET user_id = t.user_id FROM tenancies t WHERE payments.tenancy_id = t.id;

-- Create indexes for user-level payment queries
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_user_status ON payments(user_id, status);

-- Trigger to auto-populate user_id on INSERT from tenancy
CREATE OR REPLACE FUNCTION set_payment_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.tenancy_id IS NOT NULL THEN
    SELECT user_id INTO NEW.user_id FROM tenancies WHERE id = NEW.tenancy_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_payment_user_id
  BEFORE INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION set_payment_user_id();
