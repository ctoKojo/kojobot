CREATE OR REPLACE FUNCTION public.compute_level_grades_batch(p_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_level_id UUID;
  v_final_quiz_id UUID;
  v_pass_threshold NUMERIC;
  v_eval_weight NUMERIC;
  v_exam_weight NUMERIC;
  v_min_exam_score NUMERIC;
  v_count INTEGER;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT g.level_id INTO v_level_id FROM groups g WHERE g.id = p_group_id;
  SELECT l.final_exam_quiz_id, 
         COALESCE(l.pass_threshold, 50),
         COALESCE(l.eval_weight, 0.6),
         COALESCE(l.exam_weight, 0.4),
         COALESCE(l.min_exam_score, 40)
  INTO v_final_quiz_id, v_pass_threshold, v_eval_weight, v_exam_weight, v_min_exam_score
  FROM levels l WHERE l.id = v_level_id;

  WITH eval_avgs AS (
    SELECT se.student_id,
      ROUND(AVG(se.percentage)) as evaluation_avg
    FROM session_evaluations se
    JOIN sessions s ON s.id = se.session_id
    WHERE s.group_id = p_group_id
      AND s.level_id = v_level_id
      AND s.status = 'completed'
      AND se.scores::text != '{}'
    GROUP BY se.student_id
  ),
  exam_scores AS (
    SELECT qs.student_id,
      qs.percentage as final_exam_score
    FROM quiz_submissions qs
    JOIN quiz_assignments qa ON qa.id = qs.quiz_assignment_id
    WHERE qa.quiz_id = v_final_quiz_id
      AND qa.group_id = p_group_id
      AND qs.status IN ('submitted', 'graded')
      AND COALESCE(qs.grading_status, 'fully_graded') = 'fully_graded'
      AND qs.submitted_at = (
        SELECT MAX(qs2.submitted_at)
        FROM quiz_submissions qs2
        WHERE qs2.quiz_assignment_id = qs.quiz_assignment_id
          AND qs2.student_id = qs.student_id
          AND qs2.status IN ('submitted', 'graded')
          AND COALESCE(qs2.grading_status, 'fully_graded') = 'fully_graded'
      )
  ),
  computed AS (
    SELECT 
      es.student_id,
      COALESCE(ea.evaluation_avg, 0) as evaluation_avg,
      es.final_exam_score
    FROM exam_scores es
    LEFT JOIN eval_avgs ea ON ea.student_id = es.student_id
  )
  INSERT INTO level_grades (student_id, group_id, level_id, evaluation_avg, final_exam_score, outcome, graded_by)
  SELECT 
    c.student_id, p_group_id, v_level_id,
    c.evaluation_avg, 
    c.final_exam_score,
    CASE 
      WHEN ROUND((c.evaluation_avg * v_eval_weight) + (c.final_exam_score * v_exam_weight)) >= v_pass_threshold 
           AND c.final_exam_score >= v_min_exam_score
        THEN 'passed'
      WHEN ROUND((c.evaluation_avg * v_eval_weight) + (c.final_exam_score * v_exam_weight)) >= v_pass_threshold 
           AND c.final_exam_score < v_min_exam_score
        THEN 'failed_exam'
      ELSE 'failed_total'
    END,
    auth.uid()
  FROM computed c
  ON CONFLICT (student_id, group_id, level_id)
  DO UPDATE SET
    evaluation_avg = EXCLUDED.evaluation_avg,
    final_exam_score = EXCLUDED.final_exam_score,
    outcome = EXCLUDED.outcome,
    graded_by = EXCLUDED.graded_by,
    updated_at = now();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Only update progress for students actually graded in this batch
  UPDATE group_student_progress gsp
  SET status = 'graded',
    outcome = lg.outcome,
    graded_at = now(),
    updated_at = now()
  FROM level_grades lg
  WHERE lg.group_id = p_group_id
    AND lg.level_id = v_level_id
    AND lg.student_id = gsp.student_id
    AND gsp.group_id = p_group_id
    AND lg.updated_at >= now() - INTERVAL '1 minute';

  -- Mark group as fully graded only when every active student has a level_grade
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

  RETURN jsonb_build_object('graded_count', v_count);
END;
$function$;