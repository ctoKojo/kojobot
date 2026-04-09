
-- 1. Add needs_renewal column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS needs_renewal boolean DEFAULT false;

-- 2. Recreate student_choose_track_and_upgrade with needs_renewal = true on upgrade
CREATE OR REPLACE FUNCTION public.student_choose_track_and_upgrade(
  p_group_id UUID,
  p_chosen_track_id UUID DEFAULT NULL
)
RETURNS JSONB
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

  -- Save old level info for certificate
  v_old_level_id := v_progress.current_level_id;
  SELECT l.name INTO v_old_level_name FROM levels l WHERE l.id = v_old_level_id;

  SELECT EXISTS(
    SELECT 1 FROM levels
    WHERE parent_level_id = v_progress.current_level_id
      AND track_id IS NOT NULL
      AND is_active = true
  ) INTO v_has_branching;

  IF v_has_branching AND p_chosen_track_id IS NOT NULL THEN
    SELECT id INTO v_next_level_id
    FROM levels
    WHERE parent_level_id = v_progress.current_level_id
      AND track_id = p_chosen_track_id
      AND is_active = true
    LIMIT 1;

    IF v_next_level_id IS NULL THEN
      RAISE EXCEPTION 'No matching level found for this track';
    END IF;

    INSERT INTO student_track_choices (student_id, group_id, from_level_id, chosen_track_id, chosen_by)
    VALUES (v_student_id, p_group_id, v_progress.current_level_id, p_chosen_track_id, v_student_id)
    ON CONFLICT (student_id, group_id, from_level_id) DO NOTHING;
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

  -- 2. Update progress - pending_group_assignment
  UPDATE group_student_progress
  SET level_completed_at = now(),
    current_level_id = v_next_level_id,
    current_track_id = COALESCE(p_chosen_track_id, current_track_id),
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

  -- 4. Update profile level AND set needs_renewal = true (Payment Lock)
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
    'system',
    '/students/' || v_student_id
  FROM user_roles ur
  WHERE ur.role IN ('admin', 'reception');

  -- 7. Notify reception about certificate
  INSERT INTO notifications (user_id, title, title_ar, message, message_ar, type, category, action_url)
  SELECT
    ur.user_id,
    'Certificate Ready to Print',
    'شهادة جاهزة للطباعة',
    COALESCE(v_student_name, 'Student') || ' — ' || COALESCE(v_old_level_name, 'Level') || ' certificate pending generation',
    COALESCE(v_student_name, 'طالب') || ' — شهادة ' || COALESCE(v_old_level_name, 'المستوى') || ' في انتظار التوليد',
    'info',
    'certificate',
    '/students/' || v_student_id
  FROM user_roles ur
  WHERE ur.role IN ('admin', 'reception');

  RETURN jsonb_build_object('upgraded', true, 'next_level_id', v_next_level_id);
END;
$$;
