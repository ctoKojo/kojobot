
-- Add has_started column to groups table
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS has_started boolean DEFAULT false;

-- Update existing groups to mark them as started (they already have sessions)
UPDATE public.groups SET has_started = true;

-- Drop the auto-trigger so sessions are NOT created on insert
DROP TRIGGER IF EXISTS trigger_create_group_sessions ON public.groups;
