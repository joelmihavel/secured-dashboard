-- Update fee_config with actual PayU account rates
-- UPI: 0% (free)
UPDATE fee_config SET rate = 0, fee_type = 'percentage' WHERE method = 'upi';
-- Credit Card: 1.85%
UPDATE fee_config SET rate = 0.0185, fee_type = 'percentage' WHERE method = 'credit_card';
-- Debit Card: 0.90% (rent is always > 2,000)
UPDATE fee_config SET rate = 0.009, fee_type = 'percentage' WHERE method = 'debit_card';
-- Netbanking: 15 flat (stored in paise)
UPDATE fee_config SET rate = 1500, fee_type = 'flat_paise' WHERE method = 'netbanking';
