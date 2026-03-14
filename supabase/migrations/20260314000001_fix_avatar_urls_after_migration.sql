-- Fix avatar_url values that still reference the old Dev DB (zqlowjveyqiagnbmfwsb)
-- after migrating to Main DB (uowjtrzmszuaiokqxgir).
-- The assign-default-avatar edge function stored full Supabase Storage URLs
-- in users.avatar_url. Data migration copied these verbatim, so they now
-- point to the old Dev DB storage bucket (which 404s on Main DB).

-- Fix avatar_url column
UPDATE public.users
SET avatar_url = REPLACE(avatar_url, 'zqlowjveyqiagnbmfwsb', 'uowjtrzmszuaiokqxgir')
WHERE avatar_url LIKE '%zqlowjveyqiagnbmfwsb%';

-- Fix profile_image_url column (synced via trigger in 20260222000002_user_journey_states.sql)
UPDATE public.users
SET profile_image_url = REPLACE(profile_image_url, 'zqlowjveyqiagnbmfwsb', 'uowjtrzmszuaiokqxgir')
WHERE profile_image_url LIKE '%zqlowjveyqiagnbmfwsb%';
