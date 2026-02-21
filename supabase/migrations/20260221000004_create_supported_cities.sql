-- Flent Secured v2 - Migration: Create/update supported_cities table
-- Tracks which cities the app is available in

CREATE TABLE IF NOT EXISTS supported_cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_name TEXT NOT NULL
);

-- Add columns that may not exist on pre-existing table
ALTER TABLE supported_cities ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE supported_cities ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE supported_cities ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Ensure unique constraint on city_name (may not exist on pre-existing table)
DO $$ BEGIN
  ALTER TABLE supported_cities ADD CONSTRAINT supported_cities_city_name_key UNIQUE (city_name);
EXCEPTION WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- Seed data (upsert to avoid duplicates)
INSERT INTO supported_cities (city_name, state) VALUES
  ('Bangalore', 'Karnataka'),
  ('Mumbai', 'Maharashtra')
ON CONFLICT (city_name) DO UPDATE SET state = EXCLUDED.state;

-- RLS - public read, no user writes
ALTER TABLE supported_cities ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anyone can read supported cities" ON supported_cities
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE supported_cities IS 'Cities where Flent Secured is available';
