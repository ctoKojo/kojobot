
-- ============================================================
-- Phase 2 Step 1: Database Logic Migration
-- ============================================================
-- Rules:
-- 1. session_number on makeup sessions stays for display/tracking
-- 2. content_number is the real curriculum reference (assigned on completion)
-- 3. level completion = last_delivered_content_number >= expected AND owed_sessions_count <= 0
-- 4. cancelled regular session → session_number + 1 + owed_sessions_count += 1
-- 5. unique index: regular sessions only (makeup excluded by is_makeup filter)
-- ============================================================

-- ============================================================
-- PART A: New trigger — assign content_number on completion
-- Named 'a_assign_content_on_complete' to fire BEFORE other AFTER triggers
-- (PostgreSQL fires AFTER triggers alphabetically)
-- ============================================================

CREATE OR REPLACE FUNCTION public.assign_content_number_on_completion()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_last_content INTEGER;
  v_owed INTEGER;
BEGIN
  -- Only fire when status changes TO completed
  IF NEW.status != 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Idempotency guard: skip if content_number already assigned
  IF (SELECT content_number FROM sessions WHERE id = NEW.id) IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Lock group row to prevent race conditions
  SELECT last_delivered_content_number, owed_sessions_count
  INTO v_last_content, v_owed
  FROM groups
  WHERE id = NEW.group_id
  FOR UPDATE;

  -- Assign content_number via explicit UPDATE (AFTER trigger cannot use NEW assignment)
  UPDATE sessions
  SET content_number = v_last_content + 1
  WHERE id = NEW.id;

  -- Update group counters atomically
  IF NEW.is_makeup IS TRUE THEN
    -- Makeup completion: increment content + decrement owed
    UPDATE groups
    SET last_delivered_content_number = v_last_content + 1,
        owed_sessions_count = GREATEST(0, v_owed - 1)
    WHERE id = NEW.group_id;
  ELSE
    -- Regular completion: increment content only
    UPDATE groups
    SET last_delivered_content_number = v_last_content + 1
    WHERE id = NEW.group_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- Create the trigger (alphabetically first among AFTER triggers)
DROP TRIGGER IF EXISTS a_assign_content_on_complete ON public.sessions;
CREATE TRIGGER a_assign_content_on_complete
  AFTER UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_content_number_on_completion();

-- ============================================================
-- PART B: Rewrite auto_generate_next_session()
-- Changes:
-- 1. Cancelled → session_number + 1 (not same number) + owed_sessions_count += 1
-- 2. New stop condition using last_delivered_content_number + owed_sessions_count
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_generate_next_session()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
DECLARE
  v_next_session_number INTEGER;
  v_next_session_date DATE;
  v_group RECORD;
  v_expected_sessions INTEGER;
  v_last_content INTEGER;
  v_owed INTEGER;
  v_last_regular_date DATE;
  v_target_dow INTEGER;
  v_current_dow INTEGER;
  v_days_ahead INTEGER;
