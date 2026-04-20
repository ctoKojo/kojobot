
-- Fix: schedule_final_exam_for_students must count attended sessions even when
-- s.level_id is NULL (legacy data from before session-level binding was enforced).
-- Treat NULL session.level_id as belonging to the student's current_level_id.

CREATE OR REPLACE FUNCTION public.schedule_final_exam_for_students(
  p_group_id UUID,
  p_student_ids UUID[],
  p_date TIMESTAMPTZ,
  p_duration INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_final_quiz_id UUID;
  v_level_id UUID;
  v_eligible UUID[];
  v_student_id UUID;
  v_scheduled_count INTEGER := 0;
  v_skipped_count INTEGER := 0;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) AND NOT has_role(auth.uid(), 'reception'::app_role) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT g.level_id INTO v_level_id FROM groups g WHERE g.id = p_group_id;
  SELECT l.final_exam_quiz_id INTO v_final_quiz_id FROM levels l WHERE l.id = v_level_id;

  IF v_final_quiz_id IS NULL THEN
    RAISE EXCEPTION 'No final exam configured for this level';
  END IF;

  -- Find eligible students (enough sessions + not yet graded)
  -- COALESCE handles legacy sessions where s.level_id was NULL.
  SELECT array_agg(sc.student_id) INTO v_eligible
  FROM (
    SELECT gsp.student_id
    FROM group_student_progress gsp
    JOIN levels l ON l.id = gsp.current_level_id
    WHERE gsp.group_id = p_group_id
      AND gsp.student_id = ANY(p_student_ids)
      AND gsp.status IN ('in_progress', 'awaiting_exam', 'exam_scheduled')
      AND (
        SELECT COUNT(DISTINCT a.session_id)
        FROM attendance a
        JOIN sessions s ON s.id = a.session_id
        WHERE s.group_id = p_group_id
          AND COALESCE(s.level_id, gsp.current_level_id) = gsp.current_level_id
          AND a.student_id = gsp.student_id
          AND a.status IN ('present', 'late')
          AND s.status = 'completed'
      ) >= l.expected_sessions_count
  ) sc;

  IF v_eligible IS NULL THEN
    RETURN jsonb_build_object('scheduled', 0, 'skipped', array_length(p_student_ids, 1));
  END IF;

  FOREACH v_student_id IN ARRAY v_eligible
  LOOP
    INSERT INTO quiz_assignments (quiz_id, student_id, group_id, assigned_by, start_time, due_date)
    VALUES (v_final_quiz_id, v_student_id, p_group_id, auth.uid(), p_date,
            p_date + (p_duration || ' minutes')::interval)
    ON CONFLICT (quiz_id, student_id, group_id)
      WHERE student_id IS NOT NULL AND group_id IS NOT NULL
    DO UPDATE SET
      start_time = EXCLUDED.start_time,
      due_date = EXCLUDED.due_date,
      is_active = true;

    v_scheduled_count := v_scheduled_count + 1;

    UPDATE group_student_progress
    SET status = 'exam_scheduled', exam_scheduled_at = p_date, updated_at = now()
    WHERE group_id = p_group_id AND student_id = v_student_id;
  END LOOP;

  v_skipped_count := COALESCE(array_length(p_student_ids, 1), 0) - v_scheduled_count;

  UPDATE groups SET level_status = 'exam_scheduled' WHERE id = p_group_id;

  RETURN jsonb_build_object(
    'scheduled', v_scheduled_count,
    'skipped', v_skipped_count,
    'total_eligible', COALESCE(array_length(v_eligible, 1), 0)
  );
END;
$$;
