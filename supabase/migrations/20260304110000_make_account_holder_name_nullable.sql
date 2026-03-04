-- account_holder_name no longer required upfront — populated from Cashfree penny drop response
ALTER TABLE bank_accounts ALTER COLUMN account_holder_name DROP NOT NULL;
