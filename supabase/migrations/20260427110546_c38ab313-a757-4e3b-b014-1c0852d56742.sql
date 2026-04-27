CREATE OR REPLACE FUNCTION public.get_student_level_report(p_student_id uuid, p_level_id uuid, p_group_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_group_id uuid := p_group_id;
  v_result jsonb;
  v_student jsonb;
  v_level jsonb;
  v_group jsonb;
  v_attendance jsonb;
  v_evaluations jsonb;
  v_quizzes jsonb;
  v_assignments jsonb;
  v_final_exam jsonb;
  v_grade jsonb;
  v_attendance_stats jsonb;
BEGIN
  -- Permission check: admin OR reception only
  IF NOT (public.has_role(v_caller, 'admin'::app_role) OR public.has_role(v_caller, 'reception'::app_role)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Resolve group_id if not provided: pick latest group_member for this student where group has level
  IF v_group_id IS NULL THEN
    SELECT gm.group_id INTO v_group_id
    FROM group_members gm
    JOIN groups g ON g.id = gm.group_id
    WHERE gm.student_id = p_student_id
      AND (g.level_id = p_level_id OR EXISTS (
        SELECT 1 FROM sessions s WHERE s.group_id = g.id AND s.level_id = p_level_id
      ))
    ORDER BY gm.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  -- Student info
  SELECT jsonb_build_object(
    'user_id', p.user_id,
    'full_name', p.full_name,
    'full_name_ar', p.full_name_ar,
    'email', p.email,
    'phone', p.phone,
    'avatar_url', p.avatar_url
  )
  INTO v_student
  FROM profiles p
  WHERE p.user_id = p_student_id;

  -- Level info
  SELECT jsonb_build_object(
    'id', l.id,
    'name', l.name,
    'name_ar', l.name_ar,
    'expected_sessions', l.expected_sessions_count
  )
  INTO v_level
  FROM levels l
  WHERE l.id = p_level_id;

  -- Group info
  IF v_group_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id', g.id,
      'name', g.name,
      'name_ar', g.name_ar,
      'status', g.status
    )
    INTO v_group
    FROM groups g
    WHERE g.id = v_group_id;
  END IF;

  -- Attendance for sessions of this group filtered by level_id
  WITH lvl_sessions AS (
    SELECT s.id, s.session_number, s.session_date, s.session_time, s.topic, s.topic_ar, s.status, s.is_makeup
    FROM sessions s
    WHERE s.group_id = v_group_id
      AND (s.level_id = p_level_id OR s.level_id IS NULL)
  ),
  att AS (
    SELECT a.session_id, a.status, a.recorded_at, a.notes
    FROM attendance a
    WHERE a.student_id = p_student_id
      AND a.session_id IN (SELECT id FROM lvl_sessions)
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'session_id', ls.id,
      'session_number', ls.session_number,
      'session_date', ls.session_date,
      'session_time', ls.session_time,
      'topic', ls.topic,
      'topic_ar', ls.topic_ar,
      'session_status', ls.status,
      'is_makeup', ls.is_makeup,
      'attendance_status', a.status,
      'recorded_at', a.recorded_at,
      'notes', a.notes
    ) ORDER BY ls.session_number NULLS LAST, ls.session_date
  )
  INTO v_attendance
  FROM lvl_sessions ls
  LEFT JOIN att a ON a.session_id = ls.id;

  -- Attendance stats
  SELECT jsonb_build_object(
    'total_sessions', COUNT(*),
    'present', COUNT(*) FILTER (WHERE attendance_status = 'present'),
    'absent', COUNT(*) FILTER (WHERE attendance_status = 'absent'),
    'late', COUNT(*) FILTER (WHERE attendance_status = 'late'),
    'excused', COUNT(*) FILTER (WHERE attendance_status = 'excused'),
    'unrecorded', COUNT(*) FILTER (WHERE attendance_status IS NULL),
    'attendance_rate', CASE
      WHEN COUNT(*) FILTER (WHERE attendance_status IS NOT NULL) > 0
      THEN ROUND(100.0 * COUNT(*) FILTER (WHERE attendance_status IN ('present','late','excused'))
        / COUNT(*) FILTER (WHERE attendance_status IS NOT NULL), 1)
      ELSE 0
    END
  )
  INTO v_attendance_stats
  FROM jsonb_to_recordset(COALESCE(v_attendance, '[]'::jsonb))
    AS x(attendance_status text);

  -- Session evaluations within this group/level (via sessions)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', se.id,
      'session_id', se.session_id,
      'session_number', s.session_number,
      'session_date', s.session_date,
      'topic', s.topic,
      'topic_ar', s.topic_ar,
      'total_behavior_score', se.total_behavior_score,
      'max_behavior_score', se.max_behavior_score,
      'quiz_score', se.quiz_score,
      'quiz_max_score', se.quiz_max_score,
      'assignment_score', se.assignment_score,
      'assignment_max_score', se.assignment_max_score,
      'total_score', se.total_score,
      'max_total_score', se.max_total_score,
      'percentage', se.percentage,
      'tags', se.student_feedback_tags,
      'notes', se.notes
    ) ORDER BY s.session_number NULLS LAST, s.session_date
  )
  INTO v_evaluations
  FROM session_evaluations se
  JOIN sessions s ON s.id = se.session_id
  WHERE se.student_id = p_student_id
    AND s.group_id = v_group_id
    AND (s.level_id = p_level_id OR s.level_id IS NULL);

  -- Quizzes (non-final-exam) assigned to this student within group/level
  SELECT jsonb_agg(
    jsonb_build_object(
      'assignment_id', qa.id,
      'quiz_id', q.id,
      'title', q.title,
      'title_ar', q.title_ar,
      'session_number', s.session_number,
      'session_date', s.session_date,
      'due_date', qa.due_date,
      'duration_minutes', q.duration_minutes,
      'passing_score', q.passing_score,
      'submission_status', sub.status,
      'submitted_at', sub.submitted_at,
      'score', sub.score,
      'max_score', sub.max_score,
      'percentage', sub.percentage,
      'grading_status', sub.grading_status
    ) ORDER BY s.session_number NULLS LAST, qa.created_at
  )
  INTO v_quizzes
  FROM quiz_assignments qa
  JOIN quizzes q ON q.id = qa.quiz_id
  LEFT JOIN sessions s ON s.id = qa.session_id
  LEFT JOIN quiz_submissions sub ON sub.quiz_assignment_id = qa.id AND sub.student_id = p_student_id
  WHERE qa.is_active = true
    AND qa.is_auto_generated = false
    AND (qa.student_id = p_student_id OR qa.group_id = v_group_id)
    AND q.level_id = p_level_id
    AND NOT EXISTS (SELECT 1 FROM levels l WHERE l.final_exam_quiz_id = q.id);

  -- Assignments
  SELECT jsonb_agg(
    jsonb_build_object(
      'assignment_id', a.id,
      'title', a.title,
      'title_ar', a.title_ar,
      'session_number', s.session_number,
      'session_date', s.session_date,
      'due_date', a.due_date,
      'max_score', a.max_score,
      'submission_status', sub.status,
      'submitted_at', sub.submitted_at,
      'score', sub.score,
      'feedback', sub.feedback,
      'feedback_ar', sub.feedback_ar
    ) ORDER BY s.session_number NULLS LAST, a.created_at
  )
  INTO v_assignments
  FROM assignments a
  LEFT JOIN sessions s ON s.id = a.session_id
  LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id AND sub.student_id = p_student_id
  WHERE a.is_active = true
    AND a.is_auto_generated = false
    AND (a.student_id = p_student_id OR a.group_id = v_group_id)
    AND (s.level_id = p_level_id OR s.level_id IS NULL)
    AND s.group_id = v_group_id;

  -- Final exam (level.final_exam_quiz_id)
  SELECT jsonb_build_object(
    'quiz_id', q.id,
    'title', q.title,
    'title_ar', q.title_ar,
    'duration_minutes', q.duration_minutes,
    'passing_score', q.passing_score,
    'assignment_id', qa.id,
    'due_date', qa.due_date,
    'submission_id', sub.id,
    'submission_status', sub.status,
    'started_at', sub.started_at,
    'submitted_at', sub.submitted_at,
    'score', sub.score,
    'max_score', sub.max_score,
    'percentage', sub.percentage,
    'grading_status', sub.grading_status,
    'graded_at', sub.graded_at
  )
  INTO v_final_exam
  FROM levels l
  LEFT JOIN quizzes q ON q.id = l.final_exam_quiz_id
  LEFT JOIN quiz_assignments qa ON qa.quiz_id = q.id
       AND (qa.student_id = p_student_id OR qa.group_id = v_group_id)
       AND qa.is_active = true
  LEFT JOIN quiz_submissions sub ON sub.quiz_assignment_id = qa.id AND sub.student_id = p_student_id
  WHERE l.id = p_level_id
  ORDER BY sub.submitted_at DESC NULLS LAST, qa.created_at DESC NULLS LAST
  LIMIT 1;

  -- Final grade record
  SELECT jsonb_build_object(
    'id', lg.id,
    'evaluation_avg', lg.evaluation_avg,
    'final_exam_score', lg.final_exam_score,
    'total_score', lg.total_score,
    'percentage', lg.percentage,
    'outcome', lg.outcome,
    'notes', lg.notes,
    'created_at', lg.created_at,
    'updated_at', lg.updated_at
  )
  INTO v_grade
  FROM level_grades lg
  WHERE lg.student_id = p_student_id
    AND lg.level_id = p_level_id
    AND (v_group_id IS NULL OR lg.group_id = v_group_id)
  ORDER BY lg.updated_at DESC
  LIMIT 1;

  v_result := jsonb_build_object(
    'student', v_student,
    'level', v_level,
    'group', v_group,
    'attendance', COALESCE(v_attendance, '[]'::jsonb),
    'attendance_stats', v_attendance_stats,
    'evaluations', COALESCE(v_evaluations, '[]'::jsonb),
    'quizzes', COALESCE(v_quizzes, '[]'::jsonb),
    'assignments', COALESCE(v_assignments, '[]'::jsonb),
    'final_exam', v_final_exam,
    'grade', v_grade,
    'generated_at', now()
  );

  RETURN v_result;
END;
$function$;