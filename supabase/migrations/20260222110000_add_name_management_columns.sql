-- Name management + tenant identification columns on users table
-- Tracks where the authoritative name came from and tenant matching results

-- Track where the authoritative name came from
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name_source TEXT
  CHECK (name_source IN ('m360', 'user_input', 'agreement'));

-- Tenant identification (which agreement tenant matched this user)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS matched_tenant_index INTEGER;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tenant_match_score INTEGER;  -- 0-100
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tenant_match_type TEXT
  CHECK (tenant_match_type IN ('exact', 'strong', 'partial', 'weak', 'no_match'));

-- Backfill name_source for existing users who have M360-verified names
UPDATE public.users u SET name_source = 'm360'
WHERE u.name_source IS NULL AND u.first_name IS NOT NULL
  AND EXISTS (SELECT 1 FROM identity_verifications iv WHERE iv.user_id = u.id AND iv.status = 'SUCCESS');

-- Backfill name_source for existing users with user-input names (no M360)
UPDATE public.users u SET name_source = 'user_input'
WHERE u.name_source IS NULL AND u.first_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_name_source ON public.users(name_source);
