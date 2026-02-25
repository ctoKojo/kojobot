
CREATE OR REPLACE FUNCTION public.transfer_student_to_group(
  p_student_id UUID,
  p_to_group_id UUID,
  p_from_group_id UUID DEFAULT NULL,
  p_force BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_target_level_id UUID;
  v_target_age_group_id UUID;
  v_target_has_started BOOLEAN;
  v_target_starting_session INT;
  v_old_level_id UUID;
  v_old_track_id UUID;
  v_old_level_started_at TIMESTAMPTZ;
  v_no_progress BOOLEAN := FALSE;
  v_group_canonical_last INT;
  v_student_canonical_last INT;
  v_gap INT;
  v_status TEXT;
  v_makeup_count INT := 0;
  v_missed_numbers INT[] := ARRAY[]::INT[];
  v_missed RECORD;
BEGIN
  -- ==================== Step 0: Validations ====================
  -- Permission check
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'reception')) THEN
    RAISE EXCEPTION 'Permission denied: admin or reception role required';
  END IF;

  -- Concurrency lock on student
  PERFORM pg_advisory_xact_lock(hashtext(p_student_id::text));

  -- Same-group check
  IF p_from_group_id IS NOT NULL AND p_from_group_id = p_to_group_id THEN
    RETURN jsonb_build_object('status', 'no_op', 'progress_transferred', false);
  END IF;

  -- ==================== Step 1: Target group info ====================
  SELECT level_id, age_group_id, has_started, COALESCE(starting_session_number, 1)
  INTO v_target_level_id, v_target_age_group_id, v_target_has_started, v_target_starting_session
  FROM groups
  WHERE id = p_to_group_id;

  IF v_target_level_id IS NULL THEN
    RAISE EXCEPTION 'Target group not found or has no level assigned';
  END IF;

  -- ==================== Step 2: Source progress ====================
  IF p_from_group_id IS NOT NULL THEN
    SELECT current_level_id, current_track_id, level_started_at
    INTO v_old_level_id, v_old_track_id, v_old_level_started_at
    FROM group_student_progress
    WHERE student_id = p_student_id AND group_id = p_from_group_id;
  END IF;

  -- If no from_group or no progress found, try any active progress
  IF v_old_level_id IS NULL THEN
    SELECT current_level_id, current_track_id, level_started_at
    INTO v_old_level_id, v_old_track_id, v_old_level_started_at
    FROM group_student_progress
    WHERE student_id = p_student_id AND status = 'in_progress'
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  -- If still no progress: mark as fresh student
  IF v_old_level_id IS NULL THEN
    v_no_progress := TRUE;
  END IF;

  -- ==================== Step 3: Level check ====================
  IF NOT v_no_progress AND v_old_level_id != v_target_level_id THEN
    RETURN jsonb_build_object(
      'status', 'level_mismatch',
      'progress_transferred', false,
      'message', 'Student current level does not match target group level'
    );
  END IF;

  -- ==================== Step 4: Canonical session gap ====================
  -- Group's last completed canonical session
  SELECT MAX(s.session_number + COALESCE(g.starting_session_number, 1) - 1)
  INTO v_group_canonical_last
  FROM sessions s
  JOIN groups g ON g.id = s.group_id
  WHERE s.group_id = p_to_group_id
    AND s.status = 'completed'
    AND s.session_number IS NOT NULL;

  -- Student's last attended canonical session in same level (with track filter)
  SELECT MAX(s.session_number + COALESCE(g.starting_session_number, 1) - 1)
  INTO v_student_canonical_last
  FROM attendance a
  JOIN sessions s ON s.id = a.session_id
  JOIN groups g ON g.id = s.group_id
  LEFT JOIN group_student_progress gsp ON gsp.student_id = a.student_id AND gsp.group_id = g.id
  WHERE a.student_id = p_student_id
    AND a.status IN ('present', 'late')
    AND s.level_id = v_target_level_id
    AND s.status = 'completed'
    AND s.session_number IS NOT NULL
    AND (v_old_track_id IS NULL OR gsp.current_track_id = v_old_track_id);

  v_gap := COALESCE(v_group_canonical_last, 0) - COALESCE(v_student_canonical_last, 0);

  -- ==================== Step 5: Decision ====================
  IF v_gap > 0 THEN
    v_status := 'student_behind';
  ELSIF v_gap < 0 THEN
    v_status := 'student_ahead';
    IF NOT p_force THEN
      RETURN jsonb_build_object(
        'status', 'student_ahead',
        'student_canonical_last', COALESCE(v_student_canonical_last, 0),
        'group_canonical_last', COALESCE(v_group_canonical_last, 0),
        'gap', abs(v_gap),
        'progress_transferred', false,
        'message', 'Student is ahead of group. Use p_force=true to proceed.'
      );
    END IF;
  ELSE
    v_status := 'equal';
  END IF;

  -- Override status if no progress
  IF v_no_progress THEN
    v_status := 'no_progress_created';
  END IF;

  -- ==================== Step 6: Atomic transfer ====================
  -- 6a: Deactivate old group (guarded)
  IF p_from_group_id IS NOT NULL THEN
    UPDATE group_students
    SET is_active = false
    WHERE student_id = p_student_id
      AND group_id = p_from_group_id
      AND is_active = true;
  END IF;

  -- 6b: Upsert into target group (preserve joined_at on conflict)
  INSERT INTO group_students (student_id, group_id, is_active, joined_at)
  VALUES (p_student_id, p_to_group_id, true, now())
  ON CONFLICT (student_id, group_id) DO UPDATE SET is_active = true;

  -- 6c: Upsert progress
  INSERT INTO group_student_progress (
    student_id, group_id, current_level_id, status,
    current_track_id, level_started_at
  ) VALUES (
    p_student_id, p_to_group_id, v_target_level_id,
    'in_progress', v_old_track_id,
    COALESCE(v_old_level_started_at, now())
  )
  ON CONFLICT (student_id, group_id) DO UPDATE SET
    current_level_id = EXCLUDED.current_level_id,
    status = 'in_progress',
    current_track_id = EXCLUDED.current_track_id,
    level_started_at = EXCLUDED.level_started_at,
    updated_at = now();

  -- 6d: Assign subscription dates if group has started
  IF v_target_has_started THEN
    PERFORM assign_subscription_dates(p_to_group_id, p_student_id);
  END IF;

  -- ==================== Step 7: Makeup sessions (student_behind only) ====================
  IF v_status = 'student_behind' THEN
    FOR v_missed IN
      SELECT s.id AS session_id, 
             s.session_number + COALESCE(g.starting_session_number, 1) - 1 AS canonical_num,
             s.level_id AS s_level_id
      FROM sessions s
      JOIN groups g ON g.id = s.group_id
      WHERE s.group_id = p_to_group_id
        AND s.level_id = v_target_level_id
        AND s.status = 'completed'
        AND s.session_number IS NOT NULL
        AND (s.session_number + COALESCE(g.starting_session_number, 1) - 1) > COALESCE(v_student_canonical_last, 0)
        AND (s.session_number + COALESCE(g.starting_session_number, 1) - 1) <= v_group_canonical_last
        -- Exclude sessions the student already attended in any group at same canonical position
        AND NOT EXISTS (
          SELECT 1
          FROM attendance a2
          JOIN sessions s2 ON s2.id = a2.session_id
          JOIN groups g2 ON g2.id = s2.group_id
          WHERE a2.student_id = p_student_id
            AND a2.status IN ('present', 'late')
            AND s2.level_id = v_target_level_id
            AND s2.status = 'completed'
            AND (s2.session_number + COALESCE(g2.starting_session_number, 1) - 1) = (s.session_number + COALESCE(g.starting_session_number, 1) - 1)
        )
      ORDER BY s.session_number
    LOOP
      INSERT INTO makeup_sessions (
        student_id, original_session_id, group_id, level_id,
        reason, status, makeup_type, is_free
      ) VALUES (
        p_student_id, v_missed.session_id, p_to_group_id,
        v_missed.s_level_id,
        'Auto-created: student transferred behind group',
        'pending', 'individual', true
      )
      ON CONFLICT (student_id, original_session_id, makeup_type) DO NOTHING;

      v_missed_numbers := array_append(v_missed_numbers, v_missed.canonical_num);
    END LOOP;

    v_makeup_count := COALESCE(array_length(v_missed_numbers, 1), 0);
  END IF;

  -- ==================== Step 8: Return ====================
  RETURN jsonb_build_object(
    'status', v_status,
    'student_canonical_last', COALESCE(v_student_canonical_last, 0),
    'group_canonical_last', COALESCE(v_group_canonical_last, 0),
    'gap', abs(v_gap),
    'makeup_sessions_created', v_makeup_count,
    'missed_session_numbers', v_missed_numbers,
    'progress_transferred', true
  );
END;
$function$;
