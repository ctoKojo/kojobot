-- Drop the existing check constraint
ALTER TABLE public.assignment_submissions DROP CONSTRAINT IF EXISTS assignment_submissions_status_check;

-- Add new check constraint with revision_requested included
ALTER TABLE public.assignment_submissions 
ADD CONSTRAINT assignment_submissions_status_check 
CHECK (status IN ('submitted', 'graded', 'revision_requested'));