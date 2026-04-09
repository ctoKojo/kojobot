
CREATE OR REPLACE FUNCTION public.check_students_level_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_student RECORD;
  v_expected_sessions INTEGER;
  v_distinct_content_completed INTEGER;
  v_owed INTEGER;
  v_student_name TEXT;
  v_level_name TEXT;
  v_group_name TEXT;
BEGIN
  -- Only fire when a session becomes completed
  IF NEW.status != 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  IF NEW.level_id IS NULL OR NEW.group_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get expected session count for this level
  SELECT l.expected_sessions_count INTO v_expected_sessions
  FROM levels l WHERE l.id = NEW.level_id;

  IF v_expected_sessions IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check owed sessions from groups table
  SELECT g.owed_sessions_count INTO v_owed
  FROM groups g WHERE g.id = NEW.group_id;

  IF v_owed IS NOT NULL AND v_owed > 0 THEN
    RETURN NEW;
  END IF;

  -- Count distinct content_numbers completed in this group (the real source of truth)
  -- This avoids the race condition of reading last_delivered_content_number
  SELECT COUNT(DISTINCT s.content_number) INTO v_distinct_content_completed
  FROM sessions s
  WHERE s.group_id = NEW.group_id
    AND s.status = 'completed'
    AND s.is_makeup = false
    AND s.content_number IS NOT NULL
    AND s.content_number >= 1
    AND s.content_number <= v_expected_sessions;

  -- If not all content delivered yet, skip
  IF v_distinct_content_completed < v_expected_sessions THEN
    RETURN NEW;
  END IF;

  SELECT l.name INTO v_level_name FROM levels l WHERE l.id = NEW.level_id;
  SELECT g.name INTO v_group_name FROM groups g WHERE g.id = NEW.group_id;

  -- Check each student who is in_progress in this group
  FOR v_student IN
    SELECT gsp.student_id
    FROM group_student_progress gsp
    WHERE gsp.group_id = NEW.group_id
      AND gsp.status = 'in_progress'
  LOOP
    -- Verify student has attended enough sessions (present or late)
    DECLARE
      v_student_attended INTEGER;
    BEGIN
      SELECT COUNT(DISTINCT s2.content_number) INTO v_student_attended
      FROM attendance a
      JOIN sessions s2 ON s2.id = a.session_id
      WHERE a.student_id = v_student.student_id
        AND s2.group_id = NEW.group_id
        AND s2.is_makeup = false
        AND a.status IN ('present', 'late')
        AND s2.content_number IS NOT NULL
        AND s2.content_number >= 1
        AND s2.content_number <= v_expected_sessions;

      IF v_student_attended < v_expected_sessions THEN
        CONTINUE;
      END IF;
    END;

    -- Update progress status to awaiting_exam
    UPDATE group_student_progress
    SET status = 'awaiting_exam',
        status_changed_at = now(),
        updated_at = now()
    WHERE student_id = v_student.student_id AND group_id = NEW.group_id;

    SELECT p.full_name INTO v_student_name
    FROM profiles p WHERE p.user_id = v_student.student_id;

    -- Notify admins and reception
    INSERT INTO notifications (user_id, title, title_ar, message, message_ar, type, category, action_url)
    SELECT
      ur.user_id,
      'Student Ready for Final Exam',
      'طالب جاهز للامتحان النهائي',
      COALESCE(v_student_name, 'Student') || ' completed ' || COALESCE(v_level_name, 'level') || ' in ' || COALESCE(v_group_name, 'group'),
      COALESCE(v_student_name, 'طالب') || ' أكمل ' || COALESCE(v_level_name, 'المستوى') || ' في ' || COALESCE(v_group_name, 'المجموعة'),
      'info',
      'system',
      '/final-exams'
    FROM user_roles ur
    WHERE ur.role IN ('admin', 'reception');
  END LOOP;

  RETURN NEW;
END;
$function$;
