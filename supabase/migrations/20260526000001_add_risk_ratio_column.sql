-- Add risk_ratio column for audit trail: stores the computed ratio (0-1) alongside risk_level
ALTER TABLE public.waitlist_entries ADD COLUMN IF NOT EXISTS risk_ratio NUMERIC(5,3);

COMMENT ON COLUMN public.waitlist_entries.risk_ratio IS 'Computed risk ratio (0-1) from risk-utils. Stored for audit and threshold calibration.';
