-- Fix: Allow 'demo' payment_gateway for test user payments
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_gateway_check;
ALTER TABLE payments ADD CONSTRAINT payments_payment_gateway_check
  CHECK (payment_gateway IN ('payu', 'demo'));
