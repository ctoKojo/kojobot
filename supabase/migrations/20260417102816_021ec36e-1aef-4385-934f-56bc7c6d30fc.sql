-- 1) SECURITY: Remove direct student access to quiz_questions (correct_answer leak)
-- Students must go through quiz_questions_student_view (which excludes correct_answer)
DROP POLICY IF EXISTS "Students can view questions of assigned quizzes" ON public.quiz_questions;

-- 2) SINGLE SOURCE OF TRUTH for correctness
ALTER TABLE public.quiz_question_attempts
  ADD COLUMN IF NOT EXISTS is_correct boolean;

-- Backfill: derive from existing score/max_score for non-open-ended attempts
UPDATE public.quiz_question_attempts
SET is_correct = CASE
  WHEN grading_status = 'ungraded' THEN NULL
  WHEN max_score IS NULL OR max_score = 0 THEN NULL
  WHEN score IS NULL THEN NULL
  ELSE (score >= max_score)
END
WHERE is_correct IS NULL;

CREATE INDEX IF NOT EXISTS idx_quiz_question_attempts_submission
  ON public.quiz_question_attempts(submission_id);

-- 3) SNAPSHOT: freeze the questions a student saw at submission time
-- Stored without correct_answer; safe to expose to the student post-submit.
ALTER TABLE public.quiz_submissions
  ADD COLUMN IF NOT EXISTS questions_snapshot jsonb;

COMMENT ON COLUMN public.quiz_submissions.questions_snapshot IS
  'Frozen array of {id, question_text, question_text_ar, options, points, order_index, image_url, code_snippet, question_type} at submission time. Never includes correct_answer.';

COMMENT ON COLUMN public.quiz_question_attempts.is_correct IS
  'Server-determined correctness. NULL = not yet graded (open_ended pending manual grading).';