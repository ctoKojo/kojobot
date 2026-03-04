-- Make slug nullable to prevent publish diff failure on existing production rows
ALTER TABLE public.landing_plans
ALTER COLUMN slug DROP NOT NULL;