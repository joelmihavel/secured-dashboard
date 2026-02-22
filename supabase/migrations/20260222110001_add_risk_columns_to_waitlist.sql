-- Risk assessment columns on waitlist_entries table
-- Stores computed risk level, factors, and computation timestamp

ALTER TABLE public.waitlist_entries ADD COLUMN IF NOT EXISTS risk_level TEXT
  DEFAULT 'PENDING' CHECK (risk_level IN ('LOW', 'MED', 'HIGH', 'PENDING'));
ALTER TABLE public.waitlist_entries ADD COLUMN IF NOT EXISTS risk_factors JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.waitlist_entries ADD COLUMN IF NOT EXISTS risk_computed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_waitlist_entries_risk_level ON waitlist_entries(risk_level);
