
-- Add 'terminated' to employment_status enum
ALTER TYPE public.employment_status ADD VALUE IF NOT EXISTS 'terminated';

-- Add termination tracking columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terminated_at timestamp with time zone DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS termination_reason text DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terminated_by uuid DEFAULT NULL;
