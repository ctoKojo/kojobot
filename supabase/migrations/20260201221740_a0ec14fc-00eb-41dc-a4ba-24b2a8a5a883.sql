-- Update groups status to remove 'pending' option and only keep 'active' and 'frozen'
-- First update any existing 'pending' groups to 'frozen'
UPDATE public.groups SET status = 'frozen' WHERE status = 'pending';

-- Drop the old check constraint
ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_status_check;

-- Add new check constraint with only active/frozen
ALTER TABLE public.groups ADD CONSTRAINT groups_status_check CHECK (status IN ('active', 'frozen'));