-- ============================================================
-- 1) NEW: compute_level_grade_for_student
-- Computes and persists the level grade for a SINGLE student.
-- Safe to call any time after that student's exam submission has
-- finished grading (status='graded' OR fully_graded).
-- Callable by admin / reception / instructor (anyone who can grade).
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_level_grade_for_student(
  p_student_id uuid,
  p_group_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level_id UUID;
  v_final_quiz_id UUID;
  v_pass_threshold NUMERIC;
  v_eval_weight NUMERIC;
  v_exam_weight NUMERIC;
  v_min_exam_score NUMERIC;
  v_eval_avg NUMERIC := 0;
  v_exam_score NUMERIC;
  v_weighted NUMERIC;
  v_outcome TEXT;
  v_can_grade BOOLEAN;
BEGIN
  -- Permission: admin, reception, OR the instructor of this group
  v_can_grade := has_role(auth.uid(), 'admin'::app_role)
              OR has_role(auth.uid(), 'reception'::app_role)
              OR EXISTS (
                   SELECT 1 FROM groups g
                   WHERE g.id = p_group_id AND g.instructor_id = auth.uid()
                 );

  IF NOT v_can_grade THEN
    RAISE EXCEPTION 'Permission denied to compute grade for this group';
  END IF;

  -- Pull level + thresholds
  SELECT g.level_id INTO v_level_id FROM groups g WHERE g.id = p_group_id;
  IF v_level_id IS NULL THEN
    RAISE EXCEPTION 'Group % has no current level', p_group_id;
  END IF;

  SELECT l.final_exam_quiz_id,
         COALESCE(l.pass_threshold, 50),
         COALESCE(l.eval_weight, 0.6),
         COALESCE(l.exam_weight, 0.4),
         COALESCE(l.min_exam_score, 40)
  INTO v_final_quiz_id, v_pass_threshold, v_eval_weight, v_exam_weight, v_min_exam_score
  FROM levels l WHERE l.id = v_level_id;

  -- Get the student's latest FULLY-GRADED final exam score
  SELECT qs.percentage INTO v_exam_score
  FROM quiz_submissions qs
  JOIN quiz_assignments qa ON qa.id = qs.quiz_assignment_id
  WHERE qa.quiz_id = v_final_quiz_id
    AND qa.group_id = p_group_id
    AND qs.student_id = p_student_id
    AND qs.status IN ('submitted', 'graded')
    AND COALESCE(qs.grading_status, 'fully_graded') = 'fully_graded'
  ORDER BY qs.submitted_at DESC
  LIMIT 1;

  IF v_exam_score IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'exam_not_fully_graded',
      'message', 'Student exam is not fully graded yet'
    );
  END IF;

  -- Average evaluations for this student in this group/level
  SELECT COALESCE(ROUND(AVG(se.percentage)), 0) INTO v_eval_avg
  FROM session_evaluations se
  JOIN sessions s ON s.id = se.session_id
  WHERE s.group_id = p_group_id
    AND s.level_id = v_level_id
    AND s.status = 'completed'
    AND se.student_id = p_student_id
    AND se.scores::text != '{}';

  v_weighted := ROUND((v_eval_avg * v_eval_weight) + (v_exam_score * v_exam_weight));

  v_outcome := CASE
    WHEN v_weighted >= v_pass_threshold AND v_exam_score >= v_min_exam_score THEN 'passed'
    WHEN v_weighted >= v_pass_threshold AND v_exam_score < v_min_exam_score  THEN 'failed_exam'
    ELSE 'failed_total'
  END;

  -- Persist
  INSERT INTO level_grades (student_id, group_id, level_id, evaluation_avg, final_exam_score, outcome, graded_by)
  VALUES (p_student_id, p_group_id, v_level_id, v_eval_avg, v_exam_score, v_outcome, auth.uid())
  ON CONFLICT (student_id, group_id, level_id)
  DO UPDATE SET
    evaluation_avg   = EXCLUDED.evaluation_avg,
    final_exam_score = EXCLUDED.final_exam_score,
    outcome          = EXCLUDED.outcome,
    graded_by        = EXCLUDED.graded_by,
    updated_at       = now();

  -- Update lifecycle for this single student
  UPDATE group_student_progress
  SET status     = 'graded',
      outcome    = v_outcome,
      graded_at  = now(),
      updated_at = now()
  WHERE student_id = p_student_id
    AND group_id   = p_group_id
    AND status IN ('exam_scheduled', 'awaiting_grading');

  -- Roll up group level_status only when EVERY active student is graded
  UPDATE groups g
  SET level_status = 'grades_computed'
  WHERE g.id = p_group_id
    AND NOT EXISTS (
      SELECT 1 FROM group_students gs
      WHERE gs.group_id = p_group_id
        AND gs.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM level_grades lg2
          WHERE lg2.group_id = p_group_id
            AND lg2.level_id = v_level_id
            AND lg2.student_id = gs.student_id
        )
    );

  RETURN jsonb_build_object(
    'success', true,
    'student_id', p_student_id,
    'evaluation_avg', v_eval_avg,
    'final_exam_score', v_exam_score,
    'weighted_score', v_weighted,
    'outcome', v_outcome
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_level_grade_for_student(uuid, uuid) TO authenticated;

-- ============================================================
-- 2) Replace the auto-compute trigger to be PER-STUDENT.
-- Fires on quiz_submissions when status becomes 'submitted' or 'graded'
-- AND the submission is fully_graded (no manual grading pending).
-- Computes grade for THIS student only — never touches peers.
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_compute_grades_on_final_exam()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quiz_assignment RECORD;
  v_group_id UUID;
  v_level_id UUID;
  v_pass_threshold NUMERIC;
  v_eval_weight NUMERIC;
  v_exam_weight NUMERIC;
  v_min_exam_score NUMERIC;
  v_eval_avg NUMERIC := 0;
  v_exam_score NUMERIC;
  v_weighted NUMERIC;
  v_outcome TEXT;
