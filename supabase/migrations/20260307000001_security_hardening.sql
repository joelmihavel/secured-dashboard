-- ============================================================
-- Security Hardening — 2026-03-08
-- ============================================================

-- ── 1. Drop debug functions ──
-- Diagnostic-only functions left from debugging. All SECURITY DEFINER
-- and callable by anon — expose table schemas, trigger source, enum values.

DROP FUNCTION IF EXISTS public.debug_handle_new_user(TEXT);

DROP FUNCTION IF EXISTS public.debug_users_table_schema();

DROP FUNCTION IF EXISTS public.debug_trigger_source();

DROP FUNCTION IF EXISTS public.debug_user_status_enum_values();

-- ── 2. Tighten v_verification_analysis permissions ──
-- Was: GRANT SELECT TO anon, authenticated, service_role
-- Anyone with the publishable key could read full user PII.
-- Keep service_role only (admin edge functions + Apps Script).

REVOKE SELECT ON public.v_verification_analysis FROM anon;

REVOKE SELECT ON public.v_verification_analysis FROM authenticated;

-- service_role grant already exists from the original migration;