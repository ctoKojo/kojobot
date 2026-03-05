
-- Function to auto-detect when students complete their level sessions
-- Fires when a session is marked as 'completed'
CREATE OR REPLACE FUNCTION public.check_students_level_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_student RECORD;
  v_expected_sessions INTEGER;
  v_completed_count INTEGER;
  v_student_name TEXT;
  v_level_name TEXT;
  v_group_name TEXT;
BEGIN
  -- Only when session becomes completed
  IF NEW.status != 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  IF NEW.level_id IS NULL OR NEW.group_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get expected sessions
  SELECT l.expected_sessions_count INTO v_expected_sessions
  FROM levels l WHERE l.id = NEW.level_id;

  IF v_expected_sessions IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get level and group names for notification
  SELECT l.name INTO v_level_name FROM levels l WHERE l.id = NEW.level_id;
  SELECT g.name INTO v_group_name FROM groups g WHERE g.id = NEW.group_id;

  -- Check each student who attended this session
  FOR v_student IN
    SELECT a.student_id
    FROM attendance a
    WHERE a.session_id = NEW.id
      AND a.status IN ('present', 'late')
  LOOP
    -- Check if still in_progress
    IF NOT EXISTS (
      SELECT 1 FROM group_student_progress gsp
      WHERE gsp.student_id = v_student.student_id
        AND gsp.group_id = NEW.group_id
        AND gsp.status = 'in_progress'
    ) THEN
      CONTINUE;
    END IF;

    -- Count completed sessions for this student in this level
    SELECT COUNT(DISTINCT a.session_id) INTO v_completed_count
    FROM attendance a
    JOIN sessions s ON s.id = a.session_id
    WHERE a.student_id = v_student.student_id
      AND s.group_id = NEW.group_id
      AND s.level_id = NEW.level_id
      AND s.status = 'completed'
      AND a.status IN ('present', 'late');

    IF v_completed_count >= v_expected_sessions THEN
      -- Update progress status to awaiting_exam
      UPDATE group_student_progress
      SET status = 'awaiting_exam', updated_at = now()
      WHERE student_id = v_student.student_id AND group_id = NEW.group_id;

      -- Deactivate student from group
      UPDATE group_students
      SET is_active = false
      WHERE student_id = v_student.student_id AND group_id = NEW.group_id;

      -- Get student name for notification
      SELECT p.full_name INTO v_student_name
      FROM profiles p WHERE p.user_id = v_student.student_id;

      -- Notify admin and reception
      INSERT INTO notifications (user_id, title, title_ar, message, message_ar, type, category, action_url)
      SELECT
        ur.user_id,
        'Student Ready for Final Exam',
        'طالب جاهز للامتحان النهائي',
        COALESCE(v_student_name, 'Student') || ' completed ' || COALESCE(v_level_name, 'level') || ' in ' || COALESCE(v_group_name, 'group'),
        COALESCE(v_student_name, 'طالب') || ' أكمل ' || COALESCE(v_level_name, 'المستوى') || ' في ' || COALESCE(v_group_name, 'المجموعة'),
        'info',
        'system',
        '/students'
      FROM user_roles ur
      WHERE ur.role IN ('admin', 'reception');
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create trigger on sessions table (fires when session status changes to completed)
DROP TRIGGER IF EXISTS trg_check_level_completion ON sessions;
CREATE TRIGGER trg_check_level_completion
  AFTER UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION check_students_level_completion();
