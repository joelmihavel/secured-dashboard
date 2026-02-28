-- ============================================================
-- DIAGNOSTIC: debug_handle_new_user(test_phone text)
-- ============================================================
-- Purpose: Reproduce the EXACT INSERT that handle_new_user() fires
-- AFTER INSERT ON auth.users, wrapped in an EXCEPTION block that
-- captures and returns the raw Postgres error as JSON.
--
-- This function does NOT insert a real auth.users row (which would
-- re-trigger GoAuth's user-creation machinery). Instead it:
--   1. Generates a random UUID as a stand-in for NEW.id.
--   2. Runs the same phone-normalisation logic as the trigger.
--   3. Attempts the identical INSERT ... ON CONFLICT into public.users.
--   4. Catches ANY error and returns its SQLSTATE / message / detail / hint.
--   5. Always rolls the INSERT back (runs in a subtransaction via
--      EXCEPTION, so the test row is never committed).
--
-- Call via REST:
--   POST /rest/v1/rpc/debug_handle_new_user
--   Authorization: Bearer <anon-key or service-role-key>
--   Content-Type: application/json
--   Body: {"test_phone": "+919876543210"}
--
-- Expected success response (INSERT would have worked):
--   {"success": true, "inserted_id": "...", "phone": "...", "phone_number": "..."}
--
-- Expected failure response (INSERT would have blown up the trigger):
--   {"success": false, "sqlstate": "23505", "message": "...", "detail": "...", "hint": "..."}
-- ============================================================

CREATE OR REPLACE FUNCTION public.debug_handle_new_user(test_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Mimic the DECLARE block of handle_new_user()
  v_fake_id         UUID    := gen_random_uuid();
  v_phone           TEXT;
  v_normalized_phone TEXT;
  v_role            TEXT    := NULL;   -- no raw_user_meta_data in this test

  -- Capture variables
  v_sqlstate        TEXT;
  v_message         TEXT;
  v_detail          TEXT;
  v_hint            TEXT;
  v_context         TEXT;
BEGIN
  -- --------------------------------------------------------
  -- Step 1: Phone normalisation — identical to trigger logic
  -- --------------------------------------------------------
  v_phone := COALESCE(test_phone, '');

  IF v_phone IS NOT NULL AND LENGTH(v_phone) > 0 THEN
    v_normalized_phone := regexp_replace(v_phone, '[^0-9]', '', 'g');
    IF LENGTH(v_normalized_phone) > 10 THEN
      v_normalized_phone := RIGHT(v_normalized_phone, 10);
    END IF;
  ELSE
    v_normalized_phone := NULL;
  END IF;

  -- --------------------------------------------------------
  -- Step 2: Attempt the EXACT same INSERT as the trigger.
  --
  -- We deliberately do NOT insert into auth.users first.
  -- The FK  public.users.id → auth.users.id  will fire a
  -- foreign-key violation if the FK is enforced — which is
  -- itself a useful diagnostic signal (SQLSTATE 23503).
  --
  -- All other constraint / type-mismatch / missing-column
  -- errors will also be caught and surfaced.
  --
  -- The EXCEPTION clause acts as a savepoint so no row is
  -- ever committed regardless of which branch is taken.
  -- --------------------------------------------------------
  BEGIN
    INSERT INTO public.users (
      id,
      phone,
      phone_number,
      role,
      user_status,
      is_onboarded,
      is_role_locked,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      v_fake_id,
      v_phone,
      v_normalized_phone,
      v_role,                               -- NULL (no user_type in test)
      'signed_up'::public.user_status_enum,
      false,
      false,
      true,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      phone        = COALESCE(NULLIF(EXCLUDED.phone, ''),        public.users.phone),
      phone_number = COALESCE(NULLIF(EXCLUDED.phone_number, ''), public.users.phone_number),
      updated_at   = NOW();

    -- If we reach here the INSERT succeeded — roll it back and
    -- report success so the caller knows the trigger would work.
    RAISE EXCEPTION 'DEBUG_ROLLBACK' USING
      DETAIL  = v_fake_id::TEXT,
      HINT    = v_normalized_phone;

  EXCEPTION
    -- ---- Our intentional rollback sentinel ----
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS
        v_sqlstate = RETURNED_SQLSTATE,
        v_message  = MESSAGE_TEXT,
        v_detail   = PG_EXCEPTION_DETAIL,
        v_hint     = PG_EXCEPTION_HINT,
        v_context  = PG_EXCEPTION_CONTEXT;

      IF v_message = 'DEBUG_ROLLBACK' THEN
        -- INSERT succeeded; row was rolled back by the exception.
        RETURN jsonb_build_object(
          'success',      true,
          'inserted_id',  v_fake_id,
          'phone',        v_phone,
          'phone_number', v_normalized_phone,
          'note',         'INSERT executed without error. Row was rolled back — this is expected for diagnostic runs.'
        );
      END IF;

      -- ---- A real error from the INSERT ----
      RETURN jsonb_build_object(
        'success',   false,
        'sqlstate',  v_sqlstate,
        'message',   v_message,
        'detail',    v_detail,
        'hint',      v_hint,
        'context',   v_context,
        'inputs', jsonb_build_object(
          'fake_id',      v_fake_id,
          'phone',        v_phone,
          'phone_number', v_normalized_phone
        )
      );
  END;
END;
$$;

-- ============================================================
-- Supplementary helper: inspect the live table definition
-- ============================================================
-- Returns column names, data types, nullability, and defaults
-- for public.users so we can spot schema drift without psql access.

CREATE OR REPLACE FUNCTION public.debug_users_table_schema()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_agg(
    jsonb_build_object(
      'column_name',             column_name,
      'data_type',               data_type,
      'udt_name',                udt_name,
      'is_nullable',             is_nullable,
      'column_default',          column_default,
      'character_maximum_length',character_maximum_length,
      'ordinal_position',        ordinal_position
    )
    ORDER BY ordinal_position
  )
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'users';
$$;

-- ============================================================
-- Supplementary helper: inspect trigger definition
-- ============================================================
-- Returns the current source of handle_new_user() so we can
-- confirm which version is actually live in the DB.

CREATE OR REPLACE FUNCTION public.debug_trigger_source()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'function_name',    p.proname,
    'security_definer', p.prosecdef,
    'search_path',      p.proconfig,
    'language',         l.lanname,
    'source',           p.prosrc
  )
  FROM pg_proc p
  JOIN pg_language l ON l.oid = p.prolang
  WHERE p.proname = 'handle_new_user'
    AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
$$;

-- ============================================================
-- Supplementary helper: check enum values
-- ============================================================
-- Returns all values of user_status_enum so we can confirm
-- 'signed_up' exists and the enum has not been corrupted.

CREATE OR REPLACE FUNCTION public.debug_user_status_enum_values()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder)
  FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  WHERE t.typname = 'user_status_enum';
$$;

-- ============================================================
-- Grants — callable by anon (REST API without a JWT) and
-- service_role (server-side / edge function calls).
-- ============================================================

GRANT EXECUTE ON FUNCTION public.debug_handle_new_user(TEXT)          TO anon, service_role;
GRANT EXECUTE ON FUNCTION public.debug_users_table_schema()            TO anon, service_role;
GRANT EXECUTE ON FUNCTION public.debug_trigger_source()                TO anon, service_role;
GRANT EXECUTE ON FUNCTION public.debug_user_status_enum_values()       TO anon, service_role;

-- Safety comment — these functions are diagnostic only.
COMMENT ON FUNCTION public.debug_handle_new_user(TEXT) IS
  'DIAGNOSTIC ONLY — simulates the handle_new_user() trigger INSERT and returns PG error details as JSON. Remove after debugging.';
COMMENT ON FUNCTION public.debug_users_table_schema() IS
  'DIAGNOSTIC ONLY — returns column metadata for public.users. Remove after debugging.';
COMMENT ON FUNCTION public.debug_trigger_source() IS
  'DIAGNOSTIC ONLY — returns live source of handle_new_user(). Remove after debugging.';
COMMENT ON FUNCTION public.debug_user_status_enum_values() IS
  'DIAGNOSTIC ONLY — returns all values of user_status_enum. Remove after debugging.';