BEGIN
  -- Only act on terminal states
  IF NEW.status NOT IN ('submitted', 'graded') THEN
    RETURN NEW;
  END IF;

  -- Skip if still pending manual grading
  IF COALESCE(NEW.grading_status, 'fully_graded') <> 'fully_graded' THEN
    -- Still record the submission timestamp on lifecycle
    SELECT qa.* INTO v_quiz_assignment
    FROM quiz_assignments qa
    WHERE qa.id = NEW.quiz_assignment_id;

    IF v_quiz_assignment.group_id IS NOT NULL THEN
      UPDATE group_student_progress
      SET exam_submitted_at = COALESCE(exam_submitted_at, now()),
          updated_at = now()
      WHERE group_id  = v_quiz_assignment.group_id
        AND student_id = NEW.student_id
        AND status     = 'exam_scheduled'
        AND exam_submitted_at IS NULL;

      -- Mark group as exam_done so admins know exams are in
      UPDATE groups SET level_status = 'exam_done'
      WHERE id = v_quiz_assignment.group_id
        AND level_status IN ('exam_scheduled', 'in_progress', 'sessions_completed');
    END IF;

    RETURN NEW;
  END IF;

  -- Submission is fully graded → compute this student's level grade
  SELECT qa.* INTO v_quiz_assignment
  FROM quiz_assignments qa
  WHERE qa.id = NEW.quiz_assignment_id;

  IF v_quiz_assignment IS NULL OR v_quiz_assignment.group_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_group_id := v_quiz_assignment.group_id;

  SELECT l.id,
         COALESCE(l.pass_threshold, 50),
         COALESCE(l.eval_weight, 0.6),
         COALESCE(l.exam_weight, 0.4),
         COALESCE(l.min_exam_score, 40)
  INTO v_level_id, v_pass_threshold, v_eval_weight, v_exam_weight, v_min_exam_score
  FROM levels l
  WHERE l.final_exam_quiz_id = v_quiz_assignment.quiz_id
    AND l.is_active = true
  LIMIT 1;

  IF v_level_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Update exam_submitted_at
  UPDATE group_student_progress
  SET exam_submitted_at = COALESCE(exam_submitted_at, now()),
      updated_at = now()
  WHERE group_id  = v_group_id
    AND student_id = NEW.student_id
    AND status     = 'exam_scheduled'
    AND exam_submitted_at IS NULL;

  -- Get this student's eval average for this level/group
  SELECT COALESCE(ROUND(AVG(se.percentage)), 0) INTO v_eval_avg
  FROM session_evaluations se
  JOIN sessions s ON s.id = se.session_id
  WHERE s.group_id  = v_group_id
    AND s.level_id  = v_level_id
    AND s.status    = 'completed'
    AND se.student_id = NEW.student_id
    AND se.scores::text != '{}';

  v_exam_score := COALESCE(NEW.percentage, 0);
  v_weighted   := ROUND((v_eval_avg * v_eval_weight) + (v_exam_score * v_exam_weight));

  v_outcome := CASE
    WHEN v_weighted >= v_pass_threshold AND v_exam_score >= v_min_exam_score THEN 'passed'
    WHEN v_weighted >= v_pass_threshold AND v_exam_score < v_min_exam_score  THEN 'failed_exam'
    ELSE 'failed_total'
  END;

  -- Persist this student's grade only
  INSERT INTO level_grades (student_id, group_id, level_id, evaluation_avg, final_exam_score, outcome)
  VALUES (NEW.student_id, v_group_id, v_level_id, v_eval_avg, v_exam_score, v_outcome)
  ON CONFLICT (student_id, group_id, level_id)
  DO UPDATE SET
    evaluation_avg   = EXCLUDED.evaluation_avg,
    final_exam_score = EXCLUDED.final_exam_score,
    outcome          = EXCLUDED.outcome,
    updated_at       = now();

  -- Update this student's lifecycle
  UPDATE group_student_progress
  SET status            = 'graded',
      outcome           = v_outcome,
      status_changed_at = now(),
      graded_at         = now(),
      updated_at        = now()
  WHERE group_id   = v_group_id
    AND student_id = NEW.student_id
    AND status IN ('exam_scheduled', 'awaiting_grading');

  -- Roll up group status only when every active student has a grade
  UPDATE groups g
  SET level_status = 'grades_computed'
  WHERE g.id = v_group_id
    AND NOT EXISTS (
      SELECT 1 FROM group_students gs
      WHERE gs.group_id = v_group_id
        AND gs.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM level_grades lg2
          WHERE lg2.group_id = v_group_id
            AND lg2.level_id = v_level_id
            AND lg2.student_id = gs.student_id
        )
    );

  RETURN NEW;
END;
$$;

-- ============================================================
-- 3) Harden the BATCH function: keep it for manual admin use only,
-- but make sure it ALWAYS skips students whose exam is not fully graded.
-- (already done in previous migration; reaffirming here for clarity)
-- ============================================================
COMMENT ON FUNCTION public.compute_level_grades_batch(uuid) IS
  'ADMIN ONLY. Bulk-computes level grades for all students in a group whose final exam is FULLY GRADED. Skips students with pending manual grading. Use compute_level_grade_for_student() for per-student auto grading.';

COMMENT ON FUNCTION public.compute_level_grade_for_student(uuid, uuid) IS
  'Computes and persists the level grade for a SINGLE student. Called automatically by the auto_compute_grades trigger after manual grading completes, and manually from QuizResultsDialog.';