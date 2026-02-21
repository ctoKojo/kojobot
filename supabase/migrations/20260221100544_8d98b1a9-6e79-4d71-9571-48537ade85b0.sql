
CREATE OR REPLACE FUNCTION public.create_makeup_session(p_student_id uuid, p_original_session_id uuid, p_group_id uuid, p_reason text, p_makeup_type text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_level_id UUID;
  v_age_group_id UUID;
  v_session_number INTEGER;
  v_curriculum_session_id UUID;
  v_is_free BOOLEAN;
  v_credits RECORD;
  v_new_id UUID;
  v_existing_status TEXT;
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();

  -- Authorization check
  IF NOT EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = p_group_id
    AND (
      g.instructor_id = v_caller_id
      OR has_role(v_caller_id, 'admin'::app_role)
      OR has_role(v_caller_id, 'reception'::app_role)
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Validate student belongs to group
  IF NOT EXISTS (
    SELECT 1 FROM group_students gs
    WHERE gs.student_id = p_student_id
    AND gs.group_id = p_group_id
    AND gs.is_active = true
  ) THEN
    RAISE EXCEPTION 'Student does not belong to this group';
  END IF;

  -- Validate session belongs to group
  IF NOT EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.id = p_original_session_id
    AND s.group_id = p_group_id
  ) THEN
    RAISE EXCEPTION 'Session does not belong to this group';
  END IF;

  -- *** Check if already exists ***
  SELECT id, status INTO v_new_id, v_existing_status
  FROM makeup_sessions
  WHERE student_id = p_student_id
    AND original_session_id = p_original_session_id
    AND makeup_type = p_makeup_type;

  IF v_new_id IS NOT NULL THEN
    -- If cancelled, reactivate it
    IF v_existing_status = 'cancelled' THEN
      UPDATE makeup_sessions
      SET status = 'pending', completed_at = NULL
      WHERE id = v_new_id;

      RETURN jsonb_build_object('created', true, 'reactivated', true, 'id', v_new_id);
    END IF;

    RETURN jsonb_build_object('created', false, 'reason', 'already_exists', 'id', v_new_id);
  END IF;

  -- Get group and session data
  SELECT g.level_id, g.age_group_id INTO v_level_id, v_age_group_id
  FROM groups g WHERE g.id = p_group_id;

  SELECT s.session_number INTO v_session_number
  FROM sessions s WHERE s.id = p_original_session_id;

  -- Get curriculum_session_id
  IF v_age_group_id IS NOT NULL AND v_level_id IS NOT NULL AND v_session_number IS NOT NULL THEN
    SELECT cs.id INTO v_curriculum_session_id
    FROM curriculum_sessions cs
    WHERE cs.age_group_id = v_age_group_id
      AND cs.level_id = v_level_id
      AND cs.session_number = v_session_number
      AND cs.is_active = true
    ORDER BY cs.version DESC
    LIMIT 1;
  END IF;

  IF v_curriculum_session_id IS NULL THEN
    RAISE WARNING 'No curriculum_session found for group=%, session_number=%', p_group_id, v_session_number;
  END IF;

  -- Determine free quota
  IF p_reason = 'group_cancelled' THEN
    v_is_free := true;
  ELSIF v_level_id IS NOT NULL THEN
    INSERT INTO student_makeup_credits (student_id, level_id, total_free_allowed, used_free)
    VALUES (p_student_id, v_level_id, 2, 0)
    ON CONFLICT (student_id, level_id)
    DO UPDATE SET updated_at = now()
    RETURNING * INTO v_credits;

    IF v_credits.used_free < v_credits.total_free_allowed THEN
      UPDATE student_makeup_credits
      SET used_free = used_free + 1, updated_at = now()
      WHERE student_id = p_student_id AND level_id = v_level_id;
      v_is_free := true;
    ELSE
      v_is_free := false;
    END IF;
  ELSE
    v_is_free := true;
  END IF;

  -- Insert makeup session
  INSERT INTO makeup_sessions (
    student_id, original_session_id, group_id, level_id,
    reason, is_free, makeup_type, curriculum_session_id
  ) VALUES (
    p_student_id, p_original_session_id, p_group_id, v_level_id,
    p_reason, v_is_free, p_makeup_type, v_curriculum_session_id
  )
  RETURNING id INTO v_new_id;

  -- For group_cancelled: ensure credit record exists
  IF p_reason = 'group_cancelled' AND v_level_id IS NOT NULL THEN
    INSERT INTO student_makeup_credits (student_id, level_id, total_free_allowed, used_free)
    VALUES (p_student_id, v_level_id, 2, 0)
    ON CONFLICT (student_id, level_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'created', true,
    'id', v_new_id,
    'is_free', v_is_free,
    'curriculum_session_id', v_curriculum_session_id
  );
END;
$function$;
