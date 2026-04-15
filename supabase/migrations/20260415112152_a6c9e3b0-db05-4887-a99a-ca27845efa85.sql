
-- Add draft_answers storage to exam_live_progress for server-side answer persistence
ALTER TABLE public.exam_live_progress 
  ADD COLUMN IF NOT EXISTS draft_answers JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS draft_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS draft_updated_at TIMESTAMPTZ DEFAULT now();

-- Add index for quick lookup during grading fallback
CREATE INDEX IF NOT EXISTS idx_exam_live_progress_assignment_student 
  ON public.exam_live_progress (quiz_assignment_id, student_id);

-- Ensure no duplicate quiz submissions (idempotency)
-- Check if constraint exists first
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'uq_quiz_submission_student'
  ) THEN
    ALTER TABLE public.quiz_submissions 
      ADD CONSTRAINT uq_quiz_submission_student 
      UNIQUE (quiz_assignment_id, student_id);
  END IF;
END $$;
