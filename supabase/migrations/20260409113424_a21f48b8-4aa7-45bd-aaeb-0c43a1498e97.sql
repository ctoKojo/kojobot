
DROP FUNCTION IF EXISTS public.transfer_student_to_group(uuid, uuid, uuid, boolean);

CREATE OR REPLACE FUNCTION public.transfer_student_to_group(
  p_student_id uuid,
  p_to_group_id uuid,
  p_from_group_id uuid DEFAULT NULL,
  p_force boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_progress record;
  v_to_group record;
  v_from_group record;
  v_student_canonical int;
  v_group_canonical int;
BEGIN
  -- Set session variable to bypass started-group enrollment check
  PERFORM set_config('app.allow_started_group', 'true', true);

  -- Lock to prevent concurrent transfers
  PERFORM pg_advisory_xact_lock(hashtext(COALESCE(p_from_group_id, p_to_group_id)::text || p_student_id::text));

  -- Get student progress from source group
  IF p_from_group_id IS NOT NULL THEN
    SELECT * INTO v_student_progress
    FROM group_student_progress
    WHERE student_id = p_student_id AND group_id = p_from_group_id
    ORDER BY created_at DESC LIMIT 1;
  ELSE
    -- Find any active progress for this student
    SELECT * INTO v_student_progress
    FROM group_student_progress
    WHERE student_id = p_student_id
      AND status IN ('in_progress','pending_group_assignment')
    ORDER BY created_at DESC LIMIT 1;
    p_from_group_id := v_student_progress.group_id;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_progress_record');
  END IF;

  -- Get target group info
  SELECT * INTO v_to_group FROM groups WHERE id = p_to_group_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'target_group_not_found');
  END IF;

  -- Get source group info
  SELECT * INTO v_from_group FROM groups WHERE id = p_from_group_id;

  -- Check level compatibility
  IF v_to_group.level_id != v_student_progress.current_level_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'level_mismatch');
  END IF;

  -- Calculate canonical sessions
  v_student_canonical := COALESCE(
    (SELECT MAX(s.content_number) FROM sessions s
     JOIN attendance a ON a.session_id = s.id
     WHERE a.student_id = p_student_id 
       AND s.group_id = p_from_group_id
       AND a.status IN ('present','late')
       AND s.status = 'completed'),
    COALESCE(v_from_group.starting_session_number, 1) - 1
  );

  v_group_canonical := COALESCE(v_to_group.last_delivered_content_number, 
                                COALESCE(v_to_group.starting_session_number, 1) - 1);

  -- If student is ahead, require force
  IF v_student_canonical > v_group_canonical AND NOT p_force THEN
    RETURN jsonb_build_object(
      'success', false, 
      'reason', 'student_ahead',
      'student_session', v_student_canonical,
      'group_session', v_group_canonical
    );
  END IF;

  -- Deactivate from old group
  UPDATE group_students SET is_active = false 
  WHERE student_id = p_student_id AND group_id = p_from_group_id;

  -- Add to new group (or reactivate)
  INSERT INTO group_students (student_id, group_id, is_active)
  VALUES (p_student_id, p_to_group_id, true)
  ON CONFLICT (student_id, group_id) 
  DO UPDATE SET is_active = true;

  -- Move progress record
  UPDATE group_student_progress
  SET group_id = p_to_group_id, updated_at = now()
  WHERE id = v_student_progress.id;

  -- Create makeup sessions for missed content if student is behind
  IF v_student_canonical < v_group_canonical THEN
    INSERT INTO makeup_sessions (student_id, group_id, level_id, reason, makeup_type, status, is_free,
                                  curriculum_session_id)
    SELECT p_student_id, p_to_group_id, v_to_group.level_id,
           'Transfer gap: session ' || cs.session_number,
           'transfer_gap', 'pending', true, cs.id
    FROM curriculum_sessions cs
    WHERE cs.level_id = v_to_group.level_id
      AND cs.age_group_id = v_to_group.age_group_id
      AND cs.session_number > v_student_canonical
      AND cs.session_number <= v_group_canonical
      AND cs.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM attendance a2
        JOIN sessions s2 ON s2.id = a2.session_id
        WHERE a2.student_id = p_student_id
          AND s2.content_number = cs.session_number
          AND s2.level_id = v_to_group.level_id
          AND a2.status IN ('present','late')
      );
  END IF;

  RETURN jsonb_build_object('success', true, 'transferred', true);
END;
$$;
