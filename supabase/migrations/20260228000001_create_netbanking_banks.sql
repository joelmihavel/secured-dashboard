-- ==============================================
-- Netbanking Banks — Static reference table
-- ==============================================
-- Stores PayU bank codes for netbanking payment method.
-- Public read, no user writes. Follows supported_cities pattern.

CREATE TABLE IF NOT EXISTS netbanking_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_code TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  short_name TEXT,
  is_popular BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 999,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE netbanking_banks ADD CONSTRAINT netbanking_banks_code_key UNIQUE (bank_code);

-- RLS: public read, no user writes
ALTER TABLE netbanking_banks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read netbanking banks" ON netbanking_banks
  FOR SELECT USING (true);

-- Seed with PayU bank codes (upsert)
INSERT INTO netbanking_banks (bank_code, bank_name, short_name, is_popular, display_order) VALUES
  ('SBIB', 'State Bank of India', 'SBI', true, 1),
  ('HDFB', 'HDFC Bank', 'HDFC', true, 2),
  ('ICIB', 'ICICI Bank', 'ICICI', true, 3),
  ('AXIB', 'Axis Bank', 'Axis', true, 4),
  ('KTKB', 'Kotak Mahindra Bank', 'Kotak', true, 5),
  ('ALLA', 'Allahabad Bank', NULL, false, 999),
  ('ANDB', 'Andhra Bank', NULL, false, 999),
  ('BBKM', 'Bank of Baroda', NULL, false, 999),
  ('BKID', 'Bank of India', NULL, false, 999),
  ('MAHB', 'Bank of Maharashtra', NULL, false, 999),
  ('CNRB', 'Canara Bank', NULL, false, 999),
  ('CSBK', 'Catholic Syrian Bank', NULL, false, 999),
  ('CIUB', 'City Union Bank', NULL, false, 999),
  ('DCBB', 'DCB Bank', NULL, false, 999),
  ('DLXB', 'Dhanlaxmi Bank', NULL, false, 999),
  ('FDRL', 'Federal Bank', NULL, false, 999),
  ('IDBIB', 'IDBI Bank', NULL, false, 999),
  ('IDFC', 'IDFC First Bank', NULL, false, 999),
  ('INDB', 'IndusInd Bank', NULL, false, 999),
  ('IOBA', 'Indian Overseas Bank', NULL, false, 999),
  ('JAKA', 'Jammu & Kashmir Bank', NULL, false, 999),
  ('KRVB', 'Karur Vysya Bank', NULL, false, 999),
  ('LAVB', 'Lakshmi Vilas Bank', NULL, false, 999),
  ('OBCB', 'Oriental Bank of Commerce', NULL, false, 999),
  ('PNBB', 'Punjab National Bank', NULL, false, 999),
  ('PSBB', 'Punjab & Sind Bank', NULL, false, 999),
  ('RATN', 'RBL Bank', NULL, false, 999),
  ('SRCB', 'Saraswat Co-op Bank', NULL, false, 999),
  ('SVCB', 'Shamrao Vithal Co-op Bank', NULL, false, 999),
  ('SOIB', 'South Indian Bank', NULL, false, 999),
  ('TMBB', 'Tamilnad Mercantile Bank', NULL, false, 999),
  ('UCOB', 'UCO Bank', NULL, false, 999),
  ('UNIB', 'Union Bank of India', NULL, false, 999),
  ('UBIN', 'United Bank of India', NULL, false, 999),
  ('YESB', 'Yes Bank', NULL, false, 999)
ON CONFLICT (bank_code) DO UPDATE SET
  bank_name = EXCLUDED.bank_name,
  short_name = EXCLUDED.short_name,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order;
