-- Create instructor_warnings table
CREATE TABLE public.instructor_warnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instructor_id UUID NOT NULL,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  issued_by UUID,
  reason TEXT NOT NULL,
  reason_ar TEXT,
  warning_type TEXT NOT NULL CHECK (warning_type IN ('no_quiz', 'no_assignment', 'no_attendance')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add index for faster lookups
CREATE INDEX idx_instructor_warnings_instructor ON public.instructor_warnings(instructor_id);
CREATE INDEX idx_instructor_warnings_session ON public.instructor_warnings(session_id);
CREATE INDEX idx_instructor_warnings_active ON public.instructor_warnings(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.instructor_warnings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage instructor warnings"
  ON public.instructor_warnings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Instructors can view their own warnings"
  ON public.instructor_warnings
  FOR SELECT
  USING (has_role(auth.uid(), 'instructor'::app_role) AND instructor_id = auth.uid());

-- Update student warnings table to add assignment_id if not exists
ALTER TABLE public.warnings 
  ADD COLUMN IF NOT EXISTS assignment_id UUID REFERENCES public.assignments(id) ON DELETE SET NULL;

-- Add index for student warnings by assignment
CREATE INDEX IF NOT EXISTS idx_warnings_assignment ON public.warnings(assignment_id);

-- Drop the existing check constraint and add new one with 'deadline' type
ALTER TABLE public.warnings DROP CONSTRAINT IF EXISTS warnings_warning_type_check;
ALTER TABLE public.warnings ADD CONSTRAINT warnings_warning_type_check 
  CHECK (warning_type IN ('attendance', 'behavior', 'assignment', 'deadline', 'other'));