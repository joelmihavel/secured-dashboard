-- Flent Secured v2 - Migration: Modify Users Table
-- Add first_name and last_name columns for onboarding

-- Add first_name and last_name columns (collected during onboarding)
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);

-- Migrate existing full_name data (split on first space)
UPDATE users
SET
  first_name = SPLIT_PART(full_name, ' ', 1),
  last_name = NULLIF(SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1), '')
WHERE full_name IS NOT NULL
  AND full_name != ''
  AND first_name IS NULL;

-- Add index for name searches
CREATE INDEX IF NOT EXISTS idx_users_first_name ON users(first_name);
CREATE INDEX IF NOT EXISTS idx_users_last_name ON users(last_name);

COMMENT ON COLUMN users.first_name IS 'First name collected during onboarding';
COMMENT ON COLUMN users.last_name IS 'Last name collected during onboarding';