BEGIN
  -- Only fire on completed or cancelled
  IF NEW.status NOT IN ('completed', 'cancelled') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Ignore makeup sessions entirely
  IF NEW.is_makeup IS TRUE THEN
    RETURN NEW;
  END IF;

  -- Must have a session_number
  IF NEW.session_number IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get group info + level expected sessions
  SELECT g.is_active, g.schedule_day, g.schedule_time, g.duration_minutes,
         g.level_id, g.last_delivered_content_number, g.owed_sessions_count
  INTO v_group
  FROM groups g WHERE g.id = NEW.group_id;

  IF NOT v_group.is_active THEN
    RETURN NEW;
  END IF;

  SELECT l.expected_sessions_count INTO v_expected_sessions
  FROM levels l WHERE l.id = v_group.level_id;

  v_expected_sessions := COALESCE(v_expected_sessions, 12);

  -- Read latest group state (may have been updated by a_assign_content_on_complete)
  SELECT last_delivered_content_number, owed_sessions_count
  INTO v_last_content, v_owed
  FROM groups WHERE id = NEW.group_id;

  -- ======== CANCELLED: increment session_number + increment owed ========
  IF NEW.status = 'cancelled' THEN
    -- Increment owed_sessions_count
    UPDATE groups
    SET owed_sessions_count = COALESCE(owed_sessions_count, 0) + 1
    WHERE id = NEW.group_id;

    v_owed := COALESCE(v_owed, 0) + 1;
  END IF;

  -- Both completed and cancelled generate session_number + 1
  v_next_session_number := NEW.session_number + 1;

  -- ======== STOP CONDITION ========
  -- Stop generating if all content delivered AND no owed sessions
  -- For completed: content was just incremented by a_assign_content_on_complete
  -- For cancelled: content unchanged but owed increased, so we still need more sessions
  IF v_last_content >= v_expected_sessions AND v_owed <= 0 THEN
    RETURN NEW;
  END IF;

  -- Also stop if next session_number would exceed a reasonable bound
  -- (expected + owed gives total slots needed)
  IF v_next_session_number > (v_expected_sessions + v_owed + 5) THEN
    RETURN NEW;
  END IF;

  -- Check if a non-cancelled session with this number already exists
  IF EXISTS (
    SELECT 1 FROM sessions
    WHERE group_id = NEW.group_id
      AND session_number = v_next_session_number
      AND is_makeup IS NOT TRUE
      AND status != 'cancelled'
  ) THEN
    RETURN NEW;
  END IF;

  -- Calculate next date from weekly schedule
  SELECT MAX(s.session_date) INTO v_last_regular_date
  FROM sessions s
  WHERE s.group_id = NEW.group_id
    AND s.is_makeup IS NOT TRUE
    AND s.session_number IS NOT NULL
    AND s.status IN ('scheduled', 'completed', 'cancelled');

  v_last_regular_date := COALESCE(v_last_regular_date, NEW.session_date);

  -- Map schedule_day to DOW
  v_target_dow := CASE v_group.schedule_day
    WHEN 'Sunday'    THEN 0
    WHEN 'Monday'    THEN 1
    WHEN 'Tuesday'   THEN 2
    WHEN 'Wednesday' THEN 3
    WHEN 'Thursday'  THEN 4
    WHEN 'Friday'    THEN 5
    WHEN 'Saturday'  THEN 6
    ELSE EXTRACT(DOW FROM v_last_regular_date)::INTEGER
  END;

  v_current_dow := EXTRACT(DOW FROM v_last_regular_date)::INTEGER;
  v_days_ahead := (v_target_dow - v_current_dow + 7) % 7;
  IF v_days_ahead = 0 THEN
    v_days_ahead := 7;
  END IF;

  v_next_session_date := v_last_regular_date + v_days_ahead;

  INSERT INTO sessions (
    group_id, session_date, session_time, duration_minutes, status, session_number, level_id
  ) VALUES (
    NEW.group_id, v_next_session_date, v_group.schedule_time, v_group.duration_minutes,
    'scheduled', v_next_session_number, v_group.level_id
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- PART C: Rewrite check_students_level_completion()
-- Uses: last_delivered_content_number >= expected AND owed_sessions_count <= 0
-- Reads state AFTER a_assign_content_on_complete has updated everything
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_students_level_completion()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_student RECORD;
  v_expected_sessions INTEGER;
  v_last_content INTEGER;
  v_owed INTEGER;
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

  -- Read group state (already updated by a_assign_content_on_complete)
  SELECT g.last_delivered_content_number, g.owed_sessions_count
  INTO v_last_content, v_owed
  FROM groups g WHERE g.id = NEW.group_id;

  -- Level completion rule:
  -- All content delivered AND no owed sessions remaining
  IF v_last_content < v_expected_sessions OR v_owed > 0 THEN
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
  END LOOP;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- PART D: Update unique index
-- Old: excluded cancelled (to allow same session_number on retry)
-- New: no cancelled exclusion needed (cancelled now gets session_number + 1)
-- Keep: exclude makeup sessions and NULL session_numbers
-- ============================================================

DROP INDEX IF EXISTS idx_sessions_group_session_number_unique;
CREATE UNIQUE INDEX idx_sessions_group_session_number_unique
  ON public.sessions (group_id, session_number)
  WHERE is_makeup IS NOT TRUE AND session_number IS NOT NULL;
