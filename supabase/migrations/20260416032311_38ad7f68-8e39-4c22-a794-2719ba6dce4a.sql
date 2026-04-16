
-- 1. Lifecycle transition trigger: enforce valid state machine
CREATE OR REPLACE FUNCTION public.validate_lifecycle_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  valid BOOLEAN := FALSE;
BEGIN
  -- Skip if status didn't change
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Define valid transitions
  valid := CASE
    WHEN OLD.status = 'in_progress'               AND NEW.status = 'awaiting_exam'            THEN TRUE
    WHEN OLD.status = 'awaiting_exam'              AND NEW.status = 'exam_scheduled'           THEN TRUE
    WHEN OLD.status = 'exam_scheduled'             AND NEW.status = 'graded'                   THEN TRUE
    WHEN OLD.status = 'graded'                     AND NEW.status = 'pending_group_assignment'  THEN TRUE
    WHEN OLD.status = 'pending_group_assignment'    AND NEW.status = 'in_progress'              THEN TRUE
    -- Allow admin corrections
    WHEN OLD.status = 'exam_scheduled'             AND NEW.status = 'awaiting_exam'            THEN TRUE
    WHEN OLD.status = 'graded'                     AND NEW.status = 'exam_scheduled'           THEN TRUE
    ELSE FALSE
  END;

  IF NOT valid THEN
    RAISE EXCEPTION 'Invalid lifecycle transition: % → %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_lifecycle_transition
  BEFORE UPDATE ON public.group_student_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_lifecycle_transition();

-- 2. Update student_choose_track_and_upgrade to require grade existence
CREATE OR REPLACE FUNCTION public.student_choose_track_and_upgrade(
  p_group_id UUID,
  p_chosen_track_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_progress RECORD;
  v_next_level_id UUID;
  v_current_level_order INTEGER;
  v_has_branching BOOLEAN;
  v_student_name TEXT;
  v_level_name TEXT;
  v_old_level_id UUID;
  v_old_level_name TEXT;
  v_child_count INTEGER;
  v_grade_exists BOOLEAN;
BEGIN
  v_student_id := auth.uid();

  IF NOT has_role(v_student_id, 'student'::app_role) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT * INTO v_progress
  FROM group_student_progress
  WHERE group_id = p_group_id AND student_id = v_student_id
  FOR UPDATE;

  IF v_progress IS NULL THEN
    RAISE EXCEPTION 'Progress record not found';
  END IF;

  IF v_progress.outcome != 'passed' THEN
    RAISE EXCEPTION 'Student has not passed the current level';
  END IF;

  -- DATA COMPLETENESS GUARD: Verify grade record exists
  SELECT EXISTS (
    SELECT 1 FROM level_grades
    WHERE student_id = v_student_id
      AND group_id = p_group_id
      AND level_id = v_progress.current_level_id
  ) INTO v_grade_exists;

  IF NOT v_grade_exists THEN
    RAISE EXCEPTION 'Cannot upgrade: no grade record found for current level. Contact administration.';
  END IF;

  v_old_level_id := v_progress.current_level_id;
  SELECT l.name INTO v_old_level_name FROM levels l WHERE l.id = v_old_level_id;

  -- Detect branching: multiple active children = branch point
  SELECT COUNT(*) INTO v_child_count
  FROM levels
  WHERE parent_level_id = v_progress.current_level_id AND is_active = true;

  v_has_branching := (v_child_count > 1);

  IF v_has_branching AND p_chosen_track_id IS NOT NULL THEN
    SELECT id INTO v_next_level_id
    FROM levels
    WHERE id = p_chosen_track_id
      AND parent_level_id = v_progress.current_level_id
      AND is_active = true;

    IF v_next_level_id IS NULL THEN
      RAISE EXCEPTION 'No matching level found for this choice';
    END IF;

    INSERT INTO student_track_choices (student_id, group_id, from_level_id, chosen_track_id, chosen_by)
    VALUES (v_student_id, p_group_id, v_progress.current_level_id, p_chosen_track_id, v_student_id)
    ON CONFLICT (student_id, group_id, from_level_id) DO NOTHING;
  ELSIF v_child_count = 1 THEN
    SELECT id INTO v_next_level_id
    FROM levels
    WHERE parent_level_id = v_progress.current_level_id AND is_active = true
    LIMIT 1;
  ELSE
    SELECT l.level_order INTO v_current_level_order
    FROM levels l WHERE l.id = v_progress.current_level_id;

    SELECT id INTO v_next_level_id
    FROM levels
    WHERE level_order = v_current_level_order + 1
      AND (track_id = v_progress.current_track_id OR (track_id IS NULL AND v_progress.current_track_id IS NULL))
      AND is_active = true
    LIMIT 1;

    IF v_next_level_id IS NULL THEN
      RETURN jsonb_build_object('upgraded', false, 'reason', 'no_next_level');
    END IF;
  END IF;

  -- 1. Log transition
  INSERT INTO student_level_transitions (student_id, group_id, from_level_id, to_level_id, reason, created_by)
  VALUES (v_student_id, p_group_id, v_progress.current_level_id, v_next_level_id, 'passed', v_student_id);

  -- 2. Update progress
  UPDATE group_student_progress
  SET level_completed_at = now(),
    current_level_id = v_next_level_id,
    current_track_id = COALESCE(
      (SELECT track_id FROM levels WHERE id = v_next_level_id),
      current_track_id
    ),
    status = 'pending_group_assignment',
    status_changed_at = now(),
    outcome = NULL,
    level_started_at = now(),
    exam_scheduled_at = NULL,
    exam_submitted_at = NULL,
    graded_at = NULL,
    updated_at = now()
  WHERE group_id = p_group_id AND student_id = v_student_id;

  -- 3. Deactivate from old group
  UPDATE group_students
  SET is_active = false
  WHERE student_id = v_student_id AND group_id = p_group_id;

  -- 4. Update profile level AND set needs_renewal = true
  UPDATE profiles SET level_id = v_next_level_id, needs_renewal = true, updated_at = now()
  WHERE user_id = v_student_id;

  -- 5. Issue certificate for OLD level
  SELECT p.full_name INTO v_student_name FROM profiles p WHERE p.user_id = v_student_id;
  SELECT l.name INTO v_level_name FROM levels l WHERE l.id = v_next_level_id;

  INSERT INTO student_certificates (student_id, level_id, group_id, status, student_name_snapshot, level_name_snapshot)
  VALUES (v_student_id, v_old_level_id, p_group_id, 'pending', COALESCE(v_student_name, 'Unknown'), COALESCE(v_old_level_name, 'Unknown'))
  ON CONFLICT (student_id, level_id) DO NOTHING;

  -- 6. Notify admin
  INSERT INTO notifications (user_id, title, title_ar, message, message_ar, type, category, action_url)
  SELECT
    ur.user_id,
    'Student Needs Group Assignment',
    'طالب يحتاج تعيين في جروب',
    COALESCE(v_student_name, 'Student') || ' upgraded to ' || COALESCE(v_level_name, 'next level') || ' — needs group assignment',
    COALESCE(v_student_name, 'طالب') || ' ترقى إلى ' || COALESCE(v_level_name, 'المستوى التالي') || ' — يحتاج تعيين في جروب',
    'warning',
    'category',
    '/students/' || v_student_id::text
  FROM user_roles ur WHERE ur.role IN ('admin', 'reception');

  RETURN jsonb_build_object(
    'upgraded', true,
    'new_level_id', v_next_level_id,
    'new_level_name', v_level_name
  );
END;
$$;
