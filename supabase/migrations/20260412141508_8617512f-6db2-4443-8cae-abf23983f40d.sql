
-- 1. Update quiz_questions: add open_ended type, model_answer, rubric
ALTER TABLE public.quiz_questions DROP CONSTRAINT quiz_questions_question_type_check;
ALTER TABLE public.quiz_questions ADD CONSTRAINT quiz_questions_question_type_check 
  CHECK (question_type = ANY (ARRAY['multiple_choice'::text, 'true_false'::text, 'short_answer'::text, 'open_ended'::text]));

-- Make correct_answer nullable (open_ended questions don't have a single correct answer)
ALTER TABLE public.quiz_questions ALTER COLUMN correct_answer DROP NOT NULL;

-- Add model_answer and rubric columns
ALTER TABLE public.quiz_questions ADD COLUMN model_answer TEXT;
ALTER TABLE public.quiz_questions ADD COLUMN rubric JSONB;

-- 2. Update quiz_submissions: add grading_status and manual_score
ALTER TABLE public.quiz_submissions ADD COLUMN grading_status TEXT NOT NULL DEFAULT 'auto_graded';
ALTER TABLE public.quiz_submissions ADD COLUMN manual_score INTEGER DEFAULT 0;

-- 3. Create quiz_question_attempts table for per-question grading
CREATE TABLE public.quiz_question_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.quiz_submissions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  answer TEXT,
  score INTEGER,
  max_score INTEGER NOT NULL DEFAULT 1,
  feedback TEXT,
  graded_by UUID,
  grading_status TEXT NOT NULL DEFAULT 'ungraded',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  graded_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(submission_id, question_id)
);

-- Enable RLS
ALTER TABLE public.quiz_question_attempts ENABLE ROW LEVEL SECURITY;

-- Students can view their own attempts
CREATE POLICY "Students can view their own attempts"
ON public.quiz_question_attempts
FOR SELECT
TO authenticated
USING (student_id = auth.uid());

-- Admins can do everything
CREATE POLICY "Admins full access on attempts"
ON public.quiz_question_attempts
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Instructors can view and grade attempts for their groups
CREATE POLICY "Instructors can view and grade attempts"
ON public.quiz_question_attempts
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'instructor'::app_role));

-- Index for fast lookups
CREATE INDEX idx_quiz_question_attempts_submission ON public.quiz_question_attempts(submission_id);
CREATE INDEX idx_quiz_question_attempts_student ON public.quiz_question_attempts(student_id);
CREATE INDEX idx_quiz_question_attempts_grading ON public.quiz_question_attempts(grading_status) WHERE grading_status = 'ungraded';
