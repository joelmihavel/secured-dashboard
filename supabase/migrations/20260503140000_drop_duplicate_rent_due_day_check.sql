-- Drop the redundant `valid_rent_due_day` CHECK constraint on tenancies.
--
-- Migration 20260121000003 declared the same constraint twice in the same
-- file: once inline on the column (`tenancies_rent_due_day_check`, the
-- canonical Postgres-generated name), and once as an explicit `ADD
-- CONSTRAINT valid_rent_due_day` block. Both bodies are identical:
--   CHECK (rent_due_day BETWEEN 1 AND 28)
-- so two copies of the same predicate run on every INSERT/UPDATE for no
-- reason. Cosmetic, but found during the cashback-cutoff audit and worth
-- cleaning up before someone copy-pastes the duplication elsewhere.
--
-- We keep `tenancies_rent_due_day_check` (Postgres' default name from the
-- inline CHECK) and drop only the explicit `valid_rent_due_day`. The
-- constraint coverage stays identical.

BEGIN;

ALTER TABLE public.tenancies
  DROP CONSTRAINT IF EXISTS valid_rent_due_day;

COMMIT;
