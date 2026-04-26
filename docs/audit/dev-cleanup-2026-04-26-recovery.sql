-- Recovery SQL for dev-only drift cleanup (2026-04-26)
--
-- Context: dev (zqlowjveyqiagnbmfwsb) had drift from prod (uowjtrzmszuaiokqxgir):
--   - 8 orphan public functions (zero callers in code, views, triggers, or other functions)
--   - 5 redundant RLS policies (newer-named policies cover the same access)
--   - 1 redundant trigger on waitlist_entries (two updated_at triggers; only one is needed)
--   - 1 trigger renamed for parity with prod
--
-- The drops are issued against the dev project only. Prod was already missing all of these;
-- this brings dev into parity with prod.
--
-- If you need to roll back, run the relevant section against dev:
--   psql "$SUPABASE_DEV_DB_URL" -f docs/audit/dev-cleanup-2026-04-26-recovery.sql
--
-- Caveats:
--   * get_credited_rewards / get_pending_rewards reference public.rewards which does not exist
--     on either dev or prod. Restoring these would only succeed if the rewards table is added.
--   * get_storage_url has the prod project ref hardcoded — if you restore in dev, replace
--     'uowjtrzmszuaiokqxgir' with 'zqlowjveyqiagnbmfwsb' first.
--   * calculate_contract_end_date / check_city_supported return trigger but no triggers wire them.

-- =====================================================================
-- Section 1: 8 orphan functions
-- =====================================================================

CREATE OR REPLACE FUNCTION public.calculate_contract_end_date()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.lease_start_date IS NOT NULL AND NEW.contract_length_months IS NOT NULL THEN
        NEW.contract_end_date_calculated := NEW.lease_start_date + (NEW.contract_length_months || ' months')::INTERVAL;
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_city_supported()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.is_city_supported := EXISTS (
        SELECT 1 FROM public.supported_cities sc
        WHERE sc.is_active = TRUE
        AND (LOWER(sc.city_name) = LOWER(NEW.property_city)
             OR LOWER(NEW.property_city) LIKE '%' || LOWER(sc.city_name) || '%')
    );
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.format_currency(paise bigint)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
    IF paise IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN '₹ ' || TO_CHAR(paise / 100.0, 'FM99,99,999');
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_credited_rewards(p_user_id uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    total BIGINT;
BEGIN
    SELECT COALESCE(SUM(amount_paise), 0) INTO total
    FROM public.rewards
    WHERE user_id = p_user_id AND status = 'credited';
    RETURN total;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_pending_rewards(p_user_id uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    total BIGINT;
BEGIN
    SELECT COALESCE(SUM(amount_paise), 0) INTO total
    FROM public.rewards
    WHERE user_id = p_user_id
      AND status = 'pending'
      AND (expires_at IS NULL OR expires_at > NOW());
    RETURN total;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_referral_link(entry_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    code VARCHAR(6);
BEGIN
    SELECT referral_code INTO code FROM public.waitlist_entries WHERE id = entry_id;
    IF code IS NOT NULL THEN
        RETURN 'https://flent.in/join/' || code;
    END IF;
    RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_storage_url(bucket_name text, file_path text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
    -- NOTE: hardcoded to prod ref; replace with dev ref before use in dev
    RETURN 'https://uowjtrzmszuaiokqxgir.supabase.co/storage/v1/object/public/' || bucket_name || '/' || file_path;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_waitlist_position(p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_position INTEGER;
BEGIN
    SELECT waitlist_position INTO v_position
    FROM public.waitlist_entries
    WHERE user_id = p_user_id;

    RETURN v_position;
END;
$function$;

-- =====================================================================
-- Section 2: 5 redundant RLS policies
-- (Note: requires RLS enabled on each table — already true on dev & prod.)
-- =====================================================================

CREATE POLICY "supported_cities_select_all" ON public.supported_cities
  FOR SELECT TO public USING (true);

CREATE POLICY "supported_cities_service_all" ON public.supported_cities
  FOR ALL TO public USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "waitlist_insert_own" ON public.waitlist_entries
  FOR INSERT TO public WITH CHECK (auth.uid() = user_id);

CREATE POLICY "waitlist_select_own" ON public.waitlist_entries
  FOR SELECT TO public USING (auth.uid() = user_id);

CREATE POLICY "waitlist_service_all" ON public.waitlist_entries
  FOR ALL TO public USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- =====================================================================
-- Section 3: trigger drift
-- =====================================================================

-- 3a. Recreate the redundant trigger (was: BEFORE UPDATE → handle_updated_at)
CREATE TRIGGER waitlist_entries_updated_at
  BEFORE UPDATE ON public.waitlist_entries
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- 3b. Reverse the rename of set_waitlist_entries_updated_at → trigger_waitlist_entries_updated_at
ALTER TRIGGER trigger_waitlist_entries_updated_at ON public.waitlist_entries
  RENAME TO set_waitlist_entries_updated_at;
