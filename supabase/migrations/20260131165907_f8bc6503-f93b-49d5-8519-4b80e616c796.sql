-- Add session_number column to sessions table
ALTER TABLE public.sessions 
ADD COLUMN session_number integer;

-- Update existing sessions with sequential numbers per group (ordered by date)
WITH numbered AS (
  SELECT id, 
         ROW_NUMBER() OVER (
           PARTITION BY group_id 
           ORDER BY session_date, session_time
         ) as row_num
  FROM public.sessions
)
UPDATE public.sessions 
SET session_number = numbered.row_num
FROM numbered 
WHERE public.sessions.id = numbered.id;

-- Create group_level_progress table for tracking level progress
CREATE TABLE public.group_level_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  level_id uuid NOT NULL REFERENCES public.levels(id) ON DELETE CASCADE,
  current_session integer DEFAULT 1,
  total_sessions integer DEFAULT 12,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(group_id, level_id)
);

-- Enable RLS
ALTER TABLE public.group_level_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies for group_level_progress
CREATE POLICY "Admins can manage group level progress"
ON public.group_level_progress
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Instructors can view their group progress"
ON public.group_level_progress
FOR SELECT
USING (
  has_role(auth.uid(), 'instructor'::app_role) 
  AND group_id IN (SELECT get_instructor_group_ids(auth.uid()))
);

CREATE POLICY "Students can view their group progress"
ON public.group_level_progress
FOR SELECT
USING (
  has_role(auth.uid(), 'student'::app_role) 
  AND group_id IN (SELECT get_student_group_ids(auth.uid()))
);