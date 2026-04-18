-- 1) Add retry counter
ALTER TABLE public.group_student_progress
  ADD COLUMN IF NOT EXISTS exam_retry_count integer NOT NULL DEFAULT 0;

-- 2) Recreate the candidates view to include outcome + retry count and surface failed students
DROP VIEW IF EXISTS public.final_exam_candidates;
CREATE VIEW public.final_exam_candidates
WITH (security_invoker = true)
AS
SELECT
  gsp.id AS progress_id,
  gsp.student_id,
  gsp.group_id,
  gsp.current_level_id,
  gsp.status,
  gsp.outcome,
  gsp.exam_retry_count,
  gsp.exam_scheduled_at,
  gsp.exam_submitted_at,
  gsp.graded_at,
  gsp.status_changed_at,
  p.full_name,
  p.full_name_ar,
  p.avatar_url,
  g.name AS group_name,
  g.name_ar AS group_name_ar,
  l.name AS level_name,
  l.name_ar AS level_name_ar,
  l.final_exam_quiz_id
FROM group_student_progress gsp
JOIN profiles p ON p.user_id = gsp.student_id
JOIN groups g ON g.id = gsp.group_id
JOIN levels l ON l.id = gsp.current_level_id
WHERE gsp.status IN ('awaiting_exam', 'exam_scheduled', 'graded');

-- 3) Reschedule RPC: lets admin/reception give a failed student ONE more attempt
CREATE OR REPLACE FUNCTION public.reschedule_failed_final_exam(
  p_progress_id uuid,
  p_date timestamp with time zone,
  p_duration integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_student_id uuid;
  v_group_id uuid;
  v_level_id uuid;
  v_outcome text;
  v_retry_count integer;
  v_quiz_id uuid;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) AND NOT has_role(auth.uid(), 'reception'::app_role) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT gsp.student_id, gsp.group_id, gsp.current_level_id, gsp.outcome, gsp.exam_retry_count, l.final_exam_quiz_id
    INTO v_student_id, v_group_id, v_level_id, v_outcome, v_retry_count, v_quiz_id
  FROM group_student_progress gsp
  JOIN levels l ON l.id = gsp.current_level_id
  WHERE gsp.id = p_progress_id;

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Progress record not found';
  END IF;

  IF v_outcome NOT IN ('failed', 'failed_exam') THEN
    RAISE EXCEPTION 'Only failed exams can be rescheduled (current outcome: %)', COALESCE(v_outcome, 'null');
  END IF;

  IF v_retry_count >= 1 THEN
    RAISE EXCEPTION 'Maximum retry attempts reached. Student must repeat the level.';
  END IF;

  IF v_quiz_id IS NULL THEN
    RAISE EXCEPTION 'No final exam configured for this level';
  END IF;

  IF p_date < now() THEN
    RAISE EXCEPTION 'Cannot reschedule to a past date';
  END IF;

  -- Reset the quiz assignment with new schedule
  UPDATE quiz_assignments
  SET start_time = p_date,
      due_date = p_date + (p_duration || ' minutes')::interval,
      is_active = true
  WHERE quiz_id = v_quiz_id
    AND student_id = v_student_id
    AND group_id = v_group_id;

  -- Clear previous live progress (if any) so the student can take the exam again
  DELETE FROM exam_live_progress
  WHERE student_id = v_student_id
    AND quiz_assignment_id IN (
      SELECT id FROM quiz_assignments
      WHERE quiz_id = v_quiz_id AND student_id = v_student_id AND group_id = v_group_id
    );

  -- Remove the previous level grade so it gets recomputed after the retry
  DELETE FROM level_grades
  WHERE student_id = v_student_id
    AND group_id = v_group_id
    AND level_id = v_level_id;

  -- Reset progress: back to exam_scheduled, increment retry counter, clear outcome
  UPDATE group_student_progress
  SET status = 'exam_scheduled',
      outcome = NULL,
      exam_scheduled_at = p_date,
      exam_submitted_at = NULL,
      graded_at = NULL,
      exam_retry_count = exam_retry_count + 1,
      status_changed_at = now(),
      updated_at = now()
  WHERE id = p_progress_id;

  RETURN jsonb_build_object(
    'rescheduled', true,
    'student_id', v_student_id,
    'group_id', v_group_id,
    'new_retry_count', v_retry_count + 1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reschedule_failed_final_exam(uuid, timestamp with time zone, integer) TO authenticated;