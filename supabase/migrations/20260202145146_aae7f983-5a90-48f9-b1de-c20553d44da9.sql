-- Step 1: Add session_id to quiz_assignments table
ALTER TABLE public.quiz_assignments ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE;

-- Step 2: Add session_id to assignments table  
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE;

-- Step 3: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_quiz_assignments_session_id ON public.quiz_assignments(session_id);
CREATE INDEX IF NOT EXISTS idx_assignments_session_id ON public.assignments(session_id);

-- Step 4: Create a view for session details with all related data
CREATE OR REPLACE VIEW public.session_details AS
SELECT 
  s.id as session_id,
  s.session_number,
  s.session_date,
  s.session_time,
  s.duration_minutes,
  s.status,
  s.topic,
  s.topic_ar,
  s.group_id,
  g.name as group_name,
  g.name_ar as group_name_ar,
  g.instructor_id,
  qa.id as quiz_assignment_id,
  qa.quiz_id,
  q.title as quiz_title,
  q.title_ar as quiz_title_ar,
  a.id as assignment_id,
  a.title as assignment_title,
  a.title_ar as assignment_title_ar
FROM public.sessions s
LEFT JOIN public.groups g ON s.group_id = g.id
LEFT JOIN public.quiz_assignments qa ON qa.session_id = s.id AND qa.is_active = true
LEFT JOIN public.quizzes q ON qa.quiz_id = q.id
LEFT JOIN public.assignments a ON a.session_id = s.id AND a.is_active = true;