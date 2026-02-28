-- Add is_auto_generated flag to relevant tables
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS is_auto_generated boolean NOT NULL DEFAULT false;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS is_auto_generated boolean NOT NULL DEFAULT false;
ALTER TABLE public.quiz_assignments ADD COLUMN IF NOT EXISTS is_auto_generated boolean NOT NULL DEFAULT false;
ALTER TABLE public.quiz_submissions ADD COLUMN IF NOT EXISTS is_auto_generated boolean NOT NULL DEFAULT false;
ALTER TABLE public.assignment_submissions ADD COLUMN IF NOT EXISTS is_auto_generated boolean NOT NULL DEFAULT false;

-- Mark existing auto-generated records
UPDATE public.quizzes SET is_auto_generated = true WHERE description ILIKE '%Auto-generated%';
UPDATE public.assignments SET is_auto_generated = true WHERE description ILIKE '%Complete all exercises%' AND title ILIKE '%Homework%';
UPDATE public.quiz_assignments SET is_auto_generated = true WHERE quiz_id IN (SELECT id FROM public.quizzes WHERE is_auto_generated = true);
UPDATE public.quiz_submissions SET is_auto_generated = true WHERE quiz_assignment_id IN (SELECT id FROM public.quiz_assignments WHERE is_auto_generated = true);
UPDATE public.assignment_submissions SET is_auto_generated = true WHERE assignment_id IN (SELECT id FROM public.assignments WHERE is_auto_generated = true);

-- Create indexes for filtering
CREATE INDEX IF NOT EXISTS idx_quizzes_auto_generated ON public.quizzes (is_auto_generated) WHERE is_auto_generated = false;
CREATE INDEX IF NOT EXISTS idx_assignments_auto_generated ON public.assignments (is_auto_generated) WHERE is_auto_generated = false;
CREATE INDEX IF NOT EXISTS idx_quiz_assignments_auto_generated ON public.quiz_assignments (is_auto_generated) WHERE is_auto_generated = false;
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_auto_generated ON public.quiz_submissions (is_auto_generated) WHERE is_auto_generated = false;
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_auto_generated ON public.assignment_submissions (is_auto_generated) WHERE is_auto_generated = false;