-- Drop the old over-restrictive index that blocked per-student manual quiz assignments
DROP INDEX IF EXISTS public.uniq_active_manual_quiz_per_session;

-- New index 1: prevent duplicate per-student manual quiz assignment for the same session
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_manual_quiz_per_session_student
ON public.quiz_assignments (session_id, student_id)
WHERE is_active = true
  AND is_auto_generated = false
  AND session_id IS NOT NULL
  AND student_id IS NOT NULL;

-- New index 2: prevent duplicate group-level manual quiz assignment for the same session
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_manual_quiz_per_session_group
ON public.quiz_assignments (session_id)
WHERE is_active = true
  AND is_auto_generated = false
  AND session_id IS NOT NULL
  AND student_id IS NULL;