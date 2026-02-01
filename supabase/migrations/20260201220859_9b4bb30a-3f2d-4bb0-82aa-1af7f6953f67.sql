-- Add status column to groups table for pending/frozen functionality
ALTER TABLE public.groups 
ADD COLUMN status TEXT NOT NULL DEFAULT 'active' 
CHECK (status IN ('active', 'pending', 'frozen'));

-- Add index for faster filtering by status
CREATE INDEX idx_groups_status ON public.groups(status);

-- Add Arabic description column for status (optional metadata)
COMMENT ON COLUMN public.groups.status IS 'Group status: active (نشط), pending (معلق), frozen (مجمد)';