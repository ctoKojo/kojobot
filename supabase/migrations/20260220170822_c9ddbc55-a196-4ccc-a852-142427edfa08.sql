
-- ============================================================
-- Part 1: Backfill historical data
-- ============================================================

-- 1a. Link orphaned attendance records to existing makeup_sessions
UPDATE public.attendance a
SET makeup_session_id = m.id
FROM public.makeup_sessions m
WHERE a.student_id = m.student_id
  AND a.session_id = m.original_session_id
  AND a.status = 'absent'
  AND a.makeup_session_id IS NULL;

-- 1b. Fix compensation_status based on current state
UPDATE public.attendance
SET compensation_status = CASE
  WHEN makeup_session_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.makeup_sessions ms
    WHERE ms.id = attendance.makeup_session_id AND ms.status = 'completed'
  ) THEN 'compensated'
  WHEN status = 'absent' THEN 'pending_compensation'
  ELSE 'none'
END
WHERE compensation_status IS NULL;

-- 1c. Make compensation_status NOT NULL with default
ALTER TABLE public.attendance
ALTER COLUMN compensation_status SET DEFAULT 'none';

ALTER TABLE public.attendance
ALTER COLUMN compensation_status SET NOT NULL;

-- ============================================================
-- Part 2: Modify create_makeup_session to get_or_create pattern
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_makeup_session(
  p_student_id uuid,
  p_original_session_id uuid,
  p_group_id uuid,
  p_reason text,
  p_makeup_type text
)
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

  -- *** GET OR CREATE: Check if already exists ***
  SELECT id INTO v_new_id
  FROM makeup_sessions
  WHERE student_id = p_student_id
    AND original_session_id = p_original_session_id
    AND makeup_type = p_makeup_type;

  IF v_new_id IS NOT NULL THEN
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

