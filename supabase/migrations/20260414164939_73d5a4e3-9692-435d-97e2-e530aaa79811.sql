CREATE TABLE public.exam_live_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  quiz_assignment_id UUID NOT NULL REFERENCES public.quiz_assignments(id) ON DELETE CASCADE,
  current_question_index INTEGER NOT NULL DEFAULT 0,
  answered_count INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'in_progress',
  UNIQUE(student_id, quiz_assignment_id)
);

ALTER TABLE public.exam_live_progress ENABLE ROW LEVEL SECURITY;

-- Admins and reception can view all progress
CREATE POLICY "Admin/reception view exam progress"
ON public.exam_live_progress FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'reception'::app_role)
);

-- Students can manage their own progress
CREATE POLICY "Students manage own exam progress"
ON public.exam_live_progress FOR ALL TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.exam_live_progress;