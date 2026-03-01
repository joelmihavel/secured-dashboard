-- Allow NULL tenancy_id, due_date, payment_month on payments table
-- Card verification payments (Rs.1 tokenization) are not tied to a tenancy or rent month.
-- Existing rent payment inserts always provide these fields, so this is safe.

ALTER TABLE payments ALTER COLUMN tenancy_id DROP NOT NULL;
ALTER TABLE payments ALTER COLUMN due_date DROP NOT NULL;
ALTER TABLE payments ALTER COLUMN payment_month DROP NOT NULL;

-- Add a comment explaining when these can be NULL
COMMENT ON COLUMN payments.tenancy_id IS 'NULL for card verification payments (purpose=card_verification in metadata)';