-- ============================================================
-- Part 3: Create save_attendance RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.save_attendance(
  p_session_id UUID,
  p_group_id UUID,
  p_records JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id UUID;
  v_session_id UUID;
  v_session_status TEXT;
  v_session_date DATE;
  v_session_time TIME;
  v_duration_minutes INTEGER;
  v_group_instructor_id UUID;
  v_rec JSONB;
  v_student_id UUID;
  v_status TEXT;
  v_notes TEXT;
  v_makeup_result JSONB;
  v_makeup_id UUID;
  v_old_makeup_id UUID;
  v_total INTEGER := 0;
  v_created_count INTEGER := 0;
  v_skipped_count INTEGER := 0;
  v_cancelled_count INTEGER := 0;
  v_instructor_confirmed BOOLEAN := false;
  v_session_completed BOOLEAN := false;
  v_student_count INTEGER;
  v_attendance_count INTEGER;
  v_staff_confirmed BOOLEAN;
BEGIN
  v_caller_id := auth.uid();

  -- ============ Authorization ============
  IF NOT EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = p_group_id
    AND (
      g.instructor_id = v_caller_id
      OR has_role(v_caller_id, 'admin'::app_role)
      OR has_role(v_caller_id, 'reception'::app_role)
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized: you cannot manage attendance for this group';
  END IF;

  -- ============ Lock + Validate session ============
  SELECT s.id, s.status, s.session_date, s.session_time, s.duration_minutes
  INTO v_session_id, v_session_status, v_session_date, v_session_time, v_duration_minutes
  FROM sessions s
  WHERE s.id = p_session_id AND s.group_id = p_group_id
  FOR UPDATE;

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'Invalid session or group mismatch';
  END IF;

  -- Get group instructor
  SELECT instructor_id INTO v_group_instructor_id
  FROM groups WHERE id = p_group_id;

  -- ============ Process each record ============
  FOR v_rec IN SELECT * FROM jsonb_array_elements(p_records)
  LOOP
    v_student_id := (v_rec->>'student_id')::UUID;
    v_status := v_rec->>'status';
    v_notes := v_rec->>'notes';

    IF v_status = 'absent' THEN
      -- === ABSENT: get_or_create makeup + link ===
      v_makeup_result := create_makeup_session(
        v_student_id,
        p_session_id,
        p_group_id,
        'student_absent',
        'individual'
      );

      v_makeup_id := (v_makeup_result->>'id')::UUID;

      IF v_makeup_id IS NULL THEN
        RAISE EXCEPTION 'Failed to create/get makeup session for student %', v_student_id;
      END IF;

      IF (v_makeup_result->>'created')::boolean THEN
        v_created_count := v_created_count + 1;
      ELSE
        v_skipped_count := v_skipped_count + 1;
      END IF;

      -- Upsert attendance with makeup link
      INSERT INTO attendance (session_id, student_id, status, notes, recorded_by, compensation_status, makeup_session_id)
      VALUES (p_session_id, v_student_id, 'absent', v_notes, v_caller_id, 'pending_compensation', v_makeup_id)
      ON CONFLICT (session_id, student_id) DO UPDATE SET
        status = 'absent',
        notes = EXCLUDED.notes,
        recorded_by = EXCLUDED.recorded_by,
        compensation_status = 'pending_compensation',
        makeup_session_id = EXCLUDED.makeup_session_id,
        recorded_at = now();

    ELSE
      -- === NOT ABSENT: cancel pending makeup if exists ===

      -- Check for existing linked makeup
      SELECT makeup_session_id INTO v_old_makeup_id
      FROM attendance
      WHERE session_id = p_session_id AND student_id = v_student_id;

      IF v_old_makeup_id IS NOT NULL THEN
        -- Cancel the makeup if still pending
        UPDATE makeup_sessions
        SET status = 'cancelled'
        WHERE id = v_old_makeup_id AND status = 'pending';

        IF FOUND THEN
          v_cancelled_count := v_cancelled_count + 1;
        END IF;
      END IF;

      -- Upsert attendance without makeup link
      INSERT INTO attendance (session_id, student_id, status, notes, recorded_by, compensation_status, makeup_session_id)
      VALUES (p_session_id, v_student_id, v_status, v_notes, v_caller_id, 'none', NULL)
      ON CONFLICT (session_id, student_id) DO UPDATE SET
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        recorded_by = EXCLUDED.recorded_by,
        compensation_status = 'none',
        makeup_session_id = NULL,
        recorded_at = now();
    END IF;

    v_total := v_total + 1;
  END LOOP;

  -- ============ Auto-confirm instructor attendance ============
  IF v_caller_id = v_group_instructor_id AND v_session_status != 'cancelled' THEN
    IF NOT EXISTS (
      SELECT 1 FROM session_staff_attendance
      WHERE session_id = p_session_id AND staff_id = v_caller_id
    ) THEN
      INSERT INTO session_staff_attendance (session_id, staff_id, status, actual_hours)
      VALUES (p_session_id, v_caller_id, 'confirmed', v_duration_minutes::numeric / 60.0);
      v_instructor_confirmed := true;
    END IF;
  END IF;

  -- ============ Auto-complete session ============
  IF v_session_status = 'scheduled' THEN
    -- Check: all students have attendance + instructor confirmed + time passed
    SELECT COUNT(*) INTO v_student_count
    FROM group_students WHERE group_id = p_group_id AND is_active = true;

    SELECT COUNT(*) INTO v_attendance_count
    FROM attendance WHERE session_id = p_session_id;

    SELECT EXISTS (
      SELECT 1 FROM session_staff_attendance
      WHERE session_id = p_session_id AND staff_id = v_group_instructor_id AND status = 'confirmed'
    ) INTO v_staff_confirmed;

    IF v_attendance_count >= v_student_count
       AND v_staff_confirmed
       AND (v_session_date + v_session_time + (v_duration_minutes || ' minutes')::interval) <= now()
    THEN
      UPDATE sessions SET status = 'completed' WHERE id = p_session_id;
      v_session_completed := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'saved', v_total,
    'makeups_created', v_created_count,
    'makeups_skipped', v_skipped_count,
    'makeups_cancelled', v_cancelled_count,
    'instructor_confirmed', v_instructor_confirmed,
    'session_completed', v_session_completed
  );
END;
$function$;
