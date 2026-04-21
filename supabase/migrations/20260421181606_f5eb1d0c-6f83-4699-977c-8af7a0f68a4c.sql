CREATE OR REPLACE FUNCTION public.save_attendance(p_session_id uuid, p_group_id uuid, p_records jsonb)
 RETURNS jsonb
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
  v_total INTEGER := 0;
  v_inserted_count INTEGER := 0;
  v_rejected_count INTEGER := 0;
  v_rejected_students JSONB := '[]'::jsonb;
  v_created_count INTEGER := 0;
  v_skipped_count INTEGER := 0;
  v_cancelled_count INTEGER := 0;
  v_instructor_confirmed BOOLEAN := false;
  v_session_completed BOOLEAN := false;
  v_student_count INTEGER;
  v_attendance_count INTEGER;
  v_staff_confirmed BOOLEAN;
  v_is_makeup BOOLEAN;
  v_makeup_session_id UUID;
  v_makeup_student_id UUID;
  v_original_session_id UUID;
  v_redirect_makeup_id UUID;
  v_redirect_session_id UUID;
BEGIN
  v_caller_id := auth.uid();

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

  SELECT s.id, s.status, s.session_date, s.session_time, s.duration_minutes, s.is_makeup, s.makeup_session_id
  INTO v_session_id, v_session_status, v_session_date, v_session_time, v_duration_minutes, v_is_makeup, v_makeup_session_id
  FROM sessions s
  WHERE s.id = p_session_id AND s.group_id = p_group_id
  FOR UPDATE;

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'Invalid session or group mismatch';
  END IF;

  IF v_is_makeup AND v_makeup_session_id IS NOT NULL THEN
    SELECT ms.student_id, ms.original_session_id
    INTO v_makeup_student_id, v_original_session_id
    FROM makeup_sessions ms
    WHERE ms.id = v_makeup_session_id
    FOR UPDATE;

    IF v_makeup_student_id IS NULL THEN
      RAISE EXCEPTION 'Linked makeup session not found';
    END IF;

    FOR v_rec IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
      IF (v_rec->>'student_id')::UUID != v_makeup_student_id THEN
        RAISE EXCEPTION 'Makeup session attendance can only be recorded for the assigned student';
      END IF;
    END LOOP;
  END IF;

  SELECT instructor_id INTO v_group_instructor_id
  FROM groups WHERE id = p_group_id;

  FOR v_rec IN SELECT * FROM jsonb_array_elements(p_records)
  LOOP
    v_student_id := (v_rec->>'student_id')::UUID;
    v_status := v_rec->>'status';
    v_notes := v_rec->>'notes';
    v_redirect_makeup_id := NULL;
    v_redirect_session_id := NULL;

    IF v_status IS NULL OR v_status = '' THEN
      RAISE EXCEPTION 'Attendance status is required for student %', v_student_id;
    END IF;

    IF NOT v_is_makeup AND v_status IN ('present', 'late') THEN
      SELECT ms.id, s.id
      INTO v_redirect_makeup_id, v_redirect_session_id
      FROM makeup_sessions ms
      JOIN sessions s ON s.makeup_session_id = ms.id
      WHERE ms.original_session_id = p_session_id
        AND ms.student_id = v_student_id
        AND ms.status IN ('pending', 'scheduled', 'confirmed')
        AND s.group_id = p_group_id
      ORDER BY ms.created_at DESC
      LIMIT 1;
    END IF;

    IF v_redirect_makeup_id IS NOT NULL AND v_redirect_session_id IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM attendance WHERE session_id = v_redirect_session_id AND student_id = v_student_id) THEN
        v_rejected_students := v_rejected_students || jsonb_build_object('student_id', v_student_id, 'reason', 'duplicate_makeup_attendance');
        v_rejected_count := v_rejected_count + 1;
        CONTINUE;
      END IF;

      INSERT INTO attendance (session_id, student_id, status, notes, recorded_by, compensation_status, makeup_session_id)
      VALUES (v_redirect_session_id, v_student_id, v_status, v_notes, v_caller_id, 'none', v_redirect_makeup_id);

      INSERT INTO attendance (session_id, student_id, status, notes, recorded_by, compensation_status, makeup_session_id)
      VALUES (p_session_id, v_student_id, 'absent', COALESCE(v_notes, 'Auto-linked from makeup attendance'), v_caller_id, 'compensated', v_redirect_makeup_id)
      ON CONFLICT (session_id, student_id) DO UPDATE SET
        status = CASE WHEN attendance.status = 'present' THEN 'absent' ELSE attendance.status END,
        compensation_status = 'compensated',
        makeup_session_id = EXCLUDED.makeup_session_id;

      UPDATE makeup_sessions
      SET status = 'completed', completed_at = COALESCE(completed_at, now())
      WHERE id = v_redirect_makeup_id;

      UPDATE sessions
      SET status = CASE
          WHEN (session_date + session_time + (duration_minutes || ' minutes')::interval) <= now() THEN 'completed'
          ELSE status
        END,
        updated_at = now()
      WHERE id = v_redirect_session_id;

      v_total := v_total + 1;
      v_inserted_count := v_inserted_count + 1;
      CONTINUE;
    END IF;

    IF EXISTS (SELECT 1 FROM attendance WHERE session_id = p_session_id AND student_id = v_student_id) THEN
      v_rejected_students := v_rejected_students || jsonb_build_object('student_id', v_student_id, 'reason', 'duplicate');
      v_rejected_count := v_rejected_count + 1;
      CONTINUE;
    END IF;

    IF v_status = 'absent' AND NOT v_is_makeup THEN
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

      INSERT INTO attendance (session_id, student_id, status, notes, recorded_by, compensation_status, makeup_session_id)
      VALUES (p_session_id, v_student_id, 'absent', v_notes, v_caller_id, 'pending_compensation', v_makeup_id);
    ELSE
      INSERT INTO attendance (session_id, student_id, status, notes, recorded_by, compensation_status, makeup_session_id)
      VALUES (
        p_session_id,
        v_student_id,
        v_status,
        v_notes,
        v_caller_id,
        'none',
        CASE WHEN v_is_makeup THEN v_makeup_session_id ELSE NULL END
      );

      IF v_is_makeup AND v_status IN ('present', 'late') AND v_original_session_id IS NOT NULL THEN
        UPDATE attendance
        SET compensation_status = 'compensated', makeup_session_id = v_makeup_session_id
        WHERE session_id = v_original_session_id
          AND student_id = v_student_id
          AND compensation_status = 'pending_compensation';

        UPDATE makeup_sessions
        SET status = 'completed', completed_at = COALESCE(completed_at, now())
        WHERE id = v_makeup_session_id;
      END IF;
    END IF;

    v_total := v_total + 1;
    v_inserted_count := v_inserted_count + 1;
  END LOOP;

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

  IF v_session_status = 'scheduled' THEN
    IF v_is_makeup THEN
      v_student_count := 1;
    ELSE
      SELECT COUNT(*) INTO v_student_count
      FROM group_students WHERE group_id = p_group_id AND is_active = true;
    END IF;

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
      UPDATE sessions SET status = 'completed', updated_at = now() WHERE id = p_session_id;
      v_session_completed := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'saved', v_total,
    'inserted_count', v_inserted_count,
    'rejected_count', v_rejected_count,
    'rejected_students', v_rejected_students,
    'makeups_created', v_created_count,
    'makeups_skipped', v_skipped_count,
    'makeups_cancelled', v_cancelled_count,
    'instructor_confirmed', v_instructor_confirmed,
    'session_completed', v_session_completed
  );
END;
$function$;