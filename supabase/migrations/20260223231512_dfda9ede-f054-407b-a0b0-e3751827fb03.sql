
-- RPC: student_choose_track_and_upgrade
-- Allows a student who has passed their current level to choose a track and upgrade themselves
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
BEGIN
  v_student_id := auth.uid();
  
  -- Must be a student
  IF NOT has_role(v_student_id, 'student'::app_role) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Get progress record
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

  -- Check if there are branching children
  SELECT EXISTS(
    SELECT 1 FROM levels 
    WHERE parent_level_id = v_progress.current_level_id 
      AND track_id IS NOT NULL 
      AND is_active = true
  ) INTO v_has_branching;

  -- Determine next level
  IF v_has_branching AND p_chosen_track_id IS NOT NULL THEN
    -- Track branching: find level with matching parent and track
    SELECT id INTO v_next_level_id
    FROM levels
    WHERE parent_level_id = v_progress.current_level_id
      AND track_id = p_chosen_track_id
      AND is_active = true
    LIMIT 1;

    IF v_next_level_id IS NULL THEN
      RAISE EXCEPTION 'No matching level found for this track';
    END IF;

    -- Save track choice
    INSERT INTO student_track_choices (student_id, group_id, from_level_id, chosen_track_id, chosen_by)
    VALUES (v_student_id, p_group_id, v_progress.current_level_id, p_chosen_track_id, v_student_id)
    ON CONFLICT (student_id, group_id, from_level_id) DO NOTHING;
  ELSE
    -- Linear progression: next level_order
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

  -- Log transition
  INSERT INTO student_level_transitions (student_id, group_id, from_level_id, to_level_id, reason, created_by)
  VALUES (v_student_id, p_group_id, v_progress.current_level_id, v_next_level_id, 'passed', v_student_id);

  -- Update progress
  UPDATE group_student_progress
  SET level_completed_at = now(),
    current_level_id = v_next_level_id,
    current_track_id = COALESCE(p_chosen_track_id, current_track_id),
    status = 'in_progress',
    outcome = NULL,
    level_started_at = now(),
    exam_scheduled_at = NULL,
    exam_submitted_at = NULL,
    graded_at = NULL,
    updated_at = now()
  WHERE group_id = p_group_id AND student_id = v_student_id;

  -- Update student's profile level
  UPDATE profiles SET level_id = v_next_level_id, updated_at = now()
  WHERE user_id = v_student_id;

  RETURN jsonb_build_object('upgraded', true, 'next_level_id', v_next_level_id);
END;
$$;
