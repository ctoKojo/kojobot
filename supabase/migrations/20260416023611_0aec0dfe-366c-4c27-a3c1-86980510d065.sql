
DO $$
DECLARE
  v_group_id UUID := 'a9714b0b-efac-47a7-975a-74f3ae3d42a5';
  v_level_id UUID;
  v_final_quiz_id UUID;
  v_pass_threshold NUMERIC;
  v_eval_weight NUMERIC;
  v_exam_weight NUMERIC;
  v_min_exam_score NUMERIC;
BEGIN
  SELECT g.level_id INTO v_level_id FROM public.groups g WHERE g.id = v_group_id;
  SELECT l.final_exam_quiz_id, COALESCE(l.pass_threshold,50), COALESCE(l.eval_weight,0.6), COALESCE(l.exam_weight,0.4), COALESCE(l.min_exam_score,40)
  INTO v_final_quiz_id, v_pass_threshold, v_eval_weight, v_exam_weight, v_min_exam_score
  FROM public.levels l WHERE l.id = v_level_id;

  WITH eval_avgs AS (
    SELECT se.student_id, ROUND(AVG(se.percentage)) as evaluation_avg
    FROM public.session_evaluations se JOIN public.sessions s ON s.id = se.session_id
    WHERE s.group_id = v_group_id AND s.level_id = v_level_id AND s.status = 'completed'
    GROUP BY se.student_id
  ),
  exam_scores AS (
    SELECT qs.student_id, qs.percentage as final_exam_score
    FROM public.quiz_submissions qs JOIN public.quiz_assignments qa ON qa.id = qs.quiz_assignment_id
    WHERE qa.quiz_id = v_final_quiz_id AND qa.group_id = v_group_id
      AND qs.status IN ('submitted','graded')
      AND qs.submitted_at = (SELECT MAX(qs2.submitted_at) FROM public.quiz_submissions qs2
        WHERE qs2.quiz_assignment_id = qs.quiz_assignment_id AND qs2.student_id = qs.student_id AND qs2.status IN ('submitted','graded'))
  ),
  computed AS (
    SELECT ea.student_id, ea.evaluation_avg, COALESCE(es.final_exam_score, 0) as final_exam_score
    FROM eval_avgs ea LEFT JOIN exam_scores es ON es.student_id = ea.student_id
  )
  INSERT INTO public.level_grades (student_id, group_id, level_id, evaluation_avg, final_exam_score, outcome)
  SELECT c.student_id, v_group_id, v_level_id, c.evaluation_avg, c.final_exam_score,
    CASE
      WHEN ROUND((c.evaluation_avg * v_eval_weight) + (c.final_exam_score * v_exam_weight)) >= v_pass_threshold
           AND c.final_exam_score >= v_min_exam_score THEN 'passed'
      ELSE 'failed'
    END
  FROM computed c
  ON CONFLICT (student_id, group_id, level_id) DO UPDATE SET
    evaluation_avg = EXCLUDED.evaluation_avg,
    final_exam_score = EXCLUDED.final_exam_score,
    outcome = EXCLUDED.outcome,
    updated_at = now();

  UPDATE public.group_student_progress gsp SET
    outcome = lg.outcome,
    status_changed_at = now(),
    updated_at = now()
  FROM public.level_grades lg
  WHERE lg.student_id = gsp.student_id AND lg.group_id = gsp.group_id AND lg.level_id = gsp.current_level_id
    AND gsp.group_id = v_group_id;
END;
$$;
